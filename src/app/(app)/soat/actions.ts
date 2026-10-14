"use server";

import { revalidatePath } from "next/cache";
import { getViewerContext } from "@/lib/viewer";

export async function editarSoatTarifa(formData: FormData) {
  const { supabase, profile } = await getViewerContext();
  if (profile.role !== "admin") return;

  const id = String(formData.get("id") ?? "");
  const prima = Number(formData.get("prima") ?? 0);
  const contribucion = Number(formData.get("contribucion") ?? 0);
  const tasaRunt = Number(formData.get("tasa_runt") ?? 0);
  const total = Number(formData.get("total") ?? 0);

  if (!id || prima < 0 || contribucion < 0 || tasaRunt < 0 || total < 0) return;

  await supabase
    .from("soat_tarifas")
    .update({ prima, contribucion, tasa_runt: tasaRunt, total })
    .eq("id", id);

  revalidatePath("/soat");
}
