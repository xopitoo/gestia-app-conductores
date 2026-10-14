"use server";

import { revalidatePath } from "next/cache";
import { getViewerContext } from "@/lib/viewer";

/** El form manda el % tal cual lo escribe el admin (ej. "2.1176"); acá se guarda como fracción. */
function porcentajeAFraccion(valor: FormDataEntryValue | null): number {
  return (Number(valor ?? 0) || 0) / 100;
}

export async function editarFinanciadora(formData: FormData) {
  const { supabase, profile } = await getViewerContext();
  if (profile.role !== "admin") return;

  const id = String(formData.get("id") ?? "");
  const tasaMensual = porcentajeAFraccion(formData.get("tasa_mensual_pct"));
  const tasaSeguro = porcentajeAFraccion(formData.get("tasa_seguro_pct"));
  const plazoMax = Number(formData.get("plazo_max") ?? 0);
  const active = formData.get("active") === "on";

  if (!id || !(plazoMax > 0) || tasaMensual < 0 || tasaSeguro < 0) return;

  await supabase
    .from("financiadoras")
    .update({ tasa_mensual: tasaMensual, tasa_seguro: tasaSeguro, plazo_max: plazoMax, active })
    .eq("id", id);

  revalidatePath("/simulador-credito");
}

export async function crearFinanciadora(formData: FormData) {
  const { supabase, profile } = await getViewerContext();
  if (profile.role !== "admin") return;

  const nombre = String(formData.get("nombre") ?? "").trim();
  const tasaMensual = porcentajeAFraccion(formData.get("tasa_mensual_pct"));
  const tasaSeguro = porcentajeAFraccion(formData.get("tasa_seguro_pct"));
  const plazoMax = Number(formData.get("plazo_max") ?? 36) || 36;

  if (!nombre) return;

  await supabase.from("financiadoras").insert({
    organization_id: profile.organization_id!,
    nombre,
    tasa_mensual: tasaMensual,
    tasa_seguro: tasaSeguro,
    plazo_max: plazoMax,
    active: false,
    created_by: profile.id,
  });

  revalidatePath("/simulador-credito");
}
