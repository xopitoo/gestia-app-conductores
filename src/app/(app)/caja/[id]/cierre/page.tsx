import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getViewerContext } from "@/lib/viewer";
import { formatCOP, formatDateTime } from "@/lib/format";
import { METODO_PAGO_LABEL } from "@/lib/supabase/types";
import { PrintButton } from "@/components/print-button";

export const metadata: Metadata = { title: "Cierre de caja | Gestia App Conductores" };

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

  const [{ data: sede }, { data: movimientos }, { data: perfiles }] = await Promise.all([
    supabase.from("sedes").select("name").eq("id", sesion.sede_id).maybeSingle(),
    supabase
      .from("caja_movimientos")
      .select("id, tipo, concepto, monto, metodo_pago, created_at")
      .eq("caja_sesion_id", id)
      .order("created_at"),
    supabase
      .from("profiles")
      .select("id, full_name")
      .in("id", [sesion.opened_by, sesion.closed_by].filter((v): v is string => !!v)),
  ]);

  const nombreDe = (userId: string | null) =>
    (perfiles ?? []).find((p) => p.id === userId)?.full_name ?? "—";

  const ingresos = (movimientos ?? []).filter((m) => m.tipo === "ingreso");
  const egresos = (movimientos ?? []).filter((m) => m.tipo === "egreso");
  const totalIngresos = ingresos.reduce((acc, m) => acc + m.monto, 0);
  const totalEgresos = egresos.reduce((acc, m) => acc + m.monto, 0);
  const saldoTeorico = sesion.opening_balance + totalIngresos - totalEgresos;
  const totalesPorMetodo = new Map<string, number>();
  for (const m of ingresos) {
    const label = m.metodo_pago ? (METODO_PAGO_LABEL[m.metodo_pago] ?? m.metodo_pago) : "—";
    totalesPorMetodo.set(label, (totalesPorMetodo.get(label) ?? 0) + m.monto);
  }

  return (
    <div className="flex flex-col items-center gap-4">
      <div className="print:hidden">
        <PrintButton />
      </div>

      <div className="w-[8.5in] max-w-full rounded-2xl border border-slate-200 bg-white p-8 text-sm text-slate-800 print:w-auto print:rounded-none print:border-none print:p-0">
        <div className="flex items-start justify-between border-b border-slate-300 pb-3">
          <div>
            <h1 className="text-lg font-bold text-slate-900">{organization.name}</h1>
            <p className="text-xs text-slate-500">{sede?.name}</p>
          </div>
          <div className="text-right text-xs text-slate-500">
            <p>Cierre de caja</p>
            <p className="font-mono">#{sesion.id.slice(0, 8)}</p>
          </div>
        </div>

        <div className="mt-3 grid grid-cols-2 gap-3 border-b border-slate-200 pb-3 text-xs sm:grid-cols-4">
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
          <div>
            <p className="text-slate-400">Base inicial</p>
            <p className="font-medium text-slate-800">{formatCOP(sesion.opening_balance)}</p>
          </div>
          <div>
            <p className="text-slate-400">Saldo de cierre contado</p>
            <p className="font-medium text-slate-800">
              {sesion.closing_balance != null ? formatCOP(sesion.closing_balance) : "—"}
            </p>
          </div>
        </div>

        <div className="mt-3 grid grid-cols-2 gap-3 border-b border-slate-200 pb-3 sm:grid-cols-4">
          <div>
            <p className="text-xs text-slate-400">Ingresos totales</p>
            <p className="font-semibold text-emerald-600">{formatCOP(totalIngresos)}</p>
          </div>
          <div>
            <p className="text-xs text-slate-400">Egresos totales</p>
            <p className="font-semibold text-red-600">{formatCOP(totalEgresos)}</p>
          </div>
          <div>
            <p className="text-xs text-slate-400">Saldo teórico</p>
            <p className="font-semibold text-slate-900">{formatCOP(saldoTeorico)}</p>
          </div>
          <div>
            <p className="text-xs text-slate-400">Diferencia vs. contado</p>
            <p
              className={`font-semibold ${
                sesion.closing_balance == null
                  ? "text-slate-400"
                  : sesion.closing_balance - saldoTeorico === 0
                    ? "text-emerald-600"
                    : "text-amber-700"
              }`}
            >
              {sesion.closing_balance != null ? formatCOP(sesion.closing_balance - saldoTeorico) : "—"}
            </p>
          </div>
        </div>

        {totalesPorMetodo.size > 0 ? (
          <div className="mt-3 border-b border-slate-200 pb-3">
            <p className="mb-1 text-xs text-slate-400">Ingresos por método de pago</p>
            <ul className="flex flex-wrap gap-x-6 gap-y-1 text-xs">
              {[...totalesPorMetodo.entries()].map(([label, monto]) => (
                <li key={label} className="flex items-center gap-1.5">
                  <span className="text-slate-500">{label}</span>
                  <span className="font-medium text-slate-800">{formatCOP(monto)}</span>
                </li>
              ))}
            </ul>
          </div>
        ) : null}

        <div className="mt-3">
          <p className="mb-1 text-xs text-slate-400">Detalle de movimientos</p>
          <ul className="flex flex-col divide-y divide-slate-100 text-xs">
            {(movimientos ?? []).map((m) => (
              <li key={m.id} className="flex items-center justify-between gap-3 py-1.5">
                <div className="min-w-0">
                  <p className="truncate text-slate-700">{m.concepto}</p>
                  <p className="text-slate-400">
                    {formatDateTime(m.created_at)}
                    {m.metodo_pago ? ` · ${METODO_PAGO_LABEL[m.metodo_pago] ?? m.metodo_pago}` : ""}
                  </p>
                </div>
                <span className={m.tipo === "ingreso" ? "text-emerald-600" : "text-red-600"}>
                  {m.tipo === "ingreso" ? "+" : "−"}
                  {formatCOP(m.monto)}
                </span>
              </li>
            ))}
            {(movimientos ?? []).length === 0 ? (
              <li className="py-4 text-center text-slate-400">Sin movimientos en esta caja.</li>
            ) : null}
          </ul>
        </div>

        <p className="mt-6 text-center text-[10px] text-slate-400">
          Comprobante generado por Gestia App Conductores — {formatDateTime(new Date().toISOString())}
        </p>
      </div>
    </div>
  );
}
