"use server";

import { revalidatePath } from "next/cache";
import { getViewerContext } from "@/lib/viewer";

export async function crearSede(formData: FormData) {
  const { supabase, profile } = await getViewerContext();
  if (profile.role !== "admin") return;

  const name = String(formData.get("name") ?? "").trim();
  const address = String(formData.get("address") ?? "").trim() || null;
  if (!name) return;

  await supabase.from("sedes").insert({
    organization_id: profile.organization_id!,
    name,
    address,
  });

  revalidatePath("/admin/sedes");
}

export async function toggleSedeActive(formData: FormData) {
  const { supabase, profile } = await getViewerContext();
  if (profile.role !== "admin") return;

  const id = String(formData.get("id") ?? "");
  const active = String(formData.get("active") ?? "true") === "true";

  await supabase.from("sedes").update({ active: !active }).eq("id", id);
  revalidatePath("/admin/sedes");
}
