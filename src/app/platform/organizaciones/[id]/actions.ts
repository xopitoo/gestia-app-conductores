"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

async function assertPlatformOwner() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("No autorizado");

  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single();

  if (profile?.role !== "platform_owner") throw new Error("No autorizado");
}

export async function toggleOrganizationActive(formData: FormData) {
  await assertPlatformOwner();

  const id = String(formData.get("id") ?? "");
  const active = String(formData.get("active") ?? "true") === "true";

  const admin = createAdminClient();
  await admin.from("organizations").update({ active: !active }).eq("id", id);
  revalidatePath(`/platform/organizaciones/${id}`);
  revalidatePath("/platform");
}
