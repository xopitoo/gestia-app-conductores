"use server";

import { revalidatePath } from "next/cache";
import { getViewerContext } from "@/lib/viewer";
import type { Categoria } from "@/lib/supabase/types";

export async function crearProducto(formData: FormData) {
  const { supabase, profile } = await getViewerContext();
  if (profile.role !== "admin") return;

  const nombre = String(formData.get("nombre") ?? "").trim();
  const descripcion = String(formData.get("descripcion") ?? "").trim() || null;
  const precio = Number(formData.get("precio") ?? 0);
  const categoria = (String(formData.get("categoria") ?? "") || null) as Categoria | null;
  const sedeId = String(formData.get("sede_id") ?? "") || null;

  if (!nombre || !(precio >= 0)) return;

  await supabase.from("productos").insert({
    organization_id: profile.organization_id!,
    sede_id: sedeId,
    nombre,
    descripcion,
    precio,
    categoria,
    created_by: profile.id,
  });

  revalidatePath("/admin/productos");
  revalidatePath("/ventas/nueva");
}

export async function toggleProductoActive(formData: FormData) {
  const { supabase, profile } = await getViewerContext();
  if (profile.role !== "admin") return;

  const id = String(formData.get("id") ?? "");
  const active = String(formData.get("active") ?? "true") === "true";

  await supabase.from("productos").update({ active: !active }).eq("id", id);
  revalidatePath("/admin/productos");
  revalidatePath("/ventas/nueva");
}
