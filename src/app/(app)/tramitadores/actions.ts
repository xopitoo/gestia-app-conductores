"use server";

import { revalidatePath } from "next/cache";
import { getViewerContext, resolveSedeId } from "@/lib/viewer";
import { getTramitadorExtracto, type MovimientoExtracto } from "@/lib/tramitador-saldo";
import { parsePagos } from "../ventas/parse-form-arrays";
import { adjuntarComprobantes } from "@/lib/comprobante-pago";
import { formatCOP } from "@/lib/format";
import type { MetodoPago } from "@/lib/supabase/types";

/**
 * Extracto cronológico de un tramitador — se pide bajo demanda (al abrir
 * el modal), no precargado para todos los tramitadores de la página, para
 * no multiplicar queries en una lista larga.
 */
export async function obtenerExtractoTramitador(tramitadorId: string): Promise<MovimientoExtracto[]> {
  const { supabase } = await getViewerContext();
  return getTramitadorExtracto(supabase, tramitadorId);
}

export async function crearTramitador(formData: FormData) {
  const { supabase, profile } = await getViewerContext();
  if (profile.role !== "admin") return;

  const nombre = String(formData.get("nombre") ?? "").trim();
  const precioEspecial = Number(formData.get("precio_especial") ?? 0);
  const sedeId = String(formData.get("sede_id") ?? "") || null;

  if (!nombre || !(precioEspecial >= 0)) return;

  await supabase.from("tramitadores").insert({
    organization_id: profile.organization_id!,
    sede_id: sedeId,
    nombre,
    precio_especial: precioEspecial,
    created_by: profile.id,
  });

  revalidatePath("/tramitadores");
  revalidatePath("/ventas/nueva");
}

/**
 * Corrige nombre/sede/precio especial de un tramitador ya cargado — mismo
 * criterio que editarProducto: solo admin, sin PIN (no es destructivo, se
 * puede volver a corregir).
 */
export async function editarTramitador(formData: FormData) {
  const { supabase, profile } = await getViewerContext();
  if (profile.role !== "admin") return;

  const id = String(formData.get("id") ?? "");
  const nombre = String(formData.get("nombre") ?? "").trim();
  const precioEspecial = Number(formData.get("precio_especial") ?? 0);
  const sedeId = String(formData.get("sede_id") ?? "") || null;

  if (!id || !nombre || !(precioEspecial >= 0)) return;

  await supabase
    .from("tramitadores")
    .update({ nombre, precio_especial: precioEspecial, sede_id: sedeId })
    .eq("id", id);

  revalidatePath("/tramitadores");
  revalidatePath("/ventas/nueva");
}

export type EliminarTramitadorState = {
  error?: string;
};

/**
 * Borrado real (no desactivar) — exige el PIN de autorización de la
 * organización. La función en la base de datos se niega sola si el
 * tramitador ya tiene ventas o pagos de comisión, así que ese caso siempre
 * vuelve acá como error en vez de borrar historial financiero.
 */
export async function eliminarTramitador(
  _prevState: EliminarTramitadorState,
  formData: FormData,
): Promise<EliminarTramitadorState> {
  const { supabase, profile } = await getViewerContext();
  if (profile.role !== "admin") return { error: "Solo un administrador puede eliminar tramitadores." };

  const id = String(formData.get("id") ?? "");
  const pin = String(formData.get("pin") ?? "");
  if (!id) return { error: "Falta el tramitador." };
  if (!pin) return { error: "Ingresá el PIN de autorización." };

  const { error } = await supabase.rpc("eliminar_tramitador", { p_tramitador_id: id, p_pin: pin });

  if (error) {
    if (error.message.includes("PIN")) {
      return { error: "PIN de autorización incorrecto." };
    }
    if (error.message.includes("ventas registradas") || error.message.includes("pagos de comisión")) {
      return { error: error.message };
    }
    return { error: "No se pudo eliminar el tramitador." };
  }

  revalidatePath("/tramitadores");
  revalidatePath("/ventas/nueva");
  return {};
}

export async function toggleTramitadorActive(formData: FormData) {
  const { supabase, profile } = await getViewerContext();
  if (profile.role !== "admin") return;

  const id = String(formData.get("id") ?? "");
  const active = String(formData.get("active") ?? "true") === "true";

  await supabase.from("tramitadores").update({ active: !active }).eq("id", id);
  revalidatePath("/tramitadores");
  revalidatePath("/ventas/nueva");
}

export type PagarComisionTramitadorState = {
  error?: string;
};

/**
 * Le paga al tramitador lo que le corresponde (su saldo a favor) — plata
 * real que sale de la caja de la sede elegida, así que también genera un
 * egreso ahí (afecta el cierre del día). Antes esto solo dejaba
 * constancia en tramitador_pagos sin tocar caja; ahora sí, porque el
 * dinero sale de verdad.
 */
