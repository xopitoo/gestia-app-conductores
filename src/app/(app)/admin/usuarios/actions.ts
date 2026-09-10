"use server";

import { revalidatePath } from "next/cache";
import { getViewerContext } from "@/lib/viewer";
import { createAdminClient } from "@/lib/supabase/admin";

export type UsuarioFormState = {
  error?: string;
};

export async function crearUsuarioRecepcionista(
  _prevState: UsuarioFormState,
  formData: FormData,
): Promise<UsuarioFormState> {
  const { profile } = await getViewerContext();
  if (profile.role !== "admin") {
    return { error: "No autorizado." };
  }

  const fullName = String(formData.get("full_name") ?? "").trim();
  const email = String(formData.get("email") ?? "").trim();
  const password = String(formData.get("password") ?? "");
  // Opcional: si no se asigna acá, el usuario elige su sede al ingresar
  // por primera vez (ver /elegir-sede).
  const sedeId = String(formData.get("sede_id") ?? "");

  if (!fullName || !email || !password) {
    return { error: "Completá nombre, email y contraseña." };
  }
  if (password.length < 8) {
    return { error: "La contraseña debe tener al menos 8 caracteres." };
  }

  const admin = createAdminClient();
  const { error } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: {
      full_name: fullName,
      role: "recepcionista",
      organization_id: profile.organization_id,
      sede_id: sedeId,
    },
  });

  if (error) {
    return { error: error.message.includes("already") ? "Ese email ya está en uso." : "No se pudo crear la cuenta." };
  }

  revalidatePath("/admin/usuarios");
  return {};
}

/**
 * Reasigna la sede de un recepcionista ya creado (ej. lo movés a una sede
 * nueva). `sede_id` bloqueado por lock_profile_privileged_columns para
 * updates normales — hace falta el cliente admin (service role), igual que
 * toggleUsuarioActive con `active`.
 */
export async function cambiarSedeUsuario(formData: FormData) {
  const { profile } = await getViewerContext();
  if (profile.role !== "admin") return;

  const id = String(formData.get("id") ?? "");
  const sedeId = String(formData.get("sede_id") ?? "") || null;
  if (!id) return;

  const admin = createAdminClient();
  await admin.from("profiles").update({ sede_id: sedeId }).eq("id", id);
  revalidatePath("/admin/usuarios");
}

export async function toggleUsuarioActive(formData: FormData) {
  const { profile } = await getViewerContext();
  if (profile.role !== "admin") return;

  const id = String(formData.get("id") ?? "");
  const active = String(formData.get("active") ?? "true") === "true";

  const admin = createAdminClient();
  await admin.from("profiles").update({ active: !active }).eq("id", id);
  revalidatePath("/admin/usuarios");
}
