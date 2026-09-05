import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, FileText, GraduationCap, Printer } from "lucide-react";
import { getViewerContext } from "@/lib/viewer";
import { formatCOP, formatDateTime } from "@/lib/format";
import { METODO_PAGO_LABEL } from "@/lib/supabase/types";
import { AbonoForm } from "./abono-form";
import { CertificadoRuntForm } from "./certificado-runt-form";
import { RuntBadge } from "@/app/(app)/clientes/runt-badge";
import { RuntConsultaLink } from "@/components/runt-link";

export const metadata: Metadata = { title: "Venta | Gestia App Conductores" };

const ESTADO_LABEL: Record<string, { label: string; className: string }> = {
  pagada: { label: "Pagada", className: "bg-emerald-100 text-emerald-700" },
  abonada: { label: "Abonada", className: "bg-amber-100 text-amber-700" },
  anulada: { label: "Anulada", className: "bg-slate-100 text-slate-500" },
};

export default async function VentaDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const { supabase } = await getViewerContext();

  const { data: venta } = await supabase
    .from("ventas")
    .select(
      "id, sede_id, cliente_id, concepto, monto, descuento, estado, referido_nombre, certificado, certificado_at, certificado_path, created_at",
    )
    .eq("id", id)
    .maybeSingle();

  if (!venta) {
    notFound();
  }

  const certificadoUrl = venta.certificado_path
    ? (
        await supabase.storage
          .from("certificados-runt")
          .createSignedUrl(venta.certificado_path, 60 * 10)
      ).data?.signedUrl
    : null;

  const [{ data: items }, { data: pagos }, { data: cliente }, { data: sesionAbierta }] =
    await Promise.all([
      supabase
        .from("venta_items")
        .select("id, nombre, precio")
        .eq("venta_id", id)
        .order("created_at"),
      supabase
        .from("venta_pagos")
        .select("id, monto, metodo_pago, created_at")
        .eq("venta_id", id)
        .order("created_at"),
      supabase
        .from("clientes")
        .select("nombre_completo, numero_documento, tipo_documento, telefono, telefono_pais, runt")
        .eq("id", venta.cliente_id)
        .maybeSingle(),
      supabase
        .from("caja_sesiones")
        .select("id")
        .eq("sede_id", venta.sede_id)
        .eq("estado", "abierta")
        .maybeSingle(),
    ]);

  const pagado = (pagos ?? []).reduce((acc, p) => acc + p.monto, 0);
  const totalNeto = venta.monto - venta.descuento;
  const saldo = totalNeto - pagado;
  const estado = ESTADO_LABEL[venta.estado] ?? ESTADO_LABEL.pagada;

  return (
    <div className="flex flex-col gap-6">
      <div>
        <Link
          href="/ventas"
          className="mb-3 inline-flex items-center gap-1.5 text-sm font-medium text-slate-500 hover:text-slate-700"
        >
          <ArrowLeft className="h-4 w-4" />
          Ventas
        </Link>
        <div className="flex items-center justify-between">
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="text-2xl font-semibold text-slate-900">
                {cliente?.nombre_completo ?? "Cliente"}
              </h1>
              {cliente ? <RuntBadge runt={cliente.runt} /> : null}
            </div>
            <p className="mt-1 text-sm text-slate-500">
              {cliente?.tipo_documento} {cliente?.numero_documento} · {formatDateTime(venta.created_at)}
            </p>
            {venta.referido_nombre ? (
              <p className="mt-1 text-xs text-indigo-600">Referido: {venta.referido_nombre}</p>
            ) : null}
          </div>
          <div className="flex shrink-0 items-center gap-2">
            {cliente ? (
              <RuntConsultaLink documento={`${cliente.tipo_documento} ${cliente.numero_documento}`} />
            ) : null}
            <span className={`rounded-full px-3 py-1 text-xs font-medium ${estado.className}`}>
              {estado.label}
            </span>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <div className="rounded-2xl border border-slate-200 bg-white p-5">
          <h2 className="mb-3 text-sm font-semibold text-slate-800">Productos</h2>
          <ul className="flex flex-col divide-y divide-slate-100">
            {(items ?? []).map((item) => (
              <li key={item.id} className="flex items-center justify-between py-2 text-sm">
                <span className="text-slate-700">{item.nombre}</span>
                <span className="font-medium text-slate-800">{formatCOP(item.precio)}</span>
              </li>
            ))}
          </ul>
          <div className="mt-3 flex flex-col gap-0.5 border-t border-slate-200 pt-3 text-sm">
            <div className={`flex items-center justify-between ${venta.descuento > 0 ? "text-slate-500" : "font-semibold text-slate-900"}`}>
              <span>{venta.descuento > 0 ? "Subtotal" : "Total"}</span>
              <span>{formatCOP(venta.monto)}</span>
            </div>
            {venta.descuento > 0 ? (
              <>
                <div className="flex items-center justify-between text-emerald-600">
                  <span>Descuento</span>
                  <span>−{formatCOP(venta.descuento)}</span>
                </div>
                <div className="flex items-center justify-between font-semibold text-slate-900">
                  <span>Total con descuento</span>
                  <span>{formatCOP(totalNeto)}</span>
                </div>
              </>
            ) : null}
            <div className="flex items-center justify-between text-emerald-600">
              <span>Pagado</span>
              <span>{formatCOP(pagado)}</span>
            </div>
            {saldo > 0 ? (
              <div className="flex items-center justify-between text-amber-700">
                <span>Saldo pendiente</span>
                <span>{formatCOP(saldo)}</span>
              </div>
            ) : null}
          </div>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-5">
          <h2 className="mb-3 text-sm font-semibold text-slate-800">Historial de pagos</h2>
          <ul className="flex flex-col divide-y divide-slate-100">
            {(pagos ?? []).map((p) => (
              <li key={p.id} className="flex items-center justify-between py-2 text-sm">
                <div>
                  <p className="text-slate-700">{METODO_PAGO_LABEL[p.metodo_pago] ?? p.metodo_pago}</p>
                  <p className="text-xs text-slate-400">{formatDateTime(p.created_at)}</p>
                </div>
                <div className="flex items-center gap-3">
                  <span className="font-medium text-slate-800">{formatCOP(p.monto)}</span>
                  <Link
                    href={`/ventas/${venta.id}/recibo/${p.id}`}
                    className="flex items-center gap-1 text-xs font-medium text-indigo-700 hover:underline"
                  >
                    <Printer className="h-3.5 w-3.5" />
                    Recibo
                  </Link>
                </div>
              </li>
            ))}
            {(pagos ?? []).length === 0 ? (
              <li className="py-6 text-center text-slate-400">Sin pagos registrados.</li>
            ) : null}
          </ul>

          {venta.estado === "abonada" ? (
            <div className="mt-4 border-t border-slate-200 pt-4">
              {sesionAbierta ? (
                <AbonoForm ventaId={venta.id} saldo={saldo} />
              ) : (
                <p className="rounded-lg bg-amber-50 p-3 text-sm text-amber-800">
                  Abrí la caja de esta sede para poder registrar un abono.
                </p>
              )}
            </div>
          ) : null}
        </div>
      </div>

      {venta.estado !== "anulada" ? (
        <div className="rounded-2xl border border-slate-200 bg-white p-5">
          <h2 className="mb-3 text-sm font-semibold text-slate-800">Certificado RUNT</h2>
          <p className="mb-3 text-xs text-slate-400">
            Para la auditoría, toda venta paga por completo debe tener el certificado subido.
          </p>
          {venta.certificado ? (
            <div className="flex flex-wrap items-center gap-3 text-sm text-emerald-700">
              <span className="flex items-center gap-2">
                <GraduationCap className="h-4 w-4" aria-hidden="true" />
                Subido el {formatDateTime(venta.certificado_at!)}
              </span>
              {certificadoUrl ? (
                <a
                  href={certificadoUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-1 text-xs font-medium text-indigo-700 hover:underline"
                >
                  <FileText className="h-3.5 w-3.5" aria-hidden="true" />
                  Ver certificado
                </a>
              ) : null}
            </div>
          ) : (
            <div className="max-w-xs">
              <CertificadoRuntForm ventaId={venta.id} saldo={saldo} />
            </div>
          )}
        </div>
      ) : null}
    </div>
  );
}
