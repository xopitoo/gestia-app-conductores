"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

export type LoginState = {
  error?: string;
};

export async function login(
  _prevState: LoginState,
  formData: FormData,
): Promise<LoginState> {
  const email = String(formData.get("email") ?? "").trim();
  const password = String(formData.get("password") ?? "");
  const redirectTo = String(formData.get("redirectTo") ?? "/");

  if (!email || !password) {
    return { error: "Completá tu email y tu contraseña." };
  }

  const supabase = await createClient();

  const { data: lockout } = await supabase.rpc("check_login_lockout", {
    p_email: email,
  });
  if (lockout?.locked) {
    const minutos = Math.max(1, Math.ceil((lockout.retry_after_seconds ?? 0) / 60));
    return {
      error: `Demasiados intentos fallidos. Probá de nuevo en ${minutos} minuto${minutos === 1 ? "" : "s"}.`,
    };
  }

  const { error } = await supabase.auth.signInWithPassword({
    email,
    password,
  });

  await supabase.rpc("record_login_attempt", {
    p_email: email,
    p_success: !error,
  });

  if (error) {
    return { error: "Email o contraseña incorrectos." };
  }

  redirect(redirectTo.startsWith("/") ? redirectTo : "/");
}

export async function logout() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/login");
}
