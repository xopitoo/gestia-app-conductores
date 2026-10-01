"use server";

import { revalidatePath } from "next/cache";
import { getViewerContext, resolveSedeId } from "@/lib/viewer";
import { enviarCorreoCierreCaja } from "@/lib/caja-cierre-email";

export type CajaActionState = {
  error?: string;
};

export async function abrirCaja(
  _prevState: CajaActionState,
  formData: FormData,
): Promise<CajaActionState> {
  const ctx = await getViewerContext();
  const { supabase, profile } = ctx;
  const sedeId = resolveSedeId(ctx, String(formData.get("sede_id") ?? ""));
  const openingBalance = Number(formData.get("opening_balance") ?? 0) || 0;

  if (!sedeId) {
    return { error: "No hay una sede seleccionada." };
  }

  const { error } = await supabase.from("caja_sesiones").insert({
    organization_id: profile.organization_id!,
    sede_id: sedeId,
    opened_by: profile.id,
    opening_balance: openingBalance,
  });

  if (error) {
    if (error.code === "23505") {
      return { error: "Ya hay una caja abierta para esta sede." };
    }
    return { error: "No se pudo abrir la caja." };
  }

  revalidatePath("/caja");
  return {};
}

export async function cerrarCaja(
  _prevState: CajaActionState,
  formData: FormData,
): Promise<CajaActionState> {
  const { supabase, profile } = await getViewerContext();
  const sesionId = String(formData.get("sesion_id") ?? "");
  const closingBalance = Number(formData.get("closing_balance") ?? 0) || 0;

  if (!sesionId) {
    return { error: "Sesión de caja inválida." };
  }

  const { data: sesion, error } = await supabase
    .from("caja_sesiones")
    .update({
      estado: "cerrada",
      closed_by: profile.id,
      closed_at: new Date().toISOString(),
      closing_balance: closingBalance,
    })
    .eq("id", sesionId)
    .select("sede_id, opened_at, closed_at, opening_balance")
    .single();

  if (error || !sesion) {
    return { error: "No se pudo cerrar la caja." };
  }

  revalidatePath("/caja");

  // El correo de aviso nunca debe tumbar el cierre: si falla (Resend caído,
  // falta la sede, lo que sea) la caja ya quedó cerrada igual.
  try {
    const { data: sede } = await supabase.from("sedes").select("name").eq("id", sesion.sede_id).single();
    await enviarCorreoCierreCaja(supabase, {
      sesionId,
      sedeNombre: sede?.name ?? "—",
      openedAt: sesion.opened_at,
      closedAt: sesion.closed_at!,
      openingBalance: sesion.opening_balance,
      closingBalanceContado: closingBalance,
      tipo: "manual",
      closedByNombre: profile.full_name,
    });
  } catch (err) {
    console.error("[cerrarCaja] No se pudo enviar el correo de cierre:", err);
  }

  return {};
}

export async function registrarEgreso(
  _prevState: CajaActionState,
  formData: FormData,
): Promise<CajaActionState> {
  const { supabase, profile } = await getViewerContext();
  const sesionId = String(formData.get("sesion_id") ?? "");
  const sedeId = String(formData.get("sede_id") ?? "");
  const concepto = String(formData.get("concepto") ?? "").trim();
  const monto = Number(formData.get("monto") ?? 0);
  const metodoPago = String(formData.get("metodo_pago") ?? "efectivo");

  if (!sesionId || !sedeId || !concepto || !(monto > 0)) {
    return { error: "Completá el concepto y un monto válido." };
  }

  const { error } = await supabase.from("caja_movimientos").insert({
    caja_sesion_id: sesionId,
    organization_id: profile.organization_id!,
    sede_id: sedeId,
    tipo: "egreso",
    concepto,
    monto,
    metodo_pago: metodoPago as "efectivo" | "tarjeta" | "transferencia" | "otro",
    created_by: profile.id,
  });

  if (error) {
    return { error: "No se pudo registrar el egreso." };
  }

  revalidatePath("/caja");
  return {};
}
