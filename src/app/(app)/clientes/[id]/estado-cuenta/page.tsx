import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getViewerContext } from "@/lib/viewer";
import { formatCOP, formatDate, formatDateTime } from "@/lib/format";
import { getSedeBranding } from "@/lib/sede-branding";
import { PrintButton } from "@/components/print-button";
import { badgeClass, ESTADO_VENTA_LABEL } from "@/lib/ui";

export const metadata: Metadata = { title: "Estado de cuenta | Gestia App Conductores" };

const TIPO_LABEL: Record<string, string> = {
  CC: "Cédula de ciudadanía",
  TI: "Tarjeta de identidad",
  CE: "Cédula de extranjería",
  PPT: "Permiso por Protección Temporal",
  PASAPORTE: "Pasaporte",
  NIT: "NIT",
};

export default async function EstadoCuentaPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const { supabase, organization } = await getViewerContext();

  const { data: cliente } = await supabase
    .from("clientes")
    .select("id, sede_id, tipo_documento, numero_documento, nombre_completo, telefono_pais, telefono, correo_electronico")
    .eq("id", id)
    .maybeSingle();

  if (!cliente) notFound();

  const [{ data: sede }, { data: ventas }] = await Promise.all([
    supabase.from("sedes").select("name").eq("id", cliente.sede_id).maybeSingle(),
    supabase
      .from("ventas")
      .select("id, concepto, monto, descuento, estado, created_at")
      .eq("cliente_id", id)
      .neq("estado", "anulada")
      .order("created_at"),
  ]);

  const ventaIds = (ventas ?? []).map((v) => v.id);
  const { data: pagos } = ventaIds.length
    ? await supabase.from("venta_pagos").select("venta_id, monto").in("venta_id", ventaIds)
    : { data: [] as { venta_id: string; monto: number }[] };
  const pagadoDe = (ventaId: string) =>
    (pagos ?? []).filter((p) => p.venta_id === ventaId).reduce((acc, p) => acc + p.monto, 0);

  const filas = (ventas ?? []).map((v) => {
    const pagado = pagadoDe(v.id);
    const saldo = v.monto - v.descuento - pagado;
    return { ...v, pagado, saldo };
  });

  const totalOrdenes = filas.reduce((acc, f) => acc + (f.monto - f.descuento), 0);
  const totalPagado = filas.reduce((acc, f) => acc + f.pagado, 0);
  const totalPendiente = filas.reduce((acc, f) => acc + f.saldo, 0);

  const branding = getSedeBranding(sede?.name, organization.name);

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
              <p className="text-xs font-semibold tracking-wide text-indigo-700 uppercase">{branding.subtitulo}</p>
              {branding.slogan ? (
                <p className="mt-0.5 text-[11px] text-slate-400 italic">{branding.slogan}</p>
              ) : null}
            </div>
            <div className="text-right">
              <p className="text-sm font-semibold text-slate-900">Estado de cuenta</p>
              <p className="font-mono text-xs text-slate-400">#{cliente.id.slice(0, 8).toUpperCase()}</p>
              {branding.telefono || branding.web ? (
                <p className="mt-1 text-[11px] text-slate-400">
                  {branding.telefono ? <span>Tel. {branding.telefono}</span> : null}
                  {branding.telefono && branding.web ? <span> · </span> : null}
                  {branding.web ? <span>{branding.web}</span> : null}
                </p>
              ) : null}
            </div>
          </div>

          {/* Cliente */}
          <div className="mt-3 grid grid-cols-2 gap-3 border-b border-slate-200 pb-3 text-xs">
            <div>
              <p className="text-slate-400">Cliente</p>
              <p className="font-medium text-slate-800">{cliente.nombre_completo}</p>
              <p className="text-slate-500">
                {TIPO_LABEL[cliente.tipo_documento] ?? cliente.tipo_documento} {cliente.numero_documento}
              </p>
            </div>
            <div>
              <p className="text-slate-400">Contacto</p>
              <p className="text-slate-500">
                {cliente.telefono ? `${cliente.telefono_pais} ${cliente.telefono}` : "—"}
              </p>
              <p className="text-slate-500">{cliente.correo_electronico ?? "—"}</p>
            </div>
          </div>

          {/* Resumen */}
          <div className="mt-4 grid grid-cols-3 gap-x-4 gap-y-3 rounded-xl border border-slate-200 bg-slate-50 p-4">
            <Kpi label="Total en órdenes" value={formatCOP(totalOrdenes)} />
            <Kpi label="Total pagado" value={formatCOP(totalPagado)} tone="text-emerald-600" />
            <Kpi
              label="Saldo pendiente"
              value={formatCOP(totalPendiente)}
              tone={totalPendiente > 0 ? "text-amber-700" : "text-emerald-600"}
              strong
            />
          </div>

          {/* Detalle de órdenes */}
          <div className="mt-4">
            <p className="mb-1.5 text-[11px] font-semibold tracking-wide text-slate-500 uppercase">
              Historial de órdenes
            </p>
            <table className="w-full border-collapse text-xs">
              <thead>
                <tr className="border-b border-slate-300 text-left text-slate-500">
                  <th className="py-1.5 pr-2 font-medium">Fecha</th>
                  <th className="py-1.5 pr-2 font-medium">Concepto</th>
                  <th className="py-1.5 pr-2 font-medium">Estado</th>
                  <th className="py-1.5 pr-2 text-right font-medium">Total</th>
                  <th className="py-1.5 pr-2 text-right font-medium">Pagado</th>
                  <th className="py-1.5 pl-2 text-right font-medium">Saldo</th>
                </tr>
              </thead>
              <tbody>
                {filas.map((f) => {
                  const estado = ESTADO_VENTA_LABEL[f.estado] ?? { label: f.estado, tone: "neutral" as const };
                  return (
                    <tr key={f.id} className="border-b border-slate-100">
                      <td className="py-1.5 pr-2 whitespace-nowrap text-slate-500">{formatDate(f.created_at)}</td>
                      <td className="py-1.5 pr-2 text-slate-800">{f.concepto}</td>
                      <td className="py-1.5 pr-2">
                        <span className={badgeClass(estado.tone)}>{estado.label}</span>
                      </td>
                      <td className="py-1.5 pr-2 text-right text-slate-600">{formatCOP(f.monto - f.descuento)}</td>
                      <td className="py-1.5 pr-2 text-right text-emerald-600">{formatCOP(f.pagado)}</td>
                      <td className={`py-1.5 pl-2 text-right font-medium ${f.saldo > 0 ? "text-amber-700" : "text-slate-400"}`}>
                        {formatCOP(f.saldo)}
                      </td>
                    </tr>
                  );
                })}
                {filas.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="py-4 text-center text-slate-400">
                      Este cliente todavía no tiene órdenes registradas.
                    </td>
                  </tr>
                ) : null}
              </tbody>
              {filas.length > 0 ? (
                <tfoot>
                  <tr className="border-t-2 border-slate-800 font-semibold text-slate-900">
                    <td colSpan={3} className="py-1.5 pr-2 text-right">
                      Total
                    </td>
                    <td className="py-1.5 pr-2 text-right">{formatCOP(totalOrdenes)}</td>
                    <td className="py-1.5 pr-2 text-right">{formatCOP(totalPagado)}</td>
                    <td className="py-1.5 pl-2 text-right text-amber-700">{formatCOP(totalPendiente)}</td>
                  </tr>
                </tfoot>
              ) : null}
            </table>
          </div>

          <p className="mt-6 text-center text-[10px] text-slate-400">
            Comprobante generado por Gestia App Conductores — {formatDateTime(new Date().toISOString())}
          </p>
        </div>
      </div>
    </div>
  );
}

function Kpi({ label, value, tone, strong }: { label: string; value: string; tone?: string; strong?: boolean }) {
  return (
    <div>
      <p className="text-[10px] text-slate-400 uppercase">{label}</p>
      <p className={`${strong ? "text-sm" : "text-xs"} font-semibold ${tone ?? "text-slate-900"}`}>{value}</p>
    </div>
  );
}
