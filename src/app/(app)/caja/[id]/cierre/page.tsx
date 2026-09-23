import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getViewerContext } from "@/lib/viewer";
import { formatCOP, formatDateTime } from "@/lib/format";
import { METODO_PAGO_LABEL, type MetodoPago } from "@/lib/supabase/types";
import { METODO_PAGO_STYLE } from "@/lib/metodo-pago-ui";
import { getSedeBranding } from "@/lib/sede-branding";
import { PrintButton } from "@/components/print-button";
import { badgeClass } from "@/lib/ui";

export const metadata: Metadata = { title: "Cierre de caja | Gestia App Conductores" };

type TramoCierre = { minimo: number; mensaje: string };

// Mismos cortes que el banner del dashboard (3/6/10/15/20), pero con el
// mensaje mirando hacia el cierre del día y lo que viene mañana, no hacia
// "seguí vendiendo ahora" — acá el día ya terminó.
const TRAMOS_CIERRE: TramoCierre[] = [
  { minimo: 20, mensaje: "¡Día increíble! Eres la mejor vendedora — mañana seguimos rompiéndola así." },
  { minimo: 15, mensaje: "¡Qué día! Casi llegás a las 20 — mañana lo superamos." },
  { minimo: 10, mensaje: "¡Excelente jornada! Mañana vamos por más." },
  { minimo: 6, mensaje: "Buen día de ventas. Mañana seguimos con el mismo ritmo." },
  { minimo: 3, mensaje: "Buen cierre — nada mal. Mañana seguimos sumando." },
  { minimo: 1, mensaje: "Diste el primer paso hoy. Mañana seguimos." },
  { minimo: 0, mensaje: "Hoy no hubo ventas, pero mañana es un nuevo día para lograrlo." },
];

function tramoCierreDe(cantidad: number): TramoCierre {
  return TRAMOS_CIERRE.find((t) => cantidad >= t.minimo) ?? TRAMOS_CIERRE[TRAMOS_CIERRE.length - 1];
}

