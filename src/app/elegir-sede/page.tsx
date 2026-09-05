import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { logout } from "@/app/login/actions";
import { createClient } from "@/lib/supabase/server";
import { SedeForm } from "./sede-form";

export const metadata: Metadata = { title: "Elegí tu sede | Gestia App Conductores" };

export default async function ElegirSedePage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("role, organization_id, sede_id, active")
    .eq("id", user.id)
    .single();

  if (!profile || !profile.active) {
    redirect("/login");
  }
  if (profile.role === "platform_owner") {
    redirect("/platform");
  }
  if (profile.role === "admin" || profile.sede_id) {
    redirect("/dashboard");
  }

  const { data: sedes } = await supabase
    .from("sedes")
    .select("id, organization_id, name, address, active, created_at, updated_at")
    .eq("organization_id", profile.organization_id!)
    .eq("active", true)
    .order("name");

  return (
    <div className="flex min-h-svh flex-col items-center justify-center bg-slate-50 px-4 py-12">
      <div className="w-full max-w-sm">
        <div className="mb-6 text-center">
          <h1 className="text-lg font-semibold text-slate-900">¿En qué sede trabajás?</h1>
          <p className="mt-1 text-sm text-slate-500">
            Elegí tu sede para empezar a usar Gestia App Conductores.
          </p>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-xl shadow-slate-900/5">
          {(sedes ?? []).length === 0 ? (
            <p className="text-center text-sm text-slate-500">
              Todavía no hay sedes creadas en tu organización. Pedile a tu administrador que
              cree una.
            </p>
          ) : (
            <SedeForm sedes={sedes ?? []} />
          )}
        </div>

        <form action={logout} className="mt-4 text-center">
          <button type="submit" className="text-xs font-medium text-slate-400 hover:text-slate-600">
            Salir
          </button>
        </form>
      </div>
    </div>
  );
}