export async function pagarComisionTramitador(
  _prevState: PagarComisionTramitadorState,
  formData: FormData,
): Promise<PagarComisionTramitadorState> {
  const ctx = await getViewerContext();
  const { supabase } = ctx;

  const tramitadorId = String(formData.get("tramitador_id") ?? "");
  const monto = Number(formData.get("monto") ?? 0);
  const metodoPago = String(formData.get("metodo_pago") ?? "efectivo") as MetodoPago;
  const nota = String(formData.get("nota") ?? "").trim() || null;
  const sedeId = resolveSedeId(ctx, String(formData.get("sede_id") ?? ""));

  if (!tramitadorId || !(monto > 0)) {
    return { error: "Ingresá un monto válido." };
  }
  if (!sedeId) {
    return { error: "No hay una sede seleccionada." };
  }

  const { error } = await supabase.rpc("registrar_comision_tramitador", {
    p_tramitador_id: tramitadorId,
    p_sede_id: sedeId,
    p_monto: monto,
    p_metodo_pago: metodoPago,
    p_nota: nota,
  });

  if (error) {
    if (error.message.includes("abrir caja")) {
      return { error: "Abrí la caja de esa sede antes de pagar la comisión." };
    }
    if (error.message.includes("suficiente saldo")) {
      return { error: "El tramitador no tiene suficiente saldo a favor." };
    }
    return { error: "No se pudo registrar el pago." };
  }

  revalidatePath("/tramitadores");
  revalidatePath("/caja");
  return {};
}

export type RegistrarAbonoTramitadorState = {
  error?: string;
  mensaje?: string;
};

/**
 * El tramitador (no un cliente puntual) salda lo que debe. Primero se
 * aplica automáticamente cualquier saldo a favor que ya tuviera (crédito
 * de comisiones no cobradas), y lo que quede pendiente se reparte entre
 * sus ventas de la sede elegida, de la más vieja a la más nueva. Esa
 * parte SÍ entra a la caja real como efectivo; el cruce con el crédito no
 * (ver registrar_abono_tramitador en schema.sql). p_pagos puede llegar
 * vacío si el crédito ya cubrió todo.
 */
export async function registrarAbonoTramitador(
  _prevState: RegistrarAbonoTramitadorState,
  formData: FormData,
): Promise<RegistrarAbonoTramitadorState> {
  const ctx = await getViewerContext();
  const { supabase, profile } = ctx;

  const tramitadorId = String(formData.get("tramitador_id") ?? "");
  const pagos = parsePagos(String(formData.get("pagos") ?? "[]"));
  const sedeId = resolveSedeId(ctx, String(formData.get("sede_id") ?? ""));

  if (!tramitadorId) {
    return { error: "Falta el tramitador." };
  }
  if (!sedeId) {
    return { error: "No hay una sede seleccionada." };
  }

  const adjunto = await adjuntarComprobantes(supabase, formData, pagos, profile.organization_id!);
  if ("error" in adjunto) {
    return { error: adjunto.error };
  }

  const { data, error } = await supabase
    .rpc("registrar_abono_tramitador", {
      p_tramitador_id: tramitadorId,
      p_sede_id: sedeId,
      p_pagos: adjunto.pagos,
    })
    .single();

  if (error) {
    if (error.message.includes("abrir caja")) {
      return { error: "Abrí la caja de esa sede antes de registrar el abono." };
    }
    if (error.message.includes("supera lo que debe")) {
      return { error: "El pago supera lo que debe el tramitador en esa sede." };
    }
    if (error.message.includes("al menos un pago")) {
      return { error: "Registrá al menos un pago." };
    }
    return { error: "No se pudo registrar el abono." };
  }

  revalidatePath("/tramitadores");
  revalidatePath("/ventas");
  revalidatePath("/caja");

  const totalCruzado = Number(data?.total_cruzado ?? 0);
  const mensaje = totalCruzado > 0 ? `Se aplicó ${formatCOP(totalCruzado)} de crédito a favor automáticamente.` : undefined;
  return { mensaje };
}

/**
 * Fija (o reemplaza) el precio especial de un tramitador para un producto
 * puntual — ej. un tramitador cobra distinto para "Examen 1 categoría" que
 * para "Examen 2 categorías". Se usa upsert porque solo puede haber un
 * precio por combinación tramitador+producto (índice único en la tabla).
 */
export async function guardarPrecioProducto(formData: FormData) {
  const { supabase, profile } = await getViewerContext();
  if (profile.role !== "admin") return;

  const tramitadorId = String(formData.get("tramitador_id") ?? "");
  const productoId = String(formData.get("producto_id") ?? "");
  const precioEspecial = Number(formData.get("precio_especial") ?? 0);

  if (!tramitadorId || !productoId || !(precioEspecial >= 0)) return;

  await supabase
    .from("tramitador_precios")
    .upsert(
      {
        tramitador_id: tramitadorId,
        producto_id: productoId,
        organization_id: profile.organization_id!,
        precio_especial: precioEspecial,
      },
      { onConflict: "tramitador_id,producto_id" },
    );

  revalidatePath("/tramitadores");
  revalidatePath("/ventas/nueva");
}

export async function eliminarPrecioProducto(formData: FormData) {
  const { supabase, profile } = await getViewerContext();
  if (profile.role !== "admin") return;

  const id = String(formData.get("id") ?? "");
  if (!id) return;

  await supabase.from("tramitador_precios").delete().eq("id", id);
  revalidatePath("/tramitadores");
  revalidatePath("/ventas/nueva");
}
