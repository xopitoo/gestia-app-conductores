"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

export type ProvisionState = {
  error?: string;
};

export async function provisionOrganization(
  _prevState: ProvisionState,
  formData: FormData,
): Promise<ProvisionState> {
  // 1) Re-chequear con el cliente normal (RLS-bound) que quien llama es
  // realmente platform_owner, ANTES de tocar el cliente admin.
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return { error: "No autorizado." };
  }
  const { data: caller } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single();
  if (caller?.role !== "platform_owner") {
    return { error: "No autorizado." };
  }

  const orgName = String(formData.get("org_name") ?? "").trim();
  const orgSlug = String(formData.get("org_slug") ?? "").trim().toLowerCase();
  const sedeName = String(formData.get("sede_name") ?? "").trim();
  const adminFullName = String(formData.get("admin_full_name") ?? "").trim();
  const adminEmail = String(formData.get("admin_email") ?? "").trim();
  const adminPassword = String(formData.get("admin_password") ?? "");

  if (!orgName || !orgSlug || !sedeName || !adminFullName || !adminEmail || !adminPassword) {
    return { error: "Completá todos los campos." };
  }
  if (adminPassword.length < 8) {
    return { error: "La contraseña debe tener al menos 8 caracteres." };
  }
  if (!/^[a-z0-9-]+$/.test(orgSlug)) {
    return { error: "El slug solo puede tener minúsculas, números y guiones." };
  }

  const admin = createAdminClient();

  // 2) organización
  const { data: organization, error: orgError } = await admin
    .from("organizations")
    .insert({ name: orgName, slug: orgSlug })
    .select("id")
    .single();

  if (orgError || !organization) {
    return {
      error: orgError?.code === "23505" ? "Ya existe una organización con ese slug." : "No se pudo crear la organización.",
    };
  }

  // 3) primera sede
  const { data: sede, error: sedeError } = await admin
    .from("sedes")
    .insert({ organization_id: organization.id, name: sedeName })
    .select("id")
    .single();

  if (sedeError || !sede) {
    await admin.from("organizations").delete().eq("id", organization.id);
    return { error: "No se pudo crear la sede inicial." };
  }

  // 4) primer usuario admin de la organización
  const { error: userError } = await admin.auth.admin.createUser({
    email: adminEmail,
    password: adminPassword,
    email_confirm: true,
    user_metadata: {
      full_name: adminFullName,
      role: "admin",
      organization_id: organization.id,
    },
  });

  if (userError) {
    // 5) cleanup best-effort — no es una transacción real cross-sistema,
    // la Admin API de Supabase no lo permite.
    await admin.from("organizations").delete().eq("id", organization.id);
    return {
      error: userError.message.includes("already") ? "Ese email ya está en uso." : "No se pudo crear el usuario admin.",
    };
  }

  redirect(`/platform/organizaciones/${organization.id}`);
}
