import type { Metadata } from "next";
import { getViewerContext, resolveSedeFilter, resolveSedeId } from "@/lib/viewer";
import { SedeSelect } from "@/components/sede-select";
import { formatCOP } from "@/lib/format";
import { METODO_PAGO_LABEL, type MetodoPago } from "@/lib/supabase/types";
import { bogotaTodayRange, addDaysUTC } from "@/lib/bogota-date";
import { DailyChart } from "./daily-chart";
import { MonthlyYearChart } from "./monthly-year-chart";
import { PaymentBreakdown } from "./payment-breakdown";
import { RecepcionistaDashboard } from "./recepcionista-dashboard";

export const metadata: Metadata = { title: "Dashboard | Gestia App Conductores" };

export default async function DashboardPage({
  searchParams,
}: {
  searchParams: Promise<{ sede?: string }>;
}) {
  const { sede: sedeParam } = await searchParams;
  const ctx = await getViewerContext();
  const { supabase, profile, sedes } = ctx;

  const now = new Date();
  // "Hoy" siempre en hora de Bogotá, sin importar el huso horario del
  // servidor — si no, una venta de las 7-11pm Bogotá (medianoche+ UTC)
  // aparecía como "de mañana", o desaparecía al día siguiente antes de
  // tiempo.
  const { start: hoy, end: manana } = bogotaTodayRange(now);

  // Las gráficas, comparaciones y el ranking de cursos son solo para admin
  // — un recepcionista ve en cambio una lista simple de lo que se vendió
  // hoy en su sede, con lo abonado/pendiente de cada venta.
  if (profile.role !== "admin") {
    const sedeId = resolveSedeId(ctx, sedeParam);

    let ventasHoyQuery = supabase
      .from("ventas")
      .select("id, cliente_id, monto, descuento, created_at")
      .gte("created_at", hoy.toISOString())
      .lt("created_at", manana.toISOString())
      .neq("estado", "anulada")
      .order("created_at", { ascending: false });
    if (sedeId) ventasHoyQuery = ventasHoyQuery.eq("sede_id", sedeId);
    const { data: ventasHoy } = await ventasHoyQuery;

    const ventaIds = (ventasHoy ?? []).map((v) => v.id);
    const clienteIds = [...new Set((ventasHoy ?? []).map((v) => v.cliente_id))];

    let egresosQuery = supabase
      .from("caja_movimientos")
      .select("id, concepto, monto, metodo_pago, created_at")
      .eq("tipo", "egreso")
      .gte("created_at", hoy.toISOString())
      .lt("created_at", manana.toISOString())
      .order("created_at", { ascending: false });
    if (sedeId) egresosQuery = egresosQuery.eq("sede_id", sedeId);

    const [{ data: pagosRows }, { data: clientesRows }, { data: egresosRows }, { data: sesionAbierta }] =
      await Promise.all([
        ventaIds.length
          ? supabase.from("venta_pagos").select("venta_id, monto, metodo_pago").in("venta_id", ventaIds)
          : Promise.resolve({ data: [] as { venta_id: string; monto: number; metodo_pago: MetodoPago }[] }),
        clienteIds.length
          ? supabase.from("clientes").select("id, nombre_completo").in("id", clienteIds)
          : Promise.resolve({ data: [] as { id: string; nombre_completo: string }[] }),
        egresosQuery,
        sedeId
          ? supabase.from("caja_sesiones").select("id").eq("sede_id", sedeId).eq("estado", "abierta").maybeSingle()
          : Promise.resolve({ data: null }),
      ]);

    const ventasFilas = (ventasHoy ?? []).map((v) => {
      const pagos = (pagosRows ?? []).filter((p) => p.venta_id === v.id);
      const abonado = pagos.reduce((acc, p) => acc + p.monto, 0);
      const metodos = [...new Set(pagos.map((p) => METODO_PAGO_LABEL[p.metodo_pago] ?? p.metodo_pago))].join(
        ", ",
      );
      return {
        id: v.id,
        createdAt: v.created_at,
        clienteNombre: clientesRows?.find((c) => c.id === v.cliente_id)?.nombre_completo ?? "—",
        metodos,
        abonado,
        debe: v.monto - v.descuento - abonado,
      };
    });

    const egresosFilas = (egresosRows ?? []).map((e) => ({
      id: e.id,
      createdAt: e.created_at,
      concepto: e.concepto,
      monto: e.monto,
      metodo: e.metodo_pago ? (METODO_PAGO_LABEL[e.metodo_pago] ?? e.metodo_pago) : null,
    }));

    return (
      <RecepcionistaDashboard ventas={ventasFilas} egresos={egresosFilas} cajaAbierta={!!sesionAbierta} />
    );
  }

  const sedeFilter = resolveSedeFilter(ctx, sedeParam);
  const inicioMes = new Date(now.getFullYear(), now.getMonth(), 1);
  const finMes = new Date(now.getFullYear(), now.getMonth() + 1, 1);
  const inicioSemana = addDaysUTC(hoy, -6); // últimos 7 días, incl. hoy

  const anioActual = now.getFullYear();
  const anioAnterior = anioActual - 1;
  const inicioAnioAnterior = new Date(anioAnterior, 0, 1);
  const inicioAnioSiguiente = new Date(anioActual + 1, 0, 1);

  // Todas las ventas de los últimos dos años en un solo fetch: de acá salen
  // los KPIs de hoy/mes, la comparación mensual año actual vs anterior, y
  // (vía venta_items) el conteo de cursos y el ranking por año.
  let ventasAniosQuery = supabase
    .from("ventas")
    .select("id, monto, created_at")
    .gte("created_at", inicioAnioAnterior.toISOString())
    .lt("created_at", inicioAnioSiguiente.toISOString())
    .neq("estado", "anulada");
  if (sedeFilter) ventasAniosQuery = ventasAniosQuery.eq("sede_id", sedeFilter);
  const { data: ventasAnios } = await ventasAniosQuery;

  const actualPorMes = Array(12).fill(0) as number[];
  const anteriorPorMes = Array(12).fill(0) as number[];
  const ventaYearMap = new Map<string, number>();
  let ventasHoyMonto = 0;
  let ventasMesMonto = 0;
  let ventasMesCount = 0;

  for (const v of ventasAnios ?? []) {
    const d = new Date(v.created_at);
    const y = d.getFullYear();
    ventaYearMap.set(v.id, y);
    if (y === anioActual) actualPorMes[d.getMonth()] += v.monto;
    else if (y === anioAnterior) anteriorPorMes[d.getMonth()] += v.monto;
    if (d >= hoy) ventasHoyMonto += v.monto;
    if (d >= inicioMes && d < finMes) {
      ventasMesMonto += v.monto;
      ventasMesCount += 1;
    }
  }

  // Saldo pendiente: ventas abonadas (no acotado a los últimos dos años a
  // propósito — es un saldo corriente, no algo del período).
  let abonadasQuery = supabase.from("ventas").select("id, monto, descuento").eq("estado", "abonada");
  if (sedeFilter) abonadasQuery = abonadasQuery.eq("sede_id", sedeFilter);
  const { data: abonadas } = await abonadasQuery;
  const abonadaIds = (abonadas ?? []).map((v) => v.id);
  const { data: pagosDeAbonadas } = abonadaIds.length
    ? await supabase.from("venta_pagos").select("venta_id, monto").in("venta_id", abonadaIds)
    : { data: [] };
  const pendiente = (abonadas ?? []).reduce((acc, v) => {
    const pagado = (pagosDeAbonadas ?? [])
      .filter((p) => p.venta_id === v.id)
      .reduce((a, p) => a + p.monto, 0);
    return acc + (v.monto - v.descuento - pagado);
  }, 0);

  // Cursos vendidos y ranking: por producto/ítem, no por venta (una venta
  // puede tener varios cursos).
  const ventaIdsAnios = (ventasAnios ?? []).map((v) => v.id);
  const { data: itemsAnios } = ventaIdsAnios.length
    ? await supabase.from("venta_items").select("venta_id, nombre, precio").in("venta_id", ventaIdsAnios)
    : { data: [] };

  let cursosAnioActual = 0;
  let cursosAnioAnterior = 0;
  const rankingActual = new Map<string, { cantidad: number; monto: number }>();
  for (const item of itemsAnios ?? []) {
    const y = ventaYearMap.get(item.venta_id);
    if (y === anioActual) {
      cursosAnioActual += 1;
      const r = rankingActual.get(item.nombre) ?? { cantidad: 0, monto: 0 };
      r.cantidad += 1;
      r.monto += item.precio;
      rankingActual.set(item.nombre, r);
    } else if (y === anioAnterior) {
      cursosAnioAnterior += 1;
    }
  }
  const topServicios = [...rankingActual.entries()].sort((a, b) => b[1].cantidad - a[1].cantidad).slice(0, 10);
  const deltaCursos =
    cursosAnioAnterior > 0
      ? Math.round(((cursosAnioActual - cursosAnioAnterior) / cursosAnioAnterior) * 100)
      : null;

  // Pagos: un solo fetch que cubre tanto la ventana de 7 días (para el
  // gráfico diario) como el mes completo (para recaudado + forma de pago),
  // arrancando desde lo que sea más temprano de los dos.
  const desdePagos = inicioSemana < inicioMes ? inicioSemana : inicioMes;
  let pagosQuery = supabase
    .from("venta_pagos")
    .select("monto, metodo_pago, sede_id, created_at")
    .gte("created_at", desdePagos.toISOString())
    .lt("created_at", finMes.toISOString());
  if (sedeFilter) pagosQuery = pagosQuery.eq("sede_id", sedeFilter);
  const { data: pagos } = await pagosQuery;

  const recaudadoMes = (pagos ?? [])
    .filter((p) => new Date(p.created_at) >= inicioMes)
    .reduce((acc, p) => acc + p.monto, 0);

  const dias: { fecha: Date; total: number }[] = [];
  for (let i = 0; i < 7; i++) {
    const fecha = addDaysUTC(inicioSemana, i);
    const siguiente = addDaysUTC(fecha, 1);
    const total = (pagos ?? [])
      .filter((p) => {
        const t = new Date(p.created_at);
        return t >= fecha && t < siguiente;
      })
      .reduce((acc, p) => acc + p.monto, 0);
    dias.push({ fecha, total });
  }

  const totalesPorMetodo: Partial<Record<MetodoPago, number>> = {};
  for (const p of pagos ?? []) {
    if (new Date(p.created_at) < inicioMes) continue;
    totalesPorMetodo[p.metodo_pago] = (totalesPorMetodo[p.metodo_pago] ?? 0) + p.monto;
  }

  // Clientes activos en el alcance actual.
  let clientesQuery = supabase.from("clientes").select("id", { count: "exact", head: true }).eq("active", true);
  if (sedeFilter) clientesQuery = clientesQuery.eq("sede_id", sedeFilter);
  const { count: clientesCount } = await clientesQuery;

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold text-slate-900">Dashboard</h1>
        <SedeSelect sedes={sedes} currentSedeId={sedeFilter} allowAll={profile.role === "admin"} />
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <KpiCard label="Ventas hoy" value={formatCOP(ventasHoyMonto)} tone="indigo" />
        <KpiCard label="Ventas del mes" value={formatCOP(ventasMesMonto)} tone="indigo" />
        <KpiCard label="Pendiente por cobrar" value={formatCOP(pendiente)} tone="amber" />
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <KpiCard label="Órdenes del mes" value={String(ventasMesCount)} tone="slate" compact />
        <KpiCard label="Clientes activos" value={String(clientesCount ?? 0)} tone="slate" compact />
        <KpiCard label="Recaudado del mes" value={formatCOP(recaudadoMes)} tone="emerald" compact />
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <div className="rounded-2xl border border-slate-200 bg-white p-5 lg:col-span-2">
          <h2 className="mb-4 text-sm font-semibold text-slate-800">Recaudo — últimos 7 días</h2>
          <DailyChart dias={dias} />
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-5">
          <h2 className="mb-3 text-sm font-semibold text-slate-800">Forma de pago — este mes</h2>
          <PaymentBreakdown totales={totalesPorMetodo} />
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <div className="rounded-2xl border border-slate-200 bg-white p-5 lg:col-span-2">
          <h2 className="mb-4 text-sm font-semibold text-slate-800">
            Ventas por mes — {anioActual} vs {anioAnterior}
          </h2>
          <MonthlyYearChart
            actual={actualPorMes}
            anterior={anteriorPorMes}
            anioActual={anioActual}
            anioAnterior={anioAnterior}
          />
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-5">
          <h2 className="mb-3 text-sm font-semibold text-slate-800">Cursos vendidos por año</h2>
          <div className="flex flex-col gap-3">
            <div className="flex items-center justify-between">
              <span className="text-sm text-slate-600">{anioActual}</span>
              <span className="text-lg font-semibold text-indigo-600">{cursosAnioActual}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm text-slate-600">{anioAnterior}</span>
              <span className="text-lg font-semibold text-slate-500">{cursosAnioAnterior}</span>
            </div>
            {deltaCursos !== null ? (
              <p className={`text-xs ${deltaCursos >= 0 ? "text-emerald-600" : "text-red-600"}`}>
                {deltaCursos >= 0 ? "+" : ""}
                {deltaCursos}% vs {anioAnterior}
              </p>
            ) : null}
          </div>
        </div>
      </div>

      <div className="rounded-2xl border border-slate-200 bg-white p-5">
        <h2 className="mb-3 text-sm font-semibold text-slate-800">Ranking de cursos más vendidos — {anioActual}</h2>
        {topServicios.length === 0 ? (
          <p className="py-6 text-center text-sm text-slate-400">Todavía no hay ventas este año.</p>
        ) : (
          <ol className="grid grid-cols-1 gap-2.5 sm:grid-cols-2">
            {topServicios.map(([nombre, { cantidad, monto }], i) => (
              <li key={nombre} className="flex items-center gap-3 text-sm">
                <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-indigo-100 text-xs font-bold text-indigo-700">
                  {i + 1}
                </span>
                <span className="min-w-0 flex-1 truncate text-slate-700">{nombre}</span>
                <span className="shrink-0 text-right text-xs text-slate-400">
                  {cantidad} {cantidad === 1 ? "venta" : "ventas"}
                  <br />
                  {formatCOP(monto)}
                </span>
              </li>
            ))}
          </ol>
        )}
      </div>
    </div>
  );
}

function KpiCard({
  label,
  value,
  tone,
  compact,
}: {
  label: string;
  value: string;
  tone: "indigo" | "amber" | "emerald" | "slate";
  compact?: boolean;
}) {
  const toneClass = {
    indigo: "text-indigo-600",
    amber: "text-amber-600",
    emerald: "text-emerald-600",
    slate: "text-slate-800",
  }[tone];

  return (
    <div className={`rounded-2xl border border-slate-200 bg-white ${compact ? "p-4" : "p-5"}`}>
      <h2 className="text-xs font-semibold tracking-wide text-slate-500 uppercase">{label}</h2>
      <p className={`mt-1.5 font-semibold ${toneClass} ${compact ? "text-lg" : "text-2xl"}`}>{value}</p>
    </div>
  );
}
