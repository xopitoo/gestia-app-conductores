"use server";

import { redirect } from "next/navigation";
import { getViewerContext } from "@/lib/viewer";

/**
 * Logout con candado: si un recepcionista tiene la caja de su sede
 * abierta, no lo deja salir — lo manda a /caja a cerrarla primero. Un
 * admin nunca queda bloqueado acá.
 */
export async function logoutGuarded() {
  const ctx = await getViewerContext();
  const { supabase, profile } = ctx;

  if (profile.role === "recepcionista" && profile.sede_id) {
    const { data } = await supabase
      .from("caja_sesiones")
      .select("id")
      .eq("sede_id", profile.sede_id)
      .eq("estado", "abierta")
      .maybeSingle();

    if (data) {
      redirect("/caja?cerrar=1");
    }
  }

  await supabase.auth.signOut();
  redirect("/login");
}