export default async function CierreCajaPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const { supabase, organization } = await getViewerContext();

  const { data: sesion } = await supabase
    .from("caja_sesiones")
    .select("id, sede_id, opened_by, opened_at, closed_by, closed_at, opening_balance, closing_balance, estado")
    .eq("id", id)
    .maybeSingle();

  if (!sesion) notFound();

  // "Hasta" del cierre: si la caja sigue abierta (se está previsualizando
  // antes de cerrar), se usa el momento actual en vez de closed_at (null).
  const cierreHasta = sesion.closed_at ?? new Date().toISOString();

  const [{ data: sede }, { data: movimientos }, { data: perfiles }, { data: ventasPendientesRaw }, { count: ventasHoyCount }] =
    await Promise.all([
      supabase.from("sedes").select("name").eq("id", sesion.sede_id).maybeSingle(),
      supabase
        .from("caja_movimientos")
        .select("id, tipo, concepto, monto, metodo_pago, venta_id, created_at")
        .eq("caja_sesion_id", id)
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
        .select("id, cliente_id, referido_nombre, tramitador_id, monto, descuento, created_at")
        .eq("sede_id", sesion.sede_id)
        .eq("estado", "abonada")
        .gte("created_at", sesion.opened_at)
        .lte("created_at", cierreHasta)
        .order("created_at"),
      // Cuántas ventas se registraron durante esta sesión, sin importar su
      // estado de pago (pagada/abonada) — para el mensaje de ánimo de
      // cierre. Se excluyen las anuladas: una venta que se deshizo no
      // cuenta como una venta de verdad.
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
      ? await supabase
          .from("ventas")
          .select("id, cliente_id, referido_nombre, tramitador_id")
          .in("id", ventaIds)
      : { data: [] };

  const ventasPendientes = ventasPendientesRaw ?? [];
  const pendienteVentaIds = ventasPendientes.map((v) => v.id);

  const clienteIds = [
    ...new Set([...(ventas ?? []).map((v) => v.cliente_id), ...ventasPendientes.map((v) => v.cliente_id)]),
  ];
  const tramitadorIds = [
    ...new Set(
      [...(ventas ?? []), ...ventasPendientes]
        .map((v) => v.tramitador_id)
        .filter((v): v is string => !!v),
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
      // Se pide el historial COMPLETO de pagos de estas ventas (no solo los de
      // esta caja) porque un abono de hoy puede completar una venta cuyo
      // primer pago fue en una sesión de caja anterior — sin esto, ese primer
      // pago de otro día jamás entraría en la comparación.
      ventaIds.length > 0
        ? supabase.from("venta_pagos").select("venta_id, created_at").in("venta_id", ventaIds)
        : Promise.resolve({ data: [] as { venta_id: string; created_at: string }[] }),
      // Lo ya abonado de las ventas pendientes, para mostrar cuánto falta
      // (puede no ser $0 si alguien pagó una parte y no completó).
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
  const nombreDe = (userId: string | null) =>
    (perfiles ?? []).find((p) => p.id === userId)?.full_name ?? "—";

  const ingresos = (movimientos ?? []).filter((m) => m.tipo === "ingreso");
  const egresos = (movimientos ?? []).filter((m) => m.tipo === "egreso");

  const sum = (rows: typeof ingresos, metodo?: string) =>
    rows
      .filter((m) => !metodo || m.metodo_pago === metodo)
      .reduce((acc, m) => acc + m.monto, 0);

  const totalIngresos = sum(ingresos);
  const totalEgresos = sum(egresos);
  // El conteo físico de la caja ("Saldo de cierre contado") solo puede ser
  // efectivo — un pago con transferencia/tarjeta nunca pasa por el cajón.
  // Comparar contra el total de TODOS los métodos infla el teórico y hace
  // ver una diferencia falsa; acá se aísla el efectivo para la conciliación.
  const ingresosEfectivo = sum(ingresos, "efectivo");
  const egresosEfectivo = sum(egresos, "efectivo");
  const saldoTeoricoEfectivo = sesion.opening_balance + ingresosEfectivo - egresosEfectivo;
  const diferencia = sesion.closing_balance != null ? sesion.closing_balance - saldoTeoricoEfectivo : null;

  // Se guarda por la clave cruda del método (no la etiqueta) para poder
  // buscarle su color/ícono en METODO_PAGO_STYLE al mostrarlo.
  const totalesPorMetodo = new Map<MetodoPago, number>();
  for (const m of ingresos) {
    const key = (m.metodo_pago ?? "otro") as MetodoPago;
    totalesPorMetodo.set(key, (totalesPorMetodo.get(key) ?? 0) + m.monto);
  }

  const branding = getSedeBranding(sede?.name, organization.name);
  const totalVentasHoy = ventasHoyCount ?? 0;
  const tramoCierre = tramoCierreDe(totalVentasHoy);

  return (
    <div className="flex flex-col items-center gap-4">
      <style>{`@page { size: letter; margin: 0.5in; }`}</style>
      <div className="flex flex-col items-center gap-1.5 print:hidden">
        <PrintButton label="Imprimir o guardar como PDF" />
        <p className="text-xs text-slate-400">
          En el diálogo, elegí tu impresora para imprimir, o &quot;Guardar como PDF&quot; para descargarlo.
        </p>
      </div>

      <div className="w-[8.5in] max-w-full overflow-hidden rounded-2xl border border-slate-200 bg-white text-sm text-slate-800 print:w-auto print:rounded-none print:border-none">
        <div className="h-1.5 bg-gradient-to-r from-indigo-600 via-sky-500 to-emerald-500 print:hidden" />
        <div className="p-8 pt-6">
          {/* Encabezado */}
          <div className="flex items-start justify-between gap-4 border-b-2 border-slate-800 pb-3">
            <div>
              <h1 className="text-xl leading-tight font-bold text-slate-900">{branding.nombre}</h1>
              <p className="text-xs font-semibold tracking-wide text-indigo-700 uppercase">
                {branding.subtitulo}
              </p>
              {branding.slogan ? (
                <p className="mt-0.5 text-[11px] text-slate-400 italic">{branding.slogan}</p>
              ) : null}
            </div>
            <div className="text-right">
              <p className="text-sm font-semibold text-slate-900">Cierre de caja</p>
              <p className="font-mono text-xs text-slate-400">#{sesion.id.slice(0, 8).toUpperCase()}</p>
              {branding.telefono || branding.web ? (
                <p className="mt-1 text-[11px] text-slate-400">
                  {branding.telefono ? <span>Tel. {branding.telefono}</span> : null}
                  {branding.telefono && branding.web ? <span> · </span> : null}
                  {branding.web ? <span>{branding.web}</span> : null}
                </p>
              ) : null}
            </div>
          </div>

        <div className="mt-3 grid grid-cols-2 gap-3 border-b border-slate-200 pb-3 text-xs">
          <div>
            <p className="text-slate-400">Apertura</p>
            <p className="font-medium text-slate-800">{formatDateTime(sesion.opened_at)}</p>
            <p className="text-slate-500">{nombreDe(sesion.opened_by)}</p>
          </div>
          <div>
            <p className="text-slate-400">Cierre</p>
            <p className="font-medium text-slate-800">
              {sesion.closed_at ? formatDateTime(sesion.closed_at) : "—"}
            </p>
            <p className="text-slate-500">{nombreDe(sesion.closed_by)}</p>
          </div>
        </div>

        {/* Resumen de efectivo — lo que realmente se cuenta en el cajón */}
        <div className="mt-4">
          <p className="mb-2 text-[11px] font-semibold tracking-wide text-slate-500 uppercase">
            Resumen de efectivo
          </p>
          <div className="grid grid-cols-3 gap-x-4 gap-y-3 rounded-xl border border-slate-200 bg-slate-50 p-4 sm:grid-cols-6">
            <Kpi label="Base inicial" value={formatCOP(sesion.opening_balance)} />
            <Kpi label="Ingresos" value={formatCOP(ingresosEfectivo)} tone="text-emerald-600" />
            <Kpi label="Egresos" value={formatCOP(egresosEfectivo)} tone="text-red-600" />
            <Kpi label="Teórico" value={formatCOP(saldoTeoricoEfectivo)} />
            <Kpi
              label="Contado"
              value={sesion.closing_balance != null ? formatCOP(sesion.closing_balance) : "—"}
            />
            <Kpi
              label="Diferencia"
              value={diferencia != null ? formatCOP(diferencia) : "—"}
              tone={diferencia == null ? "text-slate-400" : diferencia === 0 ? "text-emerald-600" : "text-amber-700"}
              strong
            />
          </div>
        </div>

        {/* Ingresos por método — un chip de color por método (nunca solo el
            color: siempre lleva ícono + etiqueta + monto) para poder
            diferenciar de un vistazo cuánto entró en efectivo vs. Nequi vs.
            transferencia, en vez de una lista de texto plano. */}
        <div className="mt-4">
          <p className="mb-2 text-[11px] font-semibold tracking-wide text-slate-500 uppercase">Formas de pago</p>
          <div className="flex flex-wrap items-stretch gap-2 border-b border-slate-200 pb-3">
            {[...totalesPorMetodo.entries()].map(([metodo, monto]) => {
              const style = METODO_PAGO_STYLE[metodo] ?? METODO_PAGO_STYLE.otro;
              const Icon = style.icon;
              return (
                <div
                  key={metodo}
                  className={`flex items-center gap-2 rounded-xl border ${style.border} ${style.bg} py-1.5 pr-3 pl-2`}
                >
                  <span className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full ${style.iconBg} ${style.text}`}>
                    <Icon className="h-3.5 w-3.5" />
                  </span>
                  <div className="leading-tight">
                    <p className={`text-[9px] font-semibold tracking-wide uppercase ${style.text}`}>
                      {METODO_PAGO_LABEL[metodo] ?? metodo}
                    </p>
                    <p className="text-xs font-bold text-slate-900">{formatCOP(monto)}</p>
                  </div>
                </div>
              );
            })}
            <div className="ml-auto flex items-center text-xs">
              <span className="text-slate-500">Total ingresos/ventas&nbsp;</span>
              <span className="font-semibold text-slate-900">{formatCOP(totalIngresos)}</span>
            </div>
          </div>
        </div>

        {/* Detalle de ingresos */}
        <div className="mt-4">
          <p className="mb-1.5 text-[11px] font-semibold tracking-wide text-slate-500 uppercase">
            Ingresos del período
          </p>
          <table className="w-full border-collapse text-xs">
            <thead>
              <tr className="border-b border-slate-300 text-left text-slate-500">
                <th className="py-1.5 pr-2 font-medium">Hora</th>
                <th className="py-1.5 pr-2 font-medium">Cliente</th>
                <th className="py-1.5 pr-2 font-medium">Tipo</th>
                <th className="py-1.5 pr-2 font-medium">Referido</th>
                <th className="py-1.5 pr-2 font-medium">Método</th>
                <th className="py-1.5 pl-2 text-right font-medium">Monto</th>
              </tr>
            </thead>
            <tbody>
              {ingresos.map((m) => {
                const venta = ventaDe(m.venta_id);
                // El pago inicial de una venta es el que coincide con el
                // primer momento en que se le pagó algo — cualquier otro
                // pago posterior de esa misma venta es un abono (típico de
                // alguien completando lo que debe para certificarse).
                const esAbono = m.venta_id != null && primerPagoDeVenta.get(m.venta_id) !== m.created_at;
                return (
                  <tr key={m.id} className="border-b border-slate-100">
                    <td className="py-1.5 pr-2 whitespace-nowrap text-slate-500">
                      {formatDateTime(m.created_at).split(", ")[1] ?? formatDateTime(m.created_at)}
                    </td>
                    <td className="py-1.5 pr-2 font-medium text-slate-800 italic">
                      {venta ? clienteDe(venta.cliente_id) : m.concepto}
                    </td>
                    <td className="py-1.5 pr-2">
                      {venta ? (
                        <span className={badgeClass(esAbono ? "warning" : "info")}>
                          {esAbono ? "Abono" : "Pago inicial"}
                        </span>
                      ) : (
                        "—"
                      )}
                    </td>
                    <td className="py-1.5 pr-2 text-slate-500">{venta ? referidoDe(venta) : "—"}</td>
                    <td className="py-1.5 pr-2">
                      <MetodoBadge metodo={m.metodo_pago} />
                    </td>
                    <td className="py-1.5 pl-2 text-right font-medium text-emerald-600">
                      {formatCOP(m.monto)}
                    </td>
                  </tr>
                );
              })}
              {ingresos.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-4 text-center text-slate-400">
                    Sin ingresos en esta caja.
                  </td>
                </tr>
              ) : null}
            </tbody>
            {ingresos.length > 0 ? (
              <tfoot>
                <tr className="border-t-2 border-slate-800 font-semibold text-slate-900">
                  <td colSpan={5} className="py-1.5 pr-2 text-right">
                    Total ingresos
                  </td>
                  <td className="py-1.5 pl-2 text-right">{formatCOP(totalIngresos)}</td>
                </tr>
              </tfoot>
            ) : null}
          </table>
        </div>

        {/* Ventas pendientes creadas en esta sesión — no generan
            caja_movimientos (no entró plata), así que sin esto un cliente
            que llegó por un tramitador y no pagó nada quedaba invisible en
            el cierre. */}
        {ventasPendientes.length > 0 ? (
          <div className="mt-4">
            <p className="mb-1.5 text-[11px] font-semibold tracking-wide text-amber-600 uppercase">
              Ventas pendientes de esta sesión
            </p>
            <table className="w-full border-collapse text-xs">
              <thead>
                <tr className="border-b border-slate-300 text-left text-slate-500">
                  <th className="py-1.5 pr-2 font-medium">Hora</th>
                  <th className="py-1.5 pr-2 font-medium">Cliente</th>
                  <th className="py-1.5 pr-2 font-medium">Referido</th>
                  <th className="py-1.5 pr-2 text-right font-medium">Total</th>
                  <th className="py-1.5 pr-2 text-right font-medium">Abonado</th>
                  <th className="py-1.5 pl-2 text-right font-medium">Pendiente</th>
                </tr>
              </thead>
              <tbody>
                {ventasPendientes.map((v) => {
                  const pagado = pagadoDePendiente(v.id);
                  const pendiente = v.monto - v.descuento - pagado;
                  return (
                    <tr key={v.id} className="border-b border-slate-100">
                      <td className="py-1.5 pr-2 whitespace-nowrap text-slate-500">
                        {formatDateTime(v.created_at).split(", ")[1] ?? formatDateTime(v.created_at)}
                      </td>
                      <td className="py-1.5 pr-2 font-medium text-slate-800 italic">
                        {clienteDe(v.cliente_id)}
                      </td>
                      <td className="py-1.5 pr-2 text-slate-500">{referidoDe(v)}</td>
                      <td className="py-1.5 pr-2 text-right text-slate-600">{formatCOP(v.monto - v.descuento)}</td>
                      <td className="py-1.5 pr-2 text-right text-slate-600">{formatCOP(pagado)}</td>
                      <td className="py-1.5 pl-2 text-right font-semibold text-amber-700">
                        {formatCOP(pendiente)}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
              <tfoot>
                <tr className="border-t-2 border-slate-800 font-semibold text-slate-900">
                  <td colSpan={5} className="py-1.5 pr-2 text-right">
                    Total pendiente
                  </td>
                  <td className="py-1.5 pl-2 text-right text-amber-700">
                    {formatCOP(
                      ventasPendientes.reduce((acc, v) => acc + (v.monto - v.descuento - pagadoDePendiente(v.id)), 0),
                    )}
                  </td>
                </tr>
              </tfoot>
            </table>
          </div>
        ) : null}

        {/* Detalle de egresos, solo si hubo */}
        {egresos.length > 0 ? (
          <div className="mt-4">
            <p className="mb-1.5 text-[11px] font-semibold tracking-wide text-slate-500 uppercase">
              Egresos del período
            </p>
            <table className="w-full border-collapse text-xs">
              <thead>
                <tr className="border-b border-slate-300 text-left text-slate-500">
                  <th className="py-1.5 pr-2 font-medium">Hora</th>
                  <th className="py-1.5 pr-2 font-medium">Concepto</th>
                  <th className="py-1.5 pr-2 font-medium">Método</th>
                  <th className="py-1.5 pl-2 text-right font-medium">Monto</th>
                </tr>
              </thead>
              <tbody>
                {egresos.map((m) => (
                  <tr key={m.id} className="border-b border-slate-100">
                    <td className="py-1.5 pr-2 whitespace-nowrap text-slate-500">
                      {formatDateTime(m.created_at).split(", ")[1] ?? formatDateTime(m.created_at)}
                    </td>
                    <td className="py-1.5 pr-2 text-slate-700">{m.concepto}</td>
                    <td className="py-1.5 pr-2">
                      <MetodoBadge metodo={m.metodo_pago} />
                    </td>
                    <td className="py-1.5 pl-2 text-right font-medium text-red-600">
                      −{formatCOP(m.monto)}
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr className="border-t-2 border-slate-800 font-semibold text-slate-900">
                  <td colSpan={3} className="py-1.5 pr-2 text-right">
                    Total egresos
                  </td>
                  <td className="py-1.5 pl-2 text-right">−{formatCOP(totalEgresos)}</td>
                </tr>
              </tfoot>
            </table>
          </div>
        ) : null}

        {/* Ventas del día + mensaje de ánimo para mañana */}
        <div className="mt-4 border-t border-slate-200 pt-3">
          <div className="flex items-baseline gap-2">
            <span className="text-xl font-bold text-slate-900">{totalVentasHoy}</span>
            <span className="text-xs font-medium text-slate-500">
              {totalVentasHoy === 1 ? "venta hoy" : "ventas hoy"}
            </span>
          </div>
          <p className="mt-0.5 text-xs text-slate-500">{tramoCierre.mensaje}</p>
        </div>

        {/* Firmas */}
        <div className="mt-8 grid grid-cols-2 gap-8 text-xs">
          <div className="border-t border-slate-400 pt-1.5 text-slate-500">Entregó</div>
          <div className="border-t border-slate-400 pt-1.5 text-slate-500">Recibió</div>
        </div>

          <p className="mt-6 text-center text-[10px] text-slate-400">
            Comprobante generado por Gestia App Conductores — {formatDateTime(new Date().toISOString())}
          </p>
        </div>
      </div>
    </div>
  );
}

/** Badge de método de pago con su color propio — mismo criterio que los
 * chips de "Por método": ícono + etiqueta, nunca solo color. */
function MetodoBadge({ metodo }: { metodo: string | null }) {
  if (!metodo) return <span className="text-slate-400">—</span>;
  const style = METODO_PAGO_STYLE[metodo as MetodoPago] ?? METODO_PAGO_STYLE.otro;
  const Icon = style.icon;
  const label = METODO_PAGO_LABEL[metodo as MetodoPago] ?? metodo;
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full border ${style.border} ${style.bg} ${style.text} px-2 py-0.5 text-[11px] font-medium`}
    >
      <Icon className="h-3 w-3" />
      {label}
    </span>
  );
}

function Kpi({
  label,
  value,
  tone,
  strong,
}: {
  label: string;
  value: string;
  tone?: string;
  strong?: boolean;
}) {
  return (
    <div>
      <p className="text-[10px] text-slate-400 uppercase">{label}</p>
      <p className={`${strong ? "text-sm" : "text-xs"} font-semibold ${tone ?? "text-slate-900"}`}>{value}</p>
    </div>
  );
}
