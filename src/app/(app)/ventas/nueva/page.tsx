import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { getViewerContext, requireOpenCaja, resolveSedeId } from "@/lib/viewer";
import { SedeSelect } from "@/components/sede-select";
import { VentaForm } from "../venta-form";

export const metadata: Metadata = { title: "Registrar orden | Gestia App Conductores" };

export default async function NuevaVentaPage({
  searchParams,
}: {
  searchParams: Promise<{ sede?: string; cliente?: string }>;
}) {
  const { sede: sedeParam, cliente: clienteParam } = await searchParams;
  const ctx = await getViewerContext();
  await requireOpenCaja(ctx);
  const { supabase, sedes } = ctx;
  const sedeId = resolveSedeId(ctx, sedeParam);

  if (!sedeId) {
    return (
      <div className="rounded-2xl border border-slate-200 bg-white p-8 text-center text-slate-500">
        Todavía no hay sedes configuradas para esta organización.
      </div>
    );
  }

  const [{ data: sesionAbierta }, { data: clientes }, { data: productos }, { data: tramitadores }] =
    await Promise.all([
      supabase
        .from("caja_sesiones")
        .select("id")
        .eq("sede_id", sedeId)
        .eq("estado", "abierta")
        .maybeSingle(),
      supabase
        .from("clientes")
        .select(
          "id, organization_id, sede_id, tipo_documento, numero_documento, nombre_completo, sexo, fecha_nacimiento, telefono_pais, telefono, correo_electronico, fingerprints_enrolled, runt, active, created_by, created_at, updated_at",
        )
        .eq("sede_id", sedeId)
        .eq("active", true)
        .order("created_at", { ascending: false }),
      supabase
        .from("productos")
        .select("id, organization_id, sede_id, nombre, descripcion, precio, categoria, active, created_by, created_at, updated_at")
        .eq("active", true)
        .or(`sede_id.is.null,sede_id.eq.${sedeId}`)
        .order("nombre"),
      supabase
        .from("tramitadores")
        .select("id, organization_id, sede_id, nombre, precio_especial, active, created_by, created_at, updated_at")
        .eq("active", true)
        .or(`sede_id.is.null,sede_id.eq.${sedeId}`)
        .order("nombre"),
    ]);

  // Si la sede tiene su propio catálogo (ej. C.R.C. VALORAR), no se mezcla con
  // los productos "de todas las sedes" — esos quedaron sin sede desde antes de
  // que existiera este campo y en la práctica son del catálogo de las
  // escuelas de conducción, no tienen nada que ver con un centro médico.
  const productosSede = (productos ?? []).some((p) => p.sede_id === sedeId)
    ? (productos ?? []).filter((p) => p.sede_id === sedeId)
    : (productos ?? []);

  const tramitadorIds = (tramitadores ?? []).map((t) => t.id);
  const { data: tramitadorPrecios } = tramitadorIds.length
    ? await supabase
        .from("tramitador_precios")
        .select("id, tramitador_id, producto_id, organization_id, precio_especial, created_at, updated_at")
        .in("tramitador_id", tramitadorIds)
    : { data: [] };

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
          <h1 className="text-2xl font-semibold text-slate-900">Registrar nueva orden</h1>
          <SedeSelect sedes={sedes} currentSedeId={sedeId} />
        </div>
      </div>

      {!sesionAbierta ? (
        <div className="max-w-2xl rounded-2xl border border-amber-200 bg-amber-50 p-5 text-sm text-amber-800">
          Esta sede no tiene la caja abierta.{" "}
          <Link href={`/caja?sede=${sedeId}`} className="font-semibold underline">
            Abrí la caja
          </Link>{" "}
          antes de registrar una venta.
        </div>
      ) : (clientes ?? []).length === 0 ? (
        <div className="max-w-2xl rounded-2xl border border-slate-200 bg-white p-5 text-sm text-slate-600">
          Esta sede todavía no tiene clientes activos.{" "}
          <Link href="/clientes/nuevo" className="font-semibold text-indigo-700 underline">
            Creá un cliente
          </Link>{" "}
          primero.
        </div>
      ) : (
        <div className="max-w-2xl rounded-2xl border border-slate-200 bg-white p-6">
          <VentaForm
            sedeId={sedeId}
            clientes={clientes ?? []}
            productos={productosSede}
            tramitadores={tramitadores ?? []}
            tramitadorPrecios={tramitadorPrecios ?? []}
            clienteIdInicial={clienteParam}
          />
        </div>
      )}
    </div>
  );
}
