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
      .select("id, tipo, concepto, monto, metodo_pago, venta_id, created_at")
      .eq("caja_sesion_id", id)
      .order("created_at"),
    supabase
      .from("profiles")
      .select("id, full_name")
      .in("id", [sesion.opened_by, sesion.closed_by].filter((v): v is string => !!v)),
  ]);

  const ventaIds = [...new Set((movimientos ?? []).map((m) => m.venta_id).filter((v): v is string => !!v))];
  const { data: ventas } =
    ventaIds.length > 0
      ? await supabase.from("ventas").select("id, cliente_id, referido_nombre").in("id", ventaIds)
      : { data: [] };

  const clienteIds = [...new Set((ventas ?? []).map((v) => v.cliente_id))];
  const { data: clientes } =
    clienteIds.length > 0
      ? await supabase.from("clientes").select("id, nombre_completo").in("id", clienteIds)
      : { data: [] };

  const ventaDe = (ventaId: string | null) => (ventas ?? []).find((v) => v.id === ventaId) ?? null;
  const clienteDe = (clienteId: string | undefined) =>
    (clientes ?? []).find((c) => c.id === clienteId)?.nombre_completo ?? "—";
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

  const totalesPorMetodo = new Map<string, number>();
  for (const m of ingresos) {
    const label = m.metodo_pago ? (METODO_PAGO_LABEL[m.metodo_pago] ?? m.metodo_pago) : "—";
    totalesPorMetodo.set(label, (totalesPorMetodo.get(label) ?? 0) + m.monto);
  }

  return (
    <div className="flex flex-col items-center gap-4">
      <style>{`@page { size: letter; margin: 0.5in; }`}</style>
      <div className="print:hidden">
        <PrintButton />
      </div>

      <div className="w-[8.5in] max-w-full rounded-2xl border border-slate-200 bg-white p-8 text-sm text-slate-800 print:w-auto print:rounded-none print:border-none print:p-0">
        {/* Encabezado */}
        <div className="flex items-start justify-between gap-4 border-b-2 border-slate-800 pb-3">
          <div>
            <h1 className="text-lg font-bold text-slate-900">{organization.name}</h1>
            <p className="text-xs text-slate-500">{sede?.name}</p>
          </div>
          <div className="text-right">
            <p className="text-sm font-semibold text-slate-900">Cierre de caja</p>
            <p className="font-mono text-xs text-slate-400">#{sesion.id.slice(0, 8).toUpperCase()}</p>
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

        {/* Ingresos por método — incluye lo que no es efectivo (transferencia, tarjeta, etc.) */}
        <div className="mt-4 flex flex-wrap items-center justify-between gap-2 border-b border-slate-200 pb-3">
          <div className="flex flex-wrap items-center gap-x-5 gap-y-1 text-xs">
            <span className="font-semibold text-slate-500 uppercase">Por método</span>
            {[...totalesPorMetodo.entries()].map(([label, monto]) => (
              <span key={label} className="flex items-center gap-1.5">
                <span className="text-slate-500">{label}</span>
                <span className="font-medium text-slate-800">{formatCOP(monto)}</span>
              </span>
            ))}
          </div>
          <p className="text-xs">
            <span className="text-slate-500">Total ingresos (todos los métodos) </span>
            <span className="font-semibold text-slate-900">{formatCOP(totalIngresos)}</span>
          </p>
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
                <th className="py-1.5 pr-2 font-medium">Referido</th>
                <th className="py-1.5 pr-2 font-medium">Método</th>
                <th className="py-1.5 pl-2 text-right font-medium">Monto</th>
              </tr>
            </thead>
            <tbody>
              {ingresos.map((m) => {
                const venta = ventaDe(m.venta_id);
                return (
                  <tr key={m.id} className="border-b border-slate-100">
                    <td className="py-1.5 pr-2 whitespace-nowrap text-slate-500">
                      {formatDateTime(m.created_at).split(", ")[1] ?? formatDateTime(m.created_at)}
                    </td>
                    <td className="py-1.5 pr-2 font-medium text-slate-800 italic">
                      {venta ? clienteDe(venta.cliente_id) : m.concepto}
                    </td>
                    <td className="py-1.5 pr-2 text-slate-500">{venta?.referido_nombre ?? "—"}</td>
                    <td className="py-1.5 pr-2 text-slate-500">
                      {m.metodo_pago ? (METODO_PAGO_LABEL[m.metodo_pago] ?? m.metodo_pago) : "—"}
                    </td>
                    <td className="py-1.5 pl-2 text-right font-medium text-emerald-600">
                      {formatCOP(m.monto)}
                    </td>
                  </tr>
                );
              })}
              {ingresos.length === 0 ? (
                <tr>
                  <td colSpan={5} className="py-4 text-center text-slate-400">
                    Sin ingresos en esta caja.
                  </td>
                </tr>
              ) : null}
            </tbody>
            {ingresos.length > 0 ? (
              <tfoot>
                <tr className="border-t-2 border-slate-800 font-semibold text-slate-900">
                  <td colSpan={4} className="py-1.5 pr-2 text-right">
                    Total ingresos
                  </td>
                  <td className="py-1.5 pl-2 text-right">{formatCOP(totalIngresos)}</td>
                </tr>
              </tfoot>
            ) : null}
          </table>
        </div>

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
                    <td className="py-1.5 pr-2 text-slate-500">
                      {m.metodo_pago ? (METODO_PAGO_LABEL[m.metodo_pago] ?? m.metodo_pago) : "—"}
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
