"use server";

import { revalidatePath } from "next/cache";
import { getViewerContext } from "@/lib/viewer";
import type { DescuentoTipo } from "@/lib/supabase/types";

export type DescuentoFormState = {
  error?: string;
};

export async function aplicarDescuento(
  _prevState: DescuentoFormState,
  formData: FormData,
): Promise<DescuentoFormState> {
  const { supabase, profile } = await getViewerContext();
  if (profile.role !== "admin") {
    return { error: "Solo un administrador puede aplicar descuentos." };
  }

  const ventaId = String(formData.get("venta_id") ?? "");
  const tipo = (String(formData.get("descuento_tipo") ?? "") || null) as DescuentoTipo | null;
  const valor = Number(formData.get("descuento_valor") ?? 0) || 0;

  if (!ventaId) {
    return { error: "Venta inválida." };
  }

  const { error } = await supabase.rpc("aplicar_descuento_venta", {
    p_venta_id: ventaId,
    p_descuento_tipo: tipo,
    p_descuento_valor: valor,
  });

  if (error) {
    if (error.message.includes("por debajo de lo ya pagado")) {
      return { error: "El descuento no puede dejar el total por debajo de lo ya pagado." };
    }
    if (error.message.includes("Solo un administrador")) {
      return { error: "Solo un administrador puede aplicar descuentos." };
    }
    if (error.message.includes("descuento")) {
      return { error: error.message };
    }
    return { error: "No se pudo aplicar el descuento." };
  }

  revalidatePath("/mora");
  revalidatePath(`/ventas/${ventaId}`);
  revalidatePath("/ventas");
  revalidatePath("/dashboard");
  return {};
}

export type AgregarItemFormState = {
  error?: string;
};

export async function agregarItem(
  _prevState: AgregarItemFormState,
  formData: FormData,
): Promise<AgregarItemFormState> {
  const { supabase, profile } = await getViewerContext();
  if (profile.role !== "admin") {
    return { error: "Solo un administrador puede anexar productos." };
  }

  const ventaId = String(formData.get("venta_id") ?? "");
  const productoId = String(formData.get("producto_id") ?? "") || null;
  const nombre = String(formData.get("nombre") ?? "").trim();
  const precio = Number(formData.get("precio") ?? 0) || 0;

  if (!ventaId || !nombre || !(precio > 0)) {
    return { error: "Completá el producto y un precio válido." };
  }

  const { error } = await supabase.rpc("agregar_item_venta", {
    p_venta_id: ventaId,
    p_producto_id: productoId,
    p_nombre: nombre,
    p_precio: precio,
  });

  if (error) {
    if (error.message.includes("Solo un administrador")) {
      return { error: "Solo un administrador puede anexar productos." };
    }
    if (error.message.includes("nombre") || error.message.includes("precio") || error.message.includes("anulada")) {
      return { error: error.message };
    }
    return { error: "No se pudo anexar el producto." };
  }

  revalidatePath("/mora");
  revalidatePath(`/ventas/${ventaId}`);
  revalidatePath("/ventas");
  revalidatePath("/dashboard");
  return {};
}
