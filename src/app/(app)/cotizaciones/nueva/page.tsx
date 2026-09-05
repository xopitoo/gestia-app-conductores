import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { getViewerContext, resolveSedeId } from "@/lib/viewer";
import { SedeSelect } from "@/components/sede-select";
import { CotizacionForm } from "../cotizacion-form";

export const metadata: Metadata = { title: "Nueva cotización | Gestia App Conductores" };

export default async function NuevaCotizacionPage({
  searchParams,
}: {
  searchParams: Promise<{ sede?: string }>;
}) {
  const { sede: sedeParam } = await searchParams;
  const ctx = await getViewerContext();
  const { supabase, sedes } = ctx;
  const sedeId = resolveSedeId(ctx, sedeParam);

  if (!sedeId) {
    return (
      <div className="rounded-2xl border border-slate-200 bg-white p-8 text-center text-slate-500">
        Todavía no hay sedes configuradas para esta organización.
      </div>
    );
  }

  const [{ data: clientes }, { data: productos }] = await Promise.all([
    supabase
      .from("clientes")
      .select(
        "id, organization_id, sede_id, tipo_documento, numero_documento, nombre_completo, sexo, fecha_nacimiento, telefono_pais, telefono, correo_electronico, fingerprints_enrolled, runt, active, created_by, created_at, updated_at",
      )
      .eq("sede_id", sedeId)
      .eq("active", true)
      .order("nombre_completo"),
    supabase
      .from("productos")
      .select("id, organization_id, nombre, descripcion, precio, categoria, active, created_by, created_at, updated_at")
      .eq("active", true)
      .order("nombre"),
  ]);

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
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-semibold text-slate-900">Nueva cotización</h1>
          <SedeSelect sedes={sedes} currentSedeId={sedeId} />
        </div>
      </div>

      {(clientes ?? []).length === 0 ? (
        <div className="max-w-2xl rounded-2xl border border-slate-200 bg-white p-5 text-sm text-slate-600">
          Esta sede todavía no tiene clientes activos.{" "}
          <Link href="/clientes/nuevo" className="font-semibold text-indigo-700 underline">
            Creá un cliente
          </Link>{" "}
          primero.
        </div>
      ) : (
        <div className="max-w-2xl rounded-2xl border border-slate-200 bg-white p-6">
          <CotizacionForm sedeId={sedeId} clientes={clientes ?? []} productos={productos ?? []} />
        </div>
      )}
    </div>
  );
}
