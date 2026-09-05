import type { Metadata } from "next";
import Link from "next/link";
import { Plus } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { formatDate } from "@/lib/format";

export const metadata: Metadata = { title: "Organizaciones | Plataforma" };

export default async function PlatformPage() {
  const supabase = await createClient();
  const { data: organizations } = await supabase
    .from("organizations")
    .select("id, name, slug, active, created_at")
    .order("created_at", { ascending: false });

  const admin = createAdminClient();
  const { data: sedes } = await admin.from("sedes").select("id, organization_id");
  const { data: admins } = await supabase
    .from("profiles")
    .select("id, organization_id, role")
    .eq("role", "admin");

  const sedeCount = (orgId: string) => (sedes ?? []).filter((s) => s.organization_id === orgId).length;
  const adminCount = (orgId: string) => (admins ?? []).filter((a) => a.organization_id === orgId).length;

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-slate-900">Organizaciones</h1>
          <p className="mt-1 text-sm text-slate-500">Escuelas de conducción que usan Gestia App Conductores.</p>
        </div>
        <Link
          href="/platform/organizaciones/nueva"
          className="flex items-center gap-1.5 rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white shadow-sm shadow-indigo-600/20 transition hover:bg-indigo-700"
        >
          <Plus className="h-4 w-4" />
          Nueva organización
        </Link>
      </div>

      <div className="overflow-x-auto rounded-2xl border border-slate-200 bg-white">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 text-left text-xs font-medium text-slate-500">
            <tr>
              <th className="px-4 py-3">Nombre</th>
              <th className="px-4 py-3">Slug</th>
              <th className="px-4 py-3">Sedes</th>
              <th className="px-4 py-3">Admins</th>
              <th className="px-4 py-3">Estado</th>
              <th className="px-4 py-3">Creada</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {(organizations ?? []).map((org) => (
              <tr key={org.id}>
                <td className="px-4 py-3">
                  <Link href={`/platform/organizaciones/${org.id}`} className="font-medium text-indigo-700 hover:underline">
                    {org.name}
                  </Link>
                </td>
                <td className="px-4 py-3 text-slate-500">{org.slug}</td>
                <td className="px-4 py-3 text-slate-600">{sedeCount(org.id)}</td>
                <td className="px-4 py-3 text-slate-600">{adminCount(org.id)}</td>
                <td className="px-4 py-3">
                  <span
                    className={`rounded-full px-2 py-0.5 text-[11px] font-medium ${
                      org.active ? "bg-emerald-100 text-emerald-700" : "bg-slate-100 text-slate-500"
                    }`}
                  >
                    {org.active ? "Activa" : "Suspendida"}
                  </span>
                </td>
                <td className="px-4 py-3 text-slate-500">{formatDate(org.created_at)}</td>
              </tr>
            ))}
            {(organizations ?? []).length === 0 ? (
              <tr>
                <td colSpan={6} className="px-4 py-8 text-center text-slate-400">
                  Todavía no hay organizaciones creadas.
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>
    </div>
  );
}
