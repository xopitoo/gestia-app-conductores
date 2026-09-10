"use server";

import { revalidatePath } from "next/cache";
import { getViewerContext } from "@/lib/viewer";

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

  revalidatePath("/admin/tramitadores");
  revalidatePath("/ventas/nueva");
}

export async function toggleTramitadorActive(formData: FormData) {
  const { supabase, profile } = await getViewerContext();
  if (profile.role !== "admin") return;

  const id = String(formData.get("id") ?? "");
  const active = String(formData.get("active") ?? "true") === "true";

  await supabase.from("tramitadores").update({ active: !active }).eq("id", id);
  revalidatePath("/admin/tramitadores");
  revalidatePath("/ventas/nueva");
}

export type RegistrarPagoTramitadorState = {
  error?: string;
};

/**
 * Deja constancia de un pago que la organización le hace al tramitador (su
 * saldo a favor — no mueve nada de caja, es una cuenta aparte). El saldo
 * siempre se recalcula en vivo en la página (ver fórmula en schema.sql,
 * sección TRAMITADORES).
 */
export async function registrarPagoTramitador(
  _prevState: RegistrarPagoTramitadorState,
  formData: FormData,
): Promise<RegistrarPagoTramitadorState> {
  const { supabase, profile } = await getViewerContext();
  if (profile.role !== "admin") {
    return { error: "No autorizado." };
  }

  const tramitadorId = String(formData.get("tramitador_id") ?? "");
  const monto = Number(formData.get("monto") ?? 0);
  const nota = String(formData.get("nota") ?? "").trim() || null;

  if (!tramitadorId || !(monto > 0)) {
    return { error: "Ingresá un monto válido." };
  }

  const { data: tramitador } = await supabase
    .from("tramitadores")
    .select("sede_id")
    .eq("id", tramitadorId)
    .maybeSingle();

  const { error } = await supabase.from("tramitador_pagos").insert({
    tramitador_id: tramitadorId,
    organization_id: profile.organization_id!,
    sede_id: tramitador?.sede_id ?? null,
    monto,
    nota,
    created_by: profile.id,
  });

  if (error) {
    return { error: "No se pudo registrar el pago." };
  }

  revalidatePath("/admin/tramitadores");
  return {};
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

  revalidatePath("/admin/tramitadores");
  revalidatePath("/ventas/nueva");
}

export async function eliminarPrecioProducto(formData: FormData) {
  const { supabase, profile } = await getViewerContext();
  if (profile.role !== "admin") return;

  const id = String(formData.get("id") ?? "");
  if (!id) return;

  await supabase.from("tramitador_precios").delete().eq("id", id);
  revalidatePath("/admin/tramitadores");
  revalidatePath("/ventas/nueva");
}
