import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, FileText, ShoppingBag } from "lucide-react";
import { getViewerContext, requireOpenCaja } from "@/lib/viewer";
import { actualizarCliente } from "../actions";
import { ClienteForm } from "../cliente-form";
import { DatosBasicosForm } from "../datos-basicos-form";
import { RuntConsultaLink } from "@/components/runt-link";
import { buttonClass } from "@/lib/ui";
import { formatDate } from "@/lib/format";

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
      "id, organization_id, sede_id, tipo_documento, numero_documento, nombre_completo, sexo, fecha_nacimiento, telefono_pais, telefono, correo_electronico, fingerprints_enrolled, runt, active, licencia_particular_vence, licencia_publico_vence, created_by, created_at, updated_at",
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
          <div className="flex shrink-0 items-center gap-2">
            <RuntConsultaLink documento={`${cliente.tipo_documento} ${cliente.numero_documento}`} />
            <Link href={`/clientes/${cliente.id}/estado-cuenta`} className={buttonClass("secondary")}>
              <FileText className="h-4 w-4" />
              Estado de cuenta
            </Link>
            {/* prefetch={false}: ver el mismo comentario en /clientes */}
            <Link
              href={`/ventas/nueva?sede=${cliente.sede_id}&cliente=${cliente.id}`}
              prefetch={false}
              className={buttonClass("primary")}
            >
              <ShoppingBag className="h-4 w-4" />
              Crear venta
            </Link>
          </div>
        </div>
      </div>

      {cliente.licencia_particular_vence || cliente.licencia_publico_vence ? (
        <div className="flex max-w-2xl flex-wrap gap-3">
          {cliente.licencia_particular_vence ? (
            <div className="rounded-xl border border-cyan-200 bg-cyan-50 px-3.5 py-2.5 text-xs">
              <p className="font-semibold text-cyan-800">Licencia particular vence</p>
              <p className="text-cyan-700">{formatDate(cliente.licencia_particular_vence)}</p>
            </div>
          ) : null}
          {cliente.licencia_publico_vence ? (
            <div className="rounded-xl border border-cyan-200 bg-cyan-50 px-3.5 py-2.5 text-xs">
              <p className="font-semibold text-cyan-800">Licencia público vence</p>
              <p className="text-cyan-700">{formatDate(cliente.licencia_publico_vence)}</p>
            </div>
          ) : null}
        </div>
      ) : null}

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
        <div className="flex flex-col gap-4">
          <div className="max-w-2xl rounded-2xl border border-slate-200 bg-white p-6">
            <p className="mb-4 rounded-lg bg-slate-50 px-3.5 py-2.5 text-xs text-slate-500">
              El documento, nombre, sexo y sede solo los corrige un administrador. Vos podés actualizar el
              resto de sus datos acá abajo.
            </p>
            <dl className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <ReadOnlyField label="Tipo de documento" value={TIPO_LABEL[cliente.tipo_documento] ?? cliente.tipo_documento} />
              <ReadOnlyField label="Número de documento" value={cliente.numero_documento} />
              <ReadOnlyField label="Nombre completo" value={cliente.nombre_completo} />
              <ReadOnlyField label="Sexo" value={cliente.sexo ?? "—"} />
              <ReadOnlyField label="Estado" value={cliente.active ? "Activo" : "Inactivo"} />
            </dl>
          </div>

          <div className="max-w-2xl rounded-2xl border border-slate-200 bg-white p-6">
            <h2 className="mb-4 text-sm font-semibold text-slate-800">Actualización de datos</h2>
            <DatosBasicosForm cliente={cliente} />
          </div>
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
