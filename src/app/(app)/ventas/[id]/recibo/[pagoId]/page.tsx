import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { CheckCircle2, Clock3 } from "lucide-react";
import { getViewerContext } from "@/lib/viewer";
import { formatCOP, formatDate, formatDateTime } from "@/lib/format";
import { METODO_PAGO_LABEL } from "@/lib/supabase/types";
import { PrintButton } from "@/components/print-button";
import { badgeClass } from "@/lib/ui";

export const metadata: Metadata = { title: "Recibo | Gestia App Conductores" };

export default async function ReciboPage({
  params,
}: {
  params: Promise<{ id: string; pagoId: string }>;
}) {
  const { id, pagoId } = await params;
  const { supabase, organization } = await getViewerContext();

  const { data: venta } = await supabase
    .from("ventas")
    .select("id, sede_id, cliente_id, concepto, monto, descuento, incremento")
    .eq("id", id)
    .maybeSingle();

  if (!venta) notFound();

  const [{ data: pago }, { data: items }, { data: todosLosPagos }, { data: cliente }, { data: sede }] =
    await Promise.all([
      supabase
        .from("venta_pagos")
        .select("id, monto, metodo_pago, created_at")
        .eq("id", pagoId)
        .eq("venta_id", id)
        .maybeSingle(),
      supabase.from("venta_items").select("nombre, precio").eq("venta_id", id).order("created_at"),
      supabase.from("venta_pagos").select("monto, created_at").eq("venta_id", id).order("created_at"),
      supabase
        .from("clientes")
        .select("nombre_completo, tipo_documento, numero_documento, telefono, telefono_pais")
        .eq("id", venta.cliente_id)
        .maybeSingle(),
      supabase.from("sedes").select("name").eq("id", venta.sede_id).maybeSingle(),
    ]);

  if (!pago) notFound();

  // Saldo pendiente justo después de este pago: suma de todos los pagos de
  // la venta hechos hasta (e incluyendo) este, comparado contra el total.
  const pagadoHastaEste = (todosLosPagos ?? [])
    .filter((p) => p.created_at <= pago.created_at)
    .reduce((acc, p) => acc + p.monto, 0);
  const totalNeto = venta.monto - venta.descuento + venta.incremento;
  const saldoPendiente = totalNeto - pagadoHastaEste;

  return (
    <div className="flex flex-col items-center gap-4">
      <div className="print:hidden">
        <PrintButton />
      </div>

      <div
        className="w-[8.5in] max-w-full overflow-hidden rounded-2xl border border-slate-200 bg-white text-sm text-slate-800 print:w-auto print:rounded-none print:border-none"
        style={{ minHeight: "5in" }}
      >
        <style>{`
          @page { size: 8.5in 5.5in; margin: 0.35in; }
          @media print {
            * { print-color-adjust: exact; -webkit-print-color-adjust: exact; }
          }
        `}</style>

        <div className="h-1.5 bg-gradient-to-r from-indigo-600 via-sky-500 to-emerald-500 print:hidden" />

        <div className="p-8 pt-6 print:p-0">
          <div className="flex items-start justify-between border-b border-slate-300 pb-3">
            <div>
              <h1 className="text-lg font-bold text-slate-900">{organization.name}</h1>
              <p className="text-xs text-slate-500">{sede?.name}</p>
            </div>
            <div className="text-right">
              <p className="text-xs font-semibold tracking-wide text-indigo-700 uppercase">Recibo de pago</p>
              <p className="mt-1 text-xs text-slate-500">{formatDateTime(pago.created_at)}</p>
              <p className="font-mono text-[11px] text-slate-400">#{pago.id.slice(0, 8)}</p>
            </div>
          </div>

          <div className="mt-3 grid grid-cols-2 gap-2 border-b border-slate-200 pb-3 text-xs">
            <div>
              <p className="text-slate-400">Cliente</p>
              <p className="font-medium text-slate-800">{cliente?.nombre_completo ?? "—"}</p>
            </div>
            <div>
              <p className="text-slate-400">Documento</p>
              <p className="font-medium text-slate-800">
                {cliente?.tipo_documento} {cliente?.numero_documento}
              </p>
            </div>
            <div>
              <p className="text-slate-400">Teléfono</p>
              <p className="font-medium text-slate-800">
                {cliente?.telefono_pais} {cliente?.telefono}
              </p>
            </div>
            <div>
              <p className="text-slate-400">Fecha</p>
              <p className="font-medium text-slate-800">{formatDate(pago.created_at)}</p>
            </div>
          </div>

          <div className="mt-3 border-b border-slate-200 pb-3">
            <p className="mb-1 text-xs text-slate-400">Productos de la orden</p>
            <ul className="flex flex-col gap-0.5 text-xs">
              {(items ?? []).map((item, i) => (
                <li key={i} className="flex items-center justify-between">
                  <span>{item.nombre}</span>
                  <span>{formatCOP(item.precio)}</span>
                </li>
              ))}
            </ul>
          </div>

          <div className="mt-3 flex flex-col gap-1 text-sm">
            <div className="flex items-center justify-between text-slate-500">
              <span>Total de la orden</span>
              <span>{formatCOP(venta.monto)}</span>
            </div>
            {venta.descuento > 0 ? (
              <div className="flex items-center justify-between text-emerald-600">
                <span>Descuento</span>
                <span>−{formatCOP(venta.descuento)}</span>
              </div>
            ) : null}
            {venta.incremento > 0 ? (
              <div className="flex items-center justify-between text-amber-600">
                <span>Incremento</span>
                <span>+{formatCOP(venta.incremento)}</span>
              </div>
            ) : null}
            {venta.descuento > 0 || venta.incremento > 0 ? (
              <div className="flex items-center justify-between text-slate-700">
                <span>Total</span>
                <span>{formatCOP(totalNeto)}</span>
              </div>
            ) : null}
            <div className="mt-1 flex items-center justify-between text-base font-bold text-slate-900">
              <span className="flex items-center gap-2">
                Pagó ahora
                <span className={badgeClass("info", "sm")}>
                  {METODO_PAGO_LABEL[pago.metodo_pago] ?? pago.metodo_pago}
                </span>
              </span>
              <span>{formatCOP(pago.monto)}</span>
            </div>
          </div>

          <div className="mt-4 flex items-center justify-between rounded-xl border border-slate-200 bg-slate-50 px-4 py-3">
            <span className="text-xs font-semibold tracking-wide text-slate-500 uppercase">Estado de la orden</span>
            {saldoPendiente > 0 ? (
              <span className={`flex items-center gap-1.5 ${badgeClass("warning", "md")}`}>
                <Clock3 className="h-3.5 w-3.5" aria-hidden="true" />
                Saldo pendiente: {formatCOP(saldoPendiente)}
              </span>
            ) : (
              <span className={`flex items-center gap-1.5 ${badgeClass("success", "md")}`}>
                <CheckCircle2 className="h-3.5 w-3.5" aria-hidden="true" />
                Pagado en su totalidad
              </span>
            )}
          </div>

          <p className="mt-6 text-center text-[10px] text-slate-400">
            Comprobante generado por Gestia App Conductores — {formatDateTime(new Date().toISOString())}
          </p>
        </div>
      </div>
    </div>
  );
}
