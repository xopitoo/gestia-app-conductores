import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, ArrowRightLeft } from "lucide-react";
import { getViewerContext } from "@/lib/viewer";
import { ConfirmSubmitButton } from "@/components/confirm-submit-button";
import { formatCOP, formatDate, formatDateTime } from "@/lib/format";
import { rechazarCotizacion } from "../actions";
import { badgeClass, buttonClass, ESTADO_COTIZACION_LABEL } from "@/lib/ui";

export const metadata: Metadata = { title: "Cotización | Gestia App Conductores" };

export default async function CotizacionDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const { supabase } = await getViewerContext();

  const { data: cotizacion } = await supabase
    .from("cotizaciones")
    .select("id, cliente_id, concepto, monto, estado, referido_nombre, valida_hasta, venta_id, created_at")
    .eq("id", id)
    .maybeSingle();

  if (!cotizacion) {
    notFound();
  }

  const [{ data: items }, { data: cliente }] = await Promise.all([
    supabase
      .from("cotizacion_items")
      .select("id, nombre, precio")
      .eq("cotizacion_id", id)
      .order("created_at"),
    supabase
      .from("clientes")
      .select("nombre_completo, numero_documento, tipo_documento, telefono, telefono_pais")
      .eq("id", cotizacion.cliente_id)
      .maybeSingle(),
  ]);

  const estado = ESTADO_COTIZACION_LABEL[cotizacion.estado] ?? ESTADO_COTIZACION_LABEL.pendiente;
  const vencida =
    cotizacion.estado === "pendiente" &&
    cotizacion.valida_hasta &&
    cotizacion.valida_hasta < new Date().toISOString().slice(0, 10);

  return (
    <div className="flex flex-col gap-6">
      <div>
        <Link
          href="/cotizaciones"
          className="mb-3 inline-flex items-center gap-1.5 text-sm font-medium text-slate-500 hover:text-slate-700"
        >
          <ArrowLeft className="h-4 w-4" />
          Cotizaciones
        </Link>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="text-2xl font-semibold text-slate-900">
              {cliente?.nombre_completo ?? "Cliente"}
            </h1>
            <p className="mt-1 text-sm text-slate-500">
              {cliente?.tipo_documento} {cliente?.numero_documento} · {formatDateTime(cotizacion.created_at)}
            </p>
            {cotizacion.valida_hasta ? (
              <p className="mt-1 text-xs text-slate-400">
                Válida hasta {formatDate(cotizacion.valida_hasta)}
              </p>
            ) : null}
            {cotizacion.referido_nombre ? (
              <p className="mt-1 text-xs text-indigo-600">Referido: {cotizacion.referido_nombre}</p>
            ) : null}
          </div>
          <div className="flex flex-col items-end gap-1.5">
            <span className={badgeClass(estado.tone, "md")}>
              {estado.label}
            </span>
            {vencida ? (
              <span className={badgeClass("danger", "md")}>
                Vencida
              </span>
            ) : null}
          </div>
        </div>
      </div>

      <div className="max-w-2xl rounded-2xl border border-slate-200 bg-white p-5">
        <h2 className="mb-3 text-sm font-semibold text-slate-800">Productos</h2>
        <ul className="flex flex-col divide-y divide-slate-100">
          {(items ?? []).map((item) => (
            <li key={item.id} className="flex items-center justify-between py-2 text-sm">
              <span className="text-slate-700">{item.nombre}</span>
              <span className="font-medium text-slate-800">{formatCOP(item.precio)}</span>
            </li>
          ))}
        </ul>
        <div className="mt-3 flex items-center justify-between border-t border-slate-200 pt-3 text-sm font-semibold text-slate-900">
          <span>Total</span>
          <span>{formatCOP(cotizacion.monto)}</span>
        </div>

        {cotizacion.estado === "pendiente" ? (
          <div className="mt-5 flex items-center gap-3 border-t border-slate-200 pt-5">
            <Link
              href={`/cotizaciones/${cotizacion.id}/convertir`}
              className={buttonClass("primary")}
            >
              <ArrowRightLeft className="h-4 w-4" />
              Convertir a venta
            </Link>
            <form action={rechazarCotizacion}>
              <input type="hidden" name="id" value={cotizacion.id} />
              <ConfirmSubmitButton
                confirmMessage="¿Rechazar esta cotización?"
                className={buttonClass("destructive")}
              >
                Rechazar
              </ConfirmSubmitButton>
            </form>
          </div>
        ) : cotizacion.estado === "convertida" && cotizacion.venta_id ? (
          <div className="mt-5 border-t border-slate-200 pt-5">
            <Link
              href={`/ventas/${cotizacion.venta_id}`}
              className="text-sm font-medium text-indigo-700 hover:underline"
            >
              Ver la venta →
            </Link>
          </div>
        ) : null}
      </div>
    </div>
  );
}
