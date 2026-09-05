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

  revalidatePath("/admin/mora");
  revalidatePath(`/ventas/${ventaId}`);
  revalidatePath("/ventas");
  revalidatePath("/dashboard");
  return {};
}
