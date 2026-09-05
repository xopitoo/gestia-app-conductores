import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { getViewerContext } from "@/lib/viewer";
import { ConvertirForm } from "./convertir-form";

export const metadata: Metadata = { title: "Convertir cotización | Gestia App Conductores" };

export default async function ConvertirCotizacionPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const { supabase } = await getViewerContext();

  const { data: cotizacion } = await supabase
    .from("cotizaciones")
    .select("id, sede_id, cliente_id, concepto, monto, estado")
    .eq("id", id)
    .maybeSingle();

  if (!cotizacion) {
    notFound();
  }

  const { data: cliente } = await supabase
    .from("clientes")
    .select("nombre_completo, numero_documento")
    .eq("id", cotizacion.cliente_id)
    .maybeSingle();

  const { data: sesionAbierta } = await supabase
    .from("caja_sesiones")
    .select("id")
    .eq("sede_id", cotizacion.sede_id)
    .eq("estado", "abierta")
    .maybeSingle();

  return (
    <div className="flex flex-col gap-6">
      <div>
        <Link
          href={`/cotizaciones/${cotizacion.id}`}
          className="mb-3 inline-flex items-center gap-1.5 text-sm font-medium text-slate-500 hover:text-slate-700"
        >
          <ArrowLeft className="h-4 w-4" />
          Cotización
        </Link>
        <h1 className="text-2xl font-semibold text-slate-900">Convertir a venta</h1>
        <p className="mt-1 text-sm text-slate-500">
          {cliente?.nombre_completo} — {cliente?.numero_documento} · {cotizacion.concepto}
        </p>
      </div>

      {cotizacion.estado !== "pendiente" ? (
        <div className="max-w-2xl rounded-2xl border border-slate-200 bg-white p-5 text-sm text-slate-600">
          Esta cotización ya no está pendiente.
        </div>
      ) : !sesionAbierta ? (
        <div className="max-w-2xl rounded-2xl border border-amber-200 bg-amber-50 p-5 text-sm text-amber-800">
          Esta sede no tiene la caja abierta.{" "}
          <Link href="/caja" className="font-semibold underline">
            Abrí la caja
          </Link>{" "}
          antes de convertir la cotización en venta.
        </div>
      ) : (
        <div className="max-w-2xl rounded-2xl border border-slate-200 bg-white p-6">
          <ConvertirForm cotizacionId={cotizacion.id} total={cotizacion.monto} />
        </div>
      )}
    </div>
  );
}
