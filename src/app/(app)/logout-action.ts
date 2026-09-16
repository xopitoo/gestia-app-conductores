"use server";

import { redirect } from "next/navigation";
import { getViewerContext } from "@/lib/viewer";

export type LogoutState = {
  error?: string;
  /** true = la caja de su sede sigue abierta; hace falta el PIN de admin para salir igual. */
  requierePin?: boolean;
};

/**
 * Logout con candado: si un recepcionista tiene la caja de su sede
 * abierta, no lo deja salir directo — pide el PIN de administrador (el
 * mismo que autoriza ventas con menos del 50% de pago inicial). Con el
 * PIN correcto sale igual, sin cerrar la caja por él; sin PIN, o con uno
 * incorrecto, se queda adentro. Un admin nunca queda bloqueado acá.
 */
export async function logoutGuarded(
  _prevState: LogoutState,
  formData: FormData,
): Promise<LogoutState> {
  const ctx = await getViewerContext();
  const { supabase, profile } = ctx;
  const pin = String(formData.get("pin") ?? "").trim();

  if (profile.role === "recepcionista" && profile.sede_id) {
    const { data } = await supabase
      .from("caja_sesiones")
      .select("id")
      .eq("sede_id", profile.sede_id)
      .eq("estado", "abierta")
      .maybeSingle();

    if (data) {
      if (!pin) {
        return { requierePin: true };
      }
      const { data: valido } = await supabase.rpc("verify_org_pin", { p_pin: pin });
      if (!valido) {
        return { requierePin: true, error: "PIN incorrecto." };
      }
    }
  }

  await supabase.auth.signOut();
  redirect("/login");
}
