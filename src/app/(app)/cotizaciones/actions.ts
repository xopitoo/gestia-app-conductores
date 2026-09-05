"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getViewerContext, resolveSedeId } from "@/lib/viewer";
import { parseItems } from "../ventas/parse-form-arrays";

export type CotizacionFormState = {
  error?: string;
};

export async function crearCotizacion(
  _prevState: CotizacionFormState,
  formData: FormData,
): Promise<CotizacionFormState> {
  const ctx = await getViewerContext();
  const { supabase, profile } = ctx;

  const sedeId = resolveSedeId(ctx, String(formData.get("sede_id") ?? ""));
  const clienteId = String(formData.get("cliente_id") ?? "");
  const items = parseItems(String(formData.get("items") ?? "[]"));
  const referidoNombre = String(formData.get("referido_nombre") ?? "").trim() || null;
  const validaHasta = String(formData.get("valida_hasta") ?? "").trim() || null;

  if (!sedeId || !clienteId) {
    return { error: "Completá el cliente." };
  }
  if (items.length === 0) {
    return { error: "Elegí al menos un producto." };
  }

  const { data, error } = await supabase.rpc("crear_cotizacion", {
    p_sede_id: sedeId,
    p_cliente_id: clienteId,
    p_items: items,
    p_vendedor_id: profile.id,
    p_referido_nombre: referidoNombre,
    p_valida_hasta: validaHasta,
  });

  if (error || !data) {
    return { error: "No se pudo crear la cotización." };
  }

  revalidatePath("/cotizaciones");
  redirect(`/cotizaciones/${data.id}`);
}

export async function rechazarCotizacion(formData: FormData) {
  const { supabase } = await getViewerContext();
  const id = String(formData.get("id") ?? "");

  await supabase.from("cotizaciones").update({ estado: "rechazada" }).eq("id", id).eq("estado", "pendiente");
  revalidatePath("/cotizaciones");
  revalidatePath(`/cotizaciones/${id}`);
}
