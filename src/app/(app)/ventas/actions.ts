"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getViewerContext, resolveSedeId } from "@/lib/viewer";
import { parseItems, parsePagos } from "./parse-form-arrays";
import type { DescuentoTipo } from "@/lib/supabase/types";

export type VentaFormState = {
  error?: string;
};

export async function registrarVenta(
  _prevState: VentaFormState,
  formData: FormData,
): Promise<VentaFormState> {
  const ctx = await getViewerContext();
  const { supabase, profile } = ctx;

  const sedeId = resolveSedeId(ctx, String(formData.get("sede_id") ?? ""));
  const clienteId = String(formData.get("cliente_id") ?? "");
  const items = parseItems(String(formData.get("items") ?? "[]"));
  const pagos = parsePagos(String(formData.get("pagos") ?? "[]"));
  const pin = String(formData.get("pin") ?? "") || null;
  const referidoNombre = String(formData.get("referido_nombre") ?? "").trim() || null;
  const descuentoTipo = (String(formData.get("descuento_tipo") ?? "") || null) as DescuentoTipo | null;
  const descuentoValor = Number(formData.get("descuento_valor") ?? 0) || 0;

  if (!sedeId || !clienteId) {
    return { error: "Completá el cliente." };
  }
  if (items.length === 0) {
    return { error: "Elegí al menos un producto." };
  }
  if (pagos.length === 0) {
    return { error: "Registrá al menos un pago." };
  }

  const { error } = await supabase.rpc("registrar_venta", {
    p_sede_id: sedeId,
    p_cliente_id: clienteId,
    p_items: items,
    p_pagos: pagos,
    p_vendedor_id: profile.id,
    p_pin: pin,
    p_referido_nombre: referidoNombre,
    p_descuento_tipo: descuentoTipo,
    p_descuento_valor: descuentoValor,
  });

  if (error) {
    if (error.message.includes("abrir caja")) {
      return { error: "Debés abrir la caja de la sede antes de registrar una venta." };
    }
    if (error.message.includes("PIN")) {
      return { error: "PIN de autorización incorrecto." };
    }
    if (error.message.includes("descuento")) {
      return { error: error.message };
    }
    if (error.message.includes("superar el total")) {
      return { error: "El pago no puede superar el total de la orden." };
    }
    return { error: "No se pudo registrar la venta." };
  }

  revalidatePath("/ventas");
  revalidatePath("/caja");
  redirect("/ventas");
}

export async function anularVenta(formData: FormData) {
  const { supabase } = await getViewerContext();
  const id = String(formData.get("id") ?? "");

  await supabase.from("ventas").update({ estado: "anulada" }).eq("id", id);
  revalidatePath("/ventas");
}
