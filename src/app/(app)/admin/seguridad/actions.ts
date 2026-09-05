"use server";

import { getViewerContext } from "@/lib/viewer";

export type PinFormState = {
  error?: string;
  success?: boolean;
};

export async function actualizarPin(
  _prevState: PinFormState,
  formData: FormData,
): Promise<PinFormState> {
  const { supabase, profile } = await getViewerContext();
  if (profile.role !== "admin") {
    return { error: "No autorizado." };
  }

  const pin = String(formData.get("pin") ?? "");
  const confirmacion = String(formData.get("pin_confirmacion") ?? "");

  if (pin.length < 4) {
    return { error: "El PIN debe tener al menos 4 caracteres." };
  }
  if (pin !== confirmacion) {
    return { error: "Los dos PIN no coinciden." };
  }

  const { error } = await supabase.rpc("set_org_pin", { p_pin: pin });

  if (error) {
    return { error: "No se pudo guardar el PIN." };
  }

  return { success: true };
}
