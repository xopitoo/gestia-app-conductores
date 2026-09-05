import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { getViewerContext, requireOpenCaja } from "@/lib/viewer";
import { actualizarCliente } from "../actions";
import { ClienteForm } from "../cliente-form";
import { RuntBadge } from "../runt-badge";
import { RuntConsultaLink } from "@/components/runt-link";

export const metadata: Metadata = { title: "Cliente | Gestia App Conductores" };

const TIPO_LABEL: Record<string, string> = {
  CC: "Cédula de ciudadanía",
  TI: "Tarjeta de identidad",
  CE: "Cédula de extranjería",
  PPT: "Permiso por Protección Temporal",
  PASAPORTE: "Pasaporte",
  NIT: "NIT",
};

export default async function ClienteDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const ctx = await getViewerContext();
  await requireOpenCaja(ctx);
  const { supabase, profile, sedes } = ctx;

  const { data: cliente } = await supabase
    .from("clientes")
    .select(
      "id, organization_id, sede_id, tipo_documento, numero_documento, nombre_completo, sexo, fecha_nacimiento, telefono_pais, telefono, correo_electronico, fingerprints_enrolled, runt, active, created_by, created_at, updated_at",
    )
    .eq("id", id)
    .maybeSingle();

  if (!cliente) {
    notFound();
  }

  return (
    <div className="flex flex-col gap-6">
      <div>
        <Link
          href="/clientes"
          className="mb-3 inline-flex items-center gap-1.5 text-sm font-medium text-slate-500 hover:text-slate-700"
        >
          <ArrowLeft className="h-4 w-4" />
          Clientes
        </Link>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="text-2xl font-semibold text-slate-900">
              {cliente.nombre_completo}
            </h1>
            <p className="mt-1 text-sm text-slate-500">
              Huellas registradas: {cliente.fingerprints_enrolled}/2
            </p>
          </div>
          <RuntConsultaLink documento={`${cliente.tipo_documento} ${cliente.numero_documento}`} />
        </div>
      </div>

      {profile.role === "admin" ? (
        <div className="max-w-2xl rounded-2xl border border-slate-200 bg-white p-6">
          <ClienteForm
            action={actualizarCliente}
            cliente={cliente}
            sedes={sedes}
            showSedeSelect
            submitLabel="Guardar cambios"
          />
        </div>
      ) : (
        <div className="max-w-2xl rounded-2xl border border-slate-200 bg-white p-6">
          <p className="mb-4 rounded-lg bg-slate-50 px-3.5 py-2.5 text-xs text-slate-500">
            Solo un administrador puede modificar los datos de un cliente ya cargado.
          </p>
          <dl className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <ReadOnlyField label="Tipo de documento" value={TIPO_LABEL[cliente.tipo_documento] ?? cliente.tipo_documento} />
            <ReadOnlyField label="Número de documento" value={cliente.numero_documento} />
            <ReadOnlyField label="Nombre completo" value={cliente.nombre_completo} />
            <ReadOnlyField label="Sexo" value={cliente.sexo ?? "—"} />
            <ReadOnlyField label="Fecha de nacimiento" value={cliente.fecha_nacimiento ?? "—"} />
            <ReadOnlyField
              label="Teléfono"
              value={cliente.telefono ? `${cliente.telefono_pais} ${cliente.telefono}` : "—"}
            />
            <ReadOnlyField label="Correo electrónico" value={cliente.correo_electronico ?? "—"} />
            <div>
              <dt className="text-xs text-slate-400">RUNT</dt>
              <dd className="mt-1">
                <RuntBadge runt={cliente.runt} />
              </dd>
            </div>
            <ReadOnlyField label="Estado" value={cliente.active ? "Activo" : "Inactivo"} />
          </dl>
        </div>
      )}
    </div>
  );
}

function ReadOnlyField({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-xs text-slate-400">{label}</dt>
      <dd className="text-sm font-medium text-slate-800">{value}</dd>
    </div>
  );
}
