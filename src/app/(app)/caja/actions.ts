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

type SupabaseCtx = Awaited<ReturnType<typeof getViewerContext>>["supabase"];

/** El cierre solo exige PIN en ventas desde el 5/11/2026 (00:00 Bogotá): las anteriores quedaron sin PIN y no bloquean. */
const PINES_EXIGIDOS_DESDE = "2026-11-05T05:00:00Z";

/** Cuántas ventas vivas de la sesión tienen menos PIN registrados que cursos reales en sus productos. */
async function ventasConPinesFaltantes(supabase: SupabaseCtx, sesionId: string): Promise<number> {
  const { data: sesion } = await supabase.from("caja_sesiones").select("sede_id, opened_at").eq("id", sesionId).maybeSingle();
  if (!sesion) return 0;
  const { data: ventas } = await supabase
    .from("ventas")
    .select("id")
    .eq("sede_id", sesion.sede_id)
    .gte("created_at", sesion.opened_at > PINES_EXIGIDOS_DESDE ? sesion.opened_at : PINES_EXIGIDOS_DESDE)
    .neq("estado", "anulada");
  const ventaIds = (ventas ?? []).map((v) => v.id);
  if (ventaIds.length === 0) return 0;

  const [{ data: items }, { data: pines }] = await Promise.all([
    supabase.from("venta_items").select("venta_id, producto_id").in("venta_id", ventaIds),
    supabase.from("venta_pines").select("venta_id").in("venta_id", ventaIds),
  ]);
  const productoIds = [...new Set((items ?? []).map((i) => i.producto_id).filter((x): x is string => !!x))];
  if (productoIds.length === 0) return 0;
  const { data: productos } = await supabase.from("productos").select("id, cursos_reales").in("id", productoIds);
  const cursos = new Map((productos ?? []).map((p) => [p.id, p.cursos_reales ?? 0]));

  const requeridos = new Map<string, number>();
  for (const i of items ?? []) {
    if (!i.producto_id) continue;
    requeridos.set(i.venta_id, (requeridos.get(i.venta_id) ?? 0) + (cursos.get(i.producto_id) ?? 0));
  }
  const registrados = new Map<string, number>();
  for (const p of pines ?? []) registrados.set(p.venta_id, (registrados.get(p.venta_id) ?? 0) + 1);

  let faltantes = 0;
  for (const [ventaId, n] of requeridos) if (n > (registrados.get(ventaId) ?? 0)) faltantes += 1;
  return faltantes;
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

  // Control de PINES de curso: no se cierra la caja mientras alguna venta de
  // la sesión tenga cursos (A2/B1/C1, combos) sin su PIN registrado.
  const faltantes = await ventasConPinesFaltantes(supabase, sesionId);
  if (faltantes > 0) {
    return {
      error: `Hay ${faltantes} ${faltantes === 1 ? "venta" : "ventas"} con curso sin PIN. Abrilas desde Ventas y registrá el PIN antes de cerrar la caja.`,
    };
  }

  const { error } = await supabase
    .from("caja_sesiones")
    .update({
      estado: "cerrada",
      closed_by: profile.id,
      closed_at: new Date().toISOString(),
      closing_balance: closingBalance,
    })
    .eq("id", sesionId);

  if (error) {
    return { error: "No se pudo cerrar la caja." };
  }

  revalidatePath("/caja");

  // El correo de aviso nunca debe tumbar el cierre: si falla (Resend caído,
  // lo que sea) la caja ya quedó cerrada igual.
  try {
    await enviarCorreoCierreCaja(supabase, sesionId);
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

/** Solo admin: marca (o desmarca) que recibió el efectivo de una caja ya cerrada. */
export async function marcarCajaRecibida(sesionId: string, recibida: boolean): Promise<CajaActionState> {
  const { supabase, profile } = await getViewerContext();
  if (profile.role !== "admin") {
    return { error: "Solo un administrador puede marcar cajas como recibidas." };
  }

  const { data: sesion } = await supabase
    .from("caja_sesiones")
    .select("estado")
    .eq("id", sesionId)
    .maybeSingle();
  if (!sesion) return { error: "No se encontró la caja." };
  if (sesion.estado !== "cerrada") return { error: "La caja todavía está abierta." };

  const { error } = await supabase
    .from("caja_sesiones")
    .update(
      recibida
        ? { recibida_at: new Date().toISOString(), recibida_by: profile.id }
        : { recibida_at: null, recibida_by: null },
    )
    .eq("id", sesionId);
  if (error) return { error: "No se pudo actualizar la caja." };

  revalidatePath("/caja");
  return {};
}
