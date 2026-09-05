import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { ConfirmSubmitButton } from "@/components/confirm-submit-button";
import { formatDate } from "@/lib/format";
import { toggleOrganizationActive } from "./actions";

export const metadata: Metadata = { title: "Organización | Plataforma" };

export default async function OrganizacionDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createClient();

  const { data: organization } = await supabase
    .from("organizations")
    .select("id, name, slug, active, created_at")
    .eq("id", id)
    .maybeSingle();

  if (!organization) {
    notFound();
  }

  const { data: usuarios } = await supabase
    .from("profiles")
    .select("id, full_name, role, sede_id, active")
    .eq("organization_id", id)
    .order("full_name");

  const admin = createAdminClient();
  const { data: sedes } = await admin
    .from("sedes")
    .select("id, name, address, active")
    .eq("organization_id", id)
    .order("name");

  const sedeName = (sedeId: string | null) => sedes?.find((s) => s.id === sedeId)?.name ?? "—";

  return (
    <div className="flex flex-col gap-6">
      <div>
        <Link
          href="/platform"
          className="mb-3 inline-flex items-center gap-1.5 text-sm font-medium text-slate-500 hover:text-slate-700"
        >
          <ArrowLeft className="h-4 w-4" />
          Organizaciones
        </Link>
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-semibold text-slate-900">{organization.name}</h1>
            <p className="mt-1 text-sm text-slate-500">
              {organization.slug} · creada {formatDate(organization.created_at)}
            </p>
          </div>
          <form action={toggleOrganizationActive}>
            <input type="hidden" name="id" value={organization.id} />
            <input type="hidden" name="active" value={String(organization.active)} />
            <ConfirmSubmitButton
              confirmMessage={
                organization.active
                  ? `¿Suspender ${organization.name}? Sus usuarios no podrán ingresar.`
                  : `¿Reactivar ${organization.name}?`
              }
              className={`rounded-lg border px-4 py-2 text-sm font-semibold transition ${
                organization.active
                  ? "border-red-200 bg-red-50 text-red-700 hover:bg-red-100"
                  : "border-emerald-200 bg-emerald-50 text-emerald-700 hover:bg-emerald-100"
              }`}
            >
              {organization.active ? "Suspender organización" : "Reactivar organización"}
            </ConfirmSubmitButton>
          </form>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <div className="rounded-2xl border border-slate-200 bg-white p-5">
          <h2 className="mb-3 text-sm font-semibold text-slate-800">Sedes</h2>
          <ul className="flex flex-col divide-y divide-slate-100">
            {(sedes ?? []).map((s) => (
              <li key={s.id} className="flex items-center justify-between py-2 text-sm">
                <span className="font-medium text-slate-800">{s.name}</span>
                <span
                  className={`rounded-full px-2 py-0.5 text-[11px] font-medium ${
                    s.active ? "bg-emerald-100 text-emerald-700" : "bg-slate-100 text-slate-500"
                  }`}
                >
                  {s.active ? "Activa" : "Inactiva"}
                </span>
              </li>
            ))}
            {(sedes ?? []).length === 0 ? (
              <li className="py-6 text-center text-slate-400">Sin sedes.</li>
            ) : null}
          </ul>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-5">
          <h2 className="mb-3 text-sm font-semibold text-slate-800">Usuarios</h2>
          <ul className="flex flex-col divide-y divide-slate-100">
            {(usuarios ?? []).map((u) => (
              <li key={u.id} className="flex items-center justify-between py-2 text-sm">
                <div>
                  <p className="font-medium text-slate-800">{u.full_name}</p>
                  <p className="text-xs text-slate-400">
                    {u.role === "admin" ? "Administrador" : `Recepcionista · ${sedeName(u.sede_id)}`}
                  </p>
                </div>
                <span
                  className={`rounded-full px-2 py-0.5 text-[11px] font-medium ${
                    u.active ? "bg-emerald-100 text-emerald-700" : "bg-slate-100 text-slate-500"
                  }`}
                >
                  {u.active ? "Activo" : "Inactivo"}
                </span>
              </li>
            ))}
            {(usuarios ?? []).length === 0 ? (
              <li className="py-6 text-center text-slate-400">Sin usuarios.</li>
            ) : null}
          </ul>
        </div>
      </div>
    </div>
  );
}
