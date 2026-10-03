import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database, MetodoPago } from "./supabase/types";

export type CierreMovimiento = {
  id: string;
  created_at: string;
  tipo: "ingreso" | "egreso";
  concepto: string;
  monto: number;
  metodo_pago: MetodoPago | null;
  /** Si el movimiento viene de una venta, su cliente — si no, null (se usa `concepto`). */
  clienteNombre: string | null;
  /** Solo aplica a ingresos ligados a una venta: true si no fue el primer pago de esa venta. */
  esAbono: boolean;
  referido: string | null;
};

export type CierreVentaPendiente = {
  id: string;
  created_at: string;
  clienteNombre: string;
  referido: string;
  total: number;
  pagado: number;
  pendiente: number;
};

export type CierreCajaData = {
  sesion: {
    id: string;
    sede_id: string;
    opened_by: string | null;
    opened_at: string;
    closed_by: string | null;
    closed_at: string | null;
    opening_balance: number;
    closing_balance: number | null;
    estado: string;
  };
  sedeNombre: string;
  abiertoPorNombre: string;
  cerradoPorNombre: string;
  ingresos: CierreMovimiento[];
  egresos: CierreMovimiento[];
  totalIngresos: number;
  totalEgresos: number;
  ingresosEfectivo: number;
  egresosEfectivo: number;
  saldoTeoricoEfectivo: number;
  diferencia: number | null;
  totalesPorMetodo: { metodo: MetodoPago; monto: number }[];
  ventasPendientes: CierreVentaPendiente[];
  totalPendiente: number;
  totalVentasHoy: number;
};

/**
 * Arma todo el detalle de un cierre de caja — misma fuente de datos para
 * la vista imprimible (caja/[id]/cierre/page.tsx) y para el correo de
 * aviso (caja-cierre-email.ts), para que no se desincronicen entre sí.
 */
