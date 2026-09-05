"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

export type ElegirSedeState = {
  error?: string;
};

export async function elegirSede(
  _prevState: ElegirSedeState,
  formData: FormData,
): Promise<ElegirSedeState> {
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

  if (!profile || !profile.active || profile.role !== "recepcionista" || !profile.organization_id) {
    return { error: "No autorizado." };
  }
  if (profile.sede_id) {
    // Ya tiene sede asignada — no se reasigna desde acá.
    redirect("/dashboard");
  }

  const sedeId = String(formData.get("sede_id") ?? "");
  if (!sedeId) {
    return { error: "Seleccioná una sede." };
  }

  // La sede elegida tiene que pertenecer a la organización del usuario y
  // estar activa — nunca confiar en el valor del form sin esta verificación.
  const { data: sede } = await supabase
    .from("sedes")
    .select("id")
    .eq("id", sedeId)
    .eq("organization_id", profile.organization_id)
    .eq("active", true)
    .maybeSingle();

  if (!sede) {
    return { error: "Esa sede no es válida." };
  }

  const admin = createAdminClient();
  const { error } = await admin.from("profiles").update({ sede_id: sedeId }).eq("id", user.id);

  if (error) {
    return { error: "No se pudo guardar la sede." };
  }

  redirect("/ventas");
}
