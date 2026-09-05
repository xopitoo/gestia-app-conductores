import type { Metadata } from "next";
import Link from "next/link";
import { GraduationCap, Plus, UserPlus } from "lucide-react";
import { getViewerContext, requireOpenCaja, resolveSedeFilter } from "@/lib/viewer";
import { SedeSelect } from "@/components/sede-select";
import { ConfirmSubmitButton } from "@/components/confirm-submit-button";
import { formatCOP, formatDateTime } from "@/lib/format";
import { anularVenta } from "./actions";
import { METODO_PAGO_LABEL, type EstadoVenta } from "@/lib/supabase/types";

export const metadata: Metadata = { title: "Ventas | Gestia App Conductores" };

const ESTADO_LABEL: Record<string, { label: string; className: string }> = {
  pagada: { label: "Pagada", className: "bg-emerald-100 text-emerald-700" },
  abonada: { label: "Abonada", className: "bg-amber-100 text-amber-700" },
  anulada: { label: "Anulada", className: "bg-slate-100 text-slate-500" },
};

function monthRange() {
  const now = new Date();
  const desde = new Date(now.getFullYear(), now.getMonth(), 1);
  const hasta = new Date(now.getFullYear(), now.getMonth() + 1, 1);
  return { desde: desde.toISOString().slice(0, 10), hasta: hasta.toISOString().slice(0, 10) };
}

