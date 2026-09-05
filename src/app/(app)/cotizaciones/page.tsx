import type { Metadata } from "next";
import Link from "next/link";
import { Plus } from "lucide-react";
import { getViewerContext, resolveSedeFilter } from "@/lib/viewer";
import { SedeSelect } from "@/components/sede-select";
import { formatCOP, formatDate, formatDateTime } from "@/lib/format";
import type { EstadoCotizacion } from "@/lib/supabase/types";

export const metadata: Metadata = { title: "Cotizaciones | Gestia App Conductores" };

const ESTADO_LABEL: Record<string, { label: string; className: string }> = {
  pendiente: { label: "Pendiente", className: "bg-indigo-100 text-indigo-700" },
  convertida: { label: "Convertida", className: "bg-emerald-100 text-emerald-700" },
  rechazada: { label: "Rechazada", className: "bg-slate-100 text-slate-500" },
};

export default async function CotizacionesPage({
  searchParams,
}: {
  searchParams: Promise<{ sede?: string; estado?: string }>;
}) {
  const { sede: sedeParam, estado: estadoParam } = await searchParams;
  const ctx = await getViewerContext();
  const { supabase, profile, sedes } = ctx;
  const sedeFilter = resolveSedeFilter(ctx, sedeParam);

  let query = supabase
    .from("cotizaciones")
    .select("id, sede_id, cliente_id, concepto, monto, estado, valida_hasta, created_at")
    .order("created_at", { ascending: false })
    .limit(100);

  if (sedeFilter) query = query.eq("sede_id", sedeFilter);
  if (estadoParam) query = query.eq("estado", estadoParam as EstadoCotizacion);

  const { data: cotizaciones } = await query;

  const clienteIds = [...new Set((cotizaciones ?? []).map((c) => c.cliente_id))];
  const { data: clientesRows } = clienteIds.length
    ? await supabase.from("clientes").select("id, nombre_completo").in("id", clienteIds)
    : { data: [] };
  const clienteName = (id: string) => clientesRows?.find((c) => c.id === id)?.nombre_completo ?? "—";
  const sedeName = (id: string) => sedes.find((s) => s.id === id)?.name ?? "—";

  const todayStr = new Date().toISOString().slice(0, 10);

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold text-slate-900">Cotizaciones</h1>
        <div className="flex items-center gap-2">
          <SedeSelect sedes={sedes} currentSedeId={sedeFilter} allowAll={profile.role === "admin"} />
          <Link
            href="/cotizaciones/nueva"
            className="flex items-center gap-1.5 rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white shadow-sm shadow-indigo-600/20 transition hover:bg-indigo-700"
          >
            <Plus className="h-4 w-4" />
            Nueva cotización
          </Link>
        </div>
      </div>

      <form className="flex flex-wrap items-center gap-2">
        <input type="hidden" name="sede" value={sedeParam ?? ""} />
        <select
          name="estado"
          defaultValue={estadoParam ?? ""}
          className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-700 outline-none focus:border-indigo-600"
        >
          <option value="">Todos los estados</option>
          <option value="pendiente">Pendiente</option>
          <option value="convertida">Convertida</option>
          <option value="rechazada">Rechazada</option>
        </select>
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
              <th className="px-4 py-3">Válida hasta</th>
              <th className="px-4 py-3">Estado</th>
              <th className="px-4 py-3 text-right">Monto</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {(cotizaciones ?? []).map((c) => {
              const estado = ESTADO_LABEL[c.estado] ?? ESTADO_LABEL.pendiente;
              const vencida = c.estado === "pendiente" && c.valida_hasta && c.valida_hasta < todayStr;
              return (
                <tr key={c.id}>
                  <td className="px-4 py-3 text-slate-500">{formatDateTime(c.created_at)}</td>
                  <td className="px-4 py-3 font-medium text-slate-800">
                    <Link href={`/cotizaciones/${c.id}`} className="text-indigo-700 hover:underline">
                      {clienteName(c.cliente_id)}
                    </Link>
                  </td>
                  <td className="px-4 py-3 text-slate-600">{c.concepto}</td>
                  {profile.role === "admin" && !sedeFilter ? (
                    <td className="px-4 py-3 text-slate-600">{sedeName(c.sede_id)}</td>
                  ) : null}
                  <td className="px-4 py-3 text-slate-600">
                    {c.valida_hasta ? formatDate(c.valida_hasta) : "—"}
                  </td>
                  <td className="px-4 py-3">
                    <span className={`rounded-full px-2 py-0.5 text-[11px] font-medium ${estado.className}`}>
                      {estado.label}
                    </span>
                    {vencida ? (
                      <span className="ml-1.5 rounded-full bg-red-100 px-2 py-0.5 text-[11px] font-medium text-red-700">
                        Vencida
                      </span>
                    ) : null}
                  </td>
                  <td className="px-4 py-3 text-right font-medium text-slate-800">{formatCOP(c.monto)}</td>
                </tr>
              );
            })}
            {(cotizaciones ?? []).length === 0 ? (
              <tr>
                <td colSpan={7} className="px-4 py-8 text-center text-slate-400">
                  Todavía no hay cotizaciones.
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>
    </div>
  );
}
