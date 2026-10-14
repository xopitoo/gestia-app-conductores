"use server";

import { revalidatePath } from "next/cache";
import { getViewerContext } from "@/lib/viewer";

export async function editarPorcentajeCurso(formData: FormData) {
  const { supabase, profile } = await getViewerContext();
  if (profile.role !== "admin") return;

  const porcentajeCurso = (Number(formData.get("porcentaje_curso_pct") ?? 0) || 0) / 100;
  if (porcentajeCurso < 0 || porcentajeCurso > 1) return;

  await supabase
    .from("curso_infractores_config")
    .update({ porcentaje_curso: porcentajeCurso })
    .eq("organization_id", profile.organization_id!);

  revalidatePath("/curso-infractores");
}