export default async function VentasPage({
  searchParams,
}: {
  searchParams: Promise<{
    sede?: string;
    q?: string;
    metodo?: string;
    estado?: string;
    desde?: string;
    hasta?: string;
  }>;
}) {
  const params = await searchParams;
  const ctx = await getViewerContext();
  await requireOpenCaja(ctx);
  const { supabase, profile, sedes } = ctx;
  const sedeFilter = resolveSedeFilter(ctx, params.sede);

  const defaultRange = monthRange();
  const desde = params.desde || defaultRange.desde;
  const hasta = params.hasta || defaultRange.hasta;

  let query = supabase
    .from("ventas")
    .select(
      "id, sede_id, cliente_id, concepto, monto, descuento, estado, vendedor_id, certificado, created_at",
    )
    .gte("created_at", desde)
    .lt("created_at", hasta)
    .order("created_at", { ascending: false });

  if (sedeFilter) query = query.eq("sede_id", sedeFilter);
  if (params.estado) query = query.eq("estado", params.estado as EstadoVenta);

  const { data: ventas } = await query;

  const clienteIds = [...new Set((ventas ?? []).map((v) => v.cliente_id))];
  const ventaIds = (ventas ?? []).map((v) => v.id);

  const [{ data: clientesRows }, { data: pagosRows }] = await Promise.all([
    clienteIds.length
      ? supabase.from("clientes").select("id, nombre_completo, numero_documento").in("id", clienteIds)
      : Promise.resolve({ data: [] }),
    ventaIds.length
      ? supabase.from("venta_pagos").select("venta_id, metodo_pago, monto").in("venta_id", ventaIds)
      : Promise.resolve({ data: [] }),
  ]);

  const clienteName = (id: string) => clientesRows?.find((c) => c.id === id)?.nombre_completo ?? "—";
  const metodosDeVenta = (id: string) =>
    [...new Set((pagosRows ?? []).filter((p) => p.venta_id === id).map((p) => p.metodo_pago))];
  const pagadoDeVenta = (id: string) =>
    (pagosRows ?? []).filter((p) => p.venta_id === id).reduce((acc, p) => acc + p.monto, 0);

  let filtered = params.q
    ? (ventas ?? []).filter((v) => clienteName(v.cliente_id).toLowerCase().includes(params.q!.toLowerCase()))
    : (ventas ?? []);

  if (params.metodo) {
    const metodoParam = params.metodo;
    filtered = filtered.filter((v) => metodosDeVenta(v.id).some((m) => m === metodoParam));
  }

  const sedeName = (id: string) => sedes.find((s) => s.id === id)?.name ?? "—";

  const ordenes = filtered.filter((v) => v.estado !== "anulada").length;

  const pagosPeriodoQuery = supabase
    .from("venta_pagos")
    .select("monto, sede_id")
    .gte("created_at", desde)
    .lt("created_at", hasta);
  const { data: pagosPeriodo } = sedeFilter
    ? await pagosPeriodoQuery.eq("sede_id", sedeFilter)
    : await pagosPeriodoQuery;
  const ingresoTotal = (pagosPeriodo ?? []).reduce((acc, p) => acc + p.monto, 0);

  const cajaFilter = supabase
    .from("caja_movimientos")
    .select("monto, sede_id")
    .eq("tipo", "egreso")
    .gte("created_at", desde)
    .lt("created_at", hasta);
  const { data: egresosRows } = sedeFilter
    ? await cajaFilter.eq("sede_id", sedeFilter)
    : await cajaFilter;
  const egresos = (egresosRows ?? []).reduce((acc, e) => acc + e.monto, 0);
  const balanceNeto = ingresoTotal - egresos;

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold text-slate-900">Ventas</h1>
        <div className="flex items-center gap-2">
          <SedeSelect sedes={sedes} currentSedeId={sedeFilter} allowAll={profile.role === "admin"} />
          <Link
            href="/clientes/nuevo"
            className="flex items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
          >
            <UserPlus className="h-4 w-4" />
            Crear cliente
          </Link>
          <Link
            href="/ventas/nueva"
            className="flex items-center gap-1.5 rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white shadow-sm shadow-indigo-600/20 transition hover:bg-indigo-700"
          >
            <Plus className="h-4 w-4" />
            Registrar nueva orden
          </Link>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <KpiCard label="Ingreso total" value={formatCOP(ingresoTotal)} caption="Cobrado en el período (incl. abonos)" tone="emerald" />
        <KpiCard label="Egresos" value={formatCOP(egresos)} caption="Gastos operativos del período" tone="red" />
        <KpiCard label="Balance neto" value={formatCOP(balanceNeto)} caption="Ingresos - egresos" tone="indigo" />
        <KpiCard label="Órdenes" value={String(ordenes)} caption="Ventas del período (sin anuladas)" tone="slate" />
      </div>

      <form className="flex flex-wrap items-center gap-2">
        <input type="hidden" name="sede" value={params.sede ?? ""} />
        <input
          name="q"
          defaultValue={params.q}
          placeholder="Buscar cliente..."
          className="rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900 outline-none focus:border-indigo-600 focus:ring-1 focus:ring-indigo-600"
        />
        <select
          name="metodo"
          defaultValue={params.metodo ?? ""}
          className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-700 outline-none focus:border-indigo-600"
        >
          <option value="">Todos los métodos</option>
          {Object.entries(METODO_PAGO_LABEL).map(([value, label]) => (
            <option key={value} value={value}>
              {label}
            </option>
          ))}
        </select>
        <select
          name="estado"
          defaultValue={params.estado ?? ""}
          className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-700 outline-none focus:border-indigo-600"
        >
          <option value="">Todos los estados</option>
          <option value="pagada">Pagada</option>
          <option value="abonada">Abonada</option>
          <option value="anulada">Anulada</option>
        </select>
        <input type="date" name="desde" defaultValue={desde} className="rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-700 outline-none focus:border-indigo-600" />
        <input type="date" name="hasta" defaultValue={hasta} className="rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-700 outline-none focus:border-indigo-600" />
        <button type="submit" className="rounded-lg border border-slate-300 px-3 py-2 text-sm font-medium text-slate-600 transition hover:bg-slate-100">
          Filtrar
        </button>
      </form>

      <div className="overflow-x-auto rounded-2xl border border-slate-200 bg-white">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 text-left text-xs font-medium text-slate-500">
            <tr>
              <th className="px-4 py-3">Fecha</th>
              <th className="px-4 py-3">Cliente</th>
              <th className="px-4 py-3">Concepto</th>
              {profile.role === "admin" && !sedeFilter ? <th className="px-4 py-3">Sede</th> : null}
              <th className="px-4 py-3">Método</th>
              <th className="px-4 py-3">Estado</th>
              <th className="px-4 py-3 text-right">Pagado / Total</th>
              {profile.role === "admin" ? <th className="px-4 py-3" /> : null}
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {filtered.map((v) => {
              const estado = ESTADO_LABEL[v.estado] ?? ESTADO_LABEL.pagada;
              const metodos = metodosDeVenta(v.id);
              const pagado = pagadoDeVenta(v.id);
              return (
                <tr key={v.id}>
                  <td className="px-4 py-3 text-slate-500">{formatDateTime(v.created_at)}</td>
                  <td className="px-4 py-3 font-medium text-slate-800">
                    <Link href={`/ventas/${v.id}`} className="text-indigo-700 hover:underline">
                      {clienteName(v.cliente_id)}
                    </Link>
                  </td>
                  <td className="px-4 py-3 text-slate-600">{v.concepto}</td>
                  {profile.role === "admin" && !sedeFilter ? (
                    <td className="px-4 py-3 text-slate-600">{sedeName(v.sede_id)}</td>
                  ) : null}
                  <td className="px-4 py-3 text-slate-600">
                    {metodos.map((m) => METODO_PAGO_LABEL[m] ?? m).join(", ") || "—"}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex flex-wrap items-center gap-1">
                      <span className={`rounded-full px-2 py-0.5 text-[11px] font-medium ${estado.className}`}>
                        {estado.label}
                      </span>
                      {v.certificado ? (
                        <span
                          title="Certificado RUNT subido"
                          className="inline-flex items-center gap-1 rounded-full bg-indigo-100 px-2 py-0.5 text-[11px] font-medium text-indigo-700"
                        >
                          <GraduationCap className="h-3 w-3" aria-hidden="true" />
                          RUNT
                        </span>
                      ) : v.estado === "pagada" ? (
                        <span
                          title="Falta subir el certificado RUNT — para la auditoría"
                          className="inline-flex items-center gap-1 rounded-full bg-amber-100 px-2 py-0.5 text-[11px] font-medium text-amber-700"
                        >
                          <GraduationCap className="h-3 w-3" aria-hidden="true" />
                          Sin RUNT
                        </span>
                      ) : null}
                    </div>
                  </td>
                  <td className="px-4 py-3 text-right font-medium text-slate-800">
                    {v.estado === "abonada" ? `${formatCOP(pagado)} / ${formatCOP(v.monto - v.descuento)}` : formatCOP(v.monto - v.descuento)}
                    {v.descuento > 0 ? (
                      <div className="text-[11px] font-normal text-emerald-600">
                        Desc. {formatCOP(v.descuento)}
                      </div>
                    ) : null}
                  </td>
                  {profile.role === "admin" ? (
                    <td className="px-4 py-3 text-right">
                      {v.estado !== "anulada" ? (
                        <form action={anularVenta}>
                          <input type="hidden" name="id" value={v.id} />
                          <ConfirmSubmitButton
                            confirmMessage="¿Anular esta venta?"
                            className="text-xs font-medium text-red-600 hover:underline"
                          >
                            Anular
                          </ConfirmSubmitButton>
                        </form>
                      ) : null}
                    </td>
                  ) : null}
                </tr>
              );
            })}
            {filtered.length === 0 ? (
              <tr>
                <td colSpan={8} className="px-4 py-8 text-center text-slate-400">
                  No hay ventas registradas en este período.
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function KpiCard({
  label,
  value,
  caption,
  tone,
}: {
  label: string;
  value: string;
  caption: string;
  tone: "emerald" | "red" | "indigo" | "slate";
}) {
  const toneClass = {
    emerald: "text-emerald-600",
    red: "text-red-600",
    indigo: "text-indigo-600",
    slate: "text-slate-800",
  }[tone];

  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-5">
      <h2 className="text-xs font-semibold tracking-wide text-slate-500 uppercase">{label}</h2>
      <p className={`mt-2 text-2xl font-semibold ${toneClass}`}>{value}</p>
      <p className="mt-1 text-xs text-slate-400">{caption}</p>
    </div>
  );
}