export async function getCierreCajaData(
  supabase: SupabaseClient<Database>,
  sesionId: string,
): Promise<CierreCajaData | null> {
  const { data: sesion } = await supabase
    .from("caja_sesiones")
    .select("id, sede_id, opened_by, opened_at, closed_by, closed_at, opening_balance, closing_balance, estado")
    .eq("id", sesionId)
    .maybeSingle();

  if (!sesion) return null;

  // "Hasta" del cierre: si la caja sigue abierta (se está previsualizando
  // antes de cerrar), se usa el momento actual en vez de closed_at (null).
  const cierreHasta = sesion.closed_at ?? new Date().toISOString();

  const [{ data: sede }, { data: movimientos }, { data: perfiles }, { data: ventasPendientesRaw }, { count: ventasHoyCount }] =
    await Promise.all([
      supabase.from("sedes").select("name").eq("id", sesion.sede_id).maybeSingle(),
      supabase
        .from("caja_movimientos")
        .select("id, tipo, concepto, monto, metodo_pago, venta_id, created_at")
        .eq("caja_sesion_id", sesionId)
        .order("created_at"),
      supabase
        .from("profiles")
        .select("id, full_name")
        .in("id", [sesion.opened_by, sesion.closed_by].filter((v): v is string => !!v)),
      // Ventas que se crearon durante esta sesión y siguen con saldo
      // pendiente — ej. un tramitador trajo a alguien y todavía no pagó
      // nada. No generan ningún caja_movimientos (no entró plata), así que
      // sin esto quedaban invisibles en el cierre aunque hayan pasado por
      // esta caja.
      supabase
        .from("ventas")
        .select("id, cliente_id, referido_nombre, tramitador_id, monto, descuento, incremento, created_at")
        .eq("sede_id", sesion.sede_id)
        .eq("estado", "abonada")
        .gte("created_at", sesion.opened_at)
        .lte("created_at", cierreHasta)
        .order("created_at"),
      // Cuántas ventas se registraron durante esta sesión, sin importar su
      // estado de pago (pagada/abonada) — excluye las anuladas.
      supabase
        .from("ventas")
        .select("id", { count: "exact", head: true })
        .eq("sede_id", sesion.sede_id)
        .neq("estado", "anulada")
        .gte("created_at", sesion.opened_at)
        .lte("created_at", cierreHasta),
    ]);

  const ventaIds = [...new Set((movimientos ?? []).map((m) => m.venta_id).filter((v): v is string => !!v))];
  const { data: ventas } =
    ventaIds.length > 0
      ? await supabase.from("ventas").select("id, cliente_id, referido_nombre, tramitador_id").in("id", ventaIds)
      : { data: [] as { id: string; cliente_id: string; referido_nombre: string | null; tramitador_id: string | null }[] };

  const ventasPendientes = ventasPendientesRaw ?? [];
  const pendienteVentaIds = ventasPendientes.map((v) => v.id);

  const clienteIds = [
    ...new Set([...(ventas ?? []).map((v) => v.cliente_id), ...ventasPendientes.map((v) => v.cliente_id)]),
  ];
  const tramitadorIds = [
    ...new Set(
      [...(ventas ?? []), ...ventasPendientes].map((v) => v.tramitador_id).filter((v): v is string => !!v),
    ),
  ];
  const [{ data: clientes }, { data: tramitadoresRows }, { data: todosLosPagos }, { data: pagosPendientes }] =
    await Promise.all([
      clienteIds.length > 0
        ? supabase.from("clientes").select("id, nombre_completo").in("id", clienteIds)
        : Promise.resolve({ data: [] as { id: string; nombre_completo: string }[] }),
      tramitadorIds.length > 0
        ? supabase.from("tramitadores").select("id, nombre").in("id", tramitadorIds)
        : Promise.resolve({ data: [] as { id: string; nombre: string }[] }),
      // Historial COMPLETO de pagos de estas ventas (no solo los de esta
      // caja) porque un abono de hoy puede completar una venta cuyo primer
      // pago fue en una sesión anterior.
      ventaIds.length > 0
        ? supabase.from("venta_pagos").select("venta_id, created_at").in("venta_id", ventaIds)
        : Promise.resolve({ data: [] as { venta_id: string; created_at: string }[] }),
      pendienteVentaIds.length > 0
        ? supabase.from("venta_pagos").select("venta_id, monto").in("venta_id", pendienteVentaIds)
        : Promise.resolve({ data: [] as { venta_id: string; monto: number }[] }),
    ]);

  const pagadoDePendiente = (ventaId: string) =>
    (pagosPendientes ?? []).filter((p) => p.venta_id === ventaId).reduce((acc, p) => acc + p.monto, 0);

  // Primer momento en que se pagó algo de cada venta — cualquier pago
  // posterior a ese instante es un abono, no el pago inicial.
  const primerPagoDeVenta = new Map<string, string>();
  for (const p of todosLosPagos ?? []) {
    const actual = primerPagoDeVenta.get(p.venta_id);
    if (!actual || p.created_at < actual) primerPagoDeVenta.set(p.venta_id, p.created_at);
  }

  const ventaDe = (ventaId: string | null) => (ventas ?? []).find((v) => v.id === ventaId) ?? null;
  const clienteDe = (clienteId: string | undefined) =>
    (clientes ?? []).find((c) => c.id === clienteId)?.nombre_completo ?? "—";
  const referidoDe = (venta: NonNullable<ReturnType<typeof ventaDe>>) =>
    (venta.tramitador_id
      ? (tramitadoresRows ?? []).find((t) => t.id === venta.tramitador_id)?.nombre
      : venta.referido_nombre) ?? "—";
  const nombreDe = (userId: string | null) => (perfiles ?? []).find((p) => p.id === userId)?.full_name ?? "—";

  const movsIngresos = (movimientos ?? []).filter((m) => m.tipo === "ingreso");
  const movsEgresos = (movimientos ?? []).filter((m) => m.tipo === "egreso");

  const aCierreMovimiento = (m: NonNullable<typeof movimientos>[number]): CierreMovimiento => {
    const venta = ventaDe(m.venta_id);
    return {
      id: m.id,
      created_at: m.created_at,
      tipo: m.tipo,
      concepto: m.concepto,
      monto: m.monto,
      metodo_pago: m.metodo_pago as MetodoPago | null,
      clienteNombre: venta ? clienteDe(venta.cliente_id) : null,
      esAbono: m.venta_id != null && primerPagoDeVenta.get(m.venta_id) !== m.created_at,
      referido: venta ? referidoDe(venta) : null,
    };
  };

  const ingresos = movsIngresos.map(aCierreMovimiento);
  const egresos = movsEgresos.map(aCierreMovimiento);

  const sum = (rows: typeof movsIngresos, metodo?: string) =>
    rows.filter((m) => !metodo || m.metodo_pago === metodo).reduce((acc, m) => acc + m.monto, 0);

  const totalIngresos = sum(movsIngresos);
  const totalEgresos = sum(movsEgresos);
  // El conteo físico de la caja ("Saldo de cierre contado") solo puede ser
  // efectivo — un pago con transferencia/tarjeta nunca pasa por el cajón.
  const ingresosEfectivo = sum(movsIngresos, "efectivo");
  const egresosEfectivo = sum(movsEgresos, "efectivo");
  const saldoTeoricoEfectivo = sesion.opening_balance + ingresosEfectivo - egresosEfectivo;
  const diferencia = sesion.closing_balance != null ? sesion.closing_balance - saldoTeoricoEfectivo : null;

  const totalesPorMetodoMap = new Map<MetodoPago, number>();
  for (const m of movsIngresos) {
    const key = (m.metodo_pago ?? "otro") as MetodoPago;
    totalesPorMetodoMap.set(key, (totalesPorMetodoMap.get(key) ?? 0) + m.monto);
  }

  const ventasPendientesConDetalle: CierreVentaPendiente[] = ventasPendientes.map((v) => {
    const pagado = pagadoDePendiente(v.id);
    return {
      id: v.id,
      created_at: v.created_at,
      clienteNombre: clienteDe(v.cliente_id),
      referido: referidoDe(v),
      total: v.monto - v.descuento + v.incremento,
      pagado,
      pendiente: v.monto - v.descuento + v.incremento - pagado,
    };
  });

  return {
    sesion,
    sedeNombre: sede?.name ?? "—",
    abiertoPorNombre: nombreDe(sesion.opened_by),
    cerradoPorNombre: nombreDe(sesion.closed_by),
    ingresos,
    egresos,
    totalIngresos,
    totalEgresos,
    ingresosEfectivo,
    egresosEfectivo,
    saldoTeoricoEfectivo,
    diferencia,
    totalesPorMetodo: [...totalesPorMetodoMap.entries()].map(([metodo, monto]) => ({ metodo, monto })),
    ventasPendientes: ventasPendientesConDetalle,
    totalPendiente: ventasPendientesConDetalle.reduce((acc, v) => acc + v.pendiente, 0),
    totalVentasHoy: ventasHoyCount ?? 0,
  };
}
