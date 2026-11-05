"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getViewerContext, resolveSedeId } from "@/lib/viewer";
import { parseItems, parsePagos } from "./parse-form-arrays";
import { adjuntarComprobantes } from "@/lib/comprobante-pago";
import type { DescuentoTipo } from "@/lib/supabase/types";

function parsePines(raw: string): string[] {
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.map((p) => String(p ?? "").trim()) : [];
  } catch {
    return [];
  }
}

export type VentaFormState = {
  error?: string;
};

export async function registrarVenta(
  _prevState: VentaFormState,
  formData: FormData,
): Promise<VentaFormState> {
  const ctx = await getViewerContext();
  const { supabase, profile } = ctx;

  const sedeId = resolveSedeId(ctx, String(formData.get("sede_id") ?? ""));
  const clienteId = String(formData.get("cliente_id") ?? "");
  const items = parseItems(String(formData.get("items") ?? "[]"));
  const pagos = parsePagos(String(formData.get("pagos") ?? "[]"));
  const pin = String(formData.get("pin") ?? "") || null;
  const descuentoTipo = (String(formData.get("descuento_tipo") ?? "") || null) as DescuentoTipo | null;
  const descuentoValor = Number(formData.get("descuento_valor") ?? 0) || 0;
  const tramitadorId = String(formData.get("tramitador_id") ?? "") || null;
  const precioTramitador = Number(formData.get("precio_tramitador") ?? 0) || 0;
  const montoCobradoTramitadorRaw = String(formData.get("monto_cobrado_tramitador") ?? "");
  const montoCobradoTramitador = montoCobradoTramitadorRaw ? Number(montoCobradoTramitadorRaw) || 0 : null;
  const incrementoTipo = (String(formData.get("incremento_tipo") ?? "") || null) as DescuentoTipo | null;
  const incrementoValor = Number(formData.get("incremento_valor") ?? 0) || 0;
  const categoriasLicenciaRaw = String(formData.get("categorias_licencia") ?? "[]");
  const categoriasLicencia: string[] = (() => {
    try {
      const parsed = JSON.parse(categoriasLicenciaRaw);
      return Array.isArray(parsed) ? parsed.filter((c): c is string => typeof c === "string") : [];
    } catch {
      return [];
    }
  })();

  if (!sedeId || !clienteId) {
    return { error: "Completá el cliente." };
  }
  if (items.length === 0) {
    return { error: "Elegí al menos un producto." };
  }
  // PINES de curso: cada producto con cursos_reales > 0 (A2, B1, C1, combos)
  // exige tantos PINES como cursos incluya — así se cuentan cursos reales.
  const pines = parsePines(String(formData.get("pines") ?? "[]"));
  const productoIds = items.map((i) => i.producto_id).filter((id): id is string => !!id);
  const { data: productosPin } = productoIds.length
    ? await supabase.from("productos").select("id, cursos_reales").in("id", productoIds)
    : { data: [] };
  const cursosPorProducto = new Map((productosPin ?? []).map((p) => [p.id, p.cursos_reales ?? 0]));
  const pinesRequeridos = items.reduce((acc, i) => acc + (i.producto_id ? (cursosPorProducto.get(i.producto_id) ?? 0) : 0), 0);
  if (pinesRequeridos > 0) {
    if (pines.length !== pinesRequeridos || pines.some((p) => !p)) {
      return { error: `Esta orden incluye ${pinesRequeridos} ${pinesRequeridos === 1 ? "curso" : "cursos"}: escribí ${pinesRequeridos === 1 ? "el PIN" : `los ${pinesRequeridos} PIN`} del curso.` };
    }
    if (new Set(pines).size !== pines.length) {
      return { error: "Los PIN de la orden no pueden repetirse." };
    }
    const { data: repetidos } = await supabase.from("venta_pines").select("pin").in("pin", pines);
    if ((repetidos ?? []).length > 0) {
      return { error: `El PIN ${repetidos![0].pin} ya fue registrado en otra venta.` };
    }
  }

  // pagos puede venir vacío: una venta puede quedar totalmente pendiente
  // (ej. un tramitador trae gente y paga al día siguiente) — registrar_venta
  // igual exige el PIN de autorización porque $0 pagado es menos del 50%.

  const adjunto = await adjuntarComprobantes(supabase, formData, pagos, profile.organization_id!);
  if ("error" in adjunto) {
    return { error: adjunto.error };
  }

  const { data: ventaCreada, error } = await supabase.rpc("registrar_venta", {
    p_sede_id: sedeId,
    p_cliente_id: clienteId,
    p_items: items,
    p_pagos: adjunto.pagos,
    p_vendedor_id: profile.id,
    p_pin: pin,
    p_descuento_tipo: descuentoTipo,
    p_descuento_valor: descuentoValor,
    p_tramitador_id: tramitadorId,
    p_precio_tramitador: precioTramitador,
    p_categorias_licencia: categoriasLicencia.length > 0 ? categoriasLicencia : null,
    p_incremento_tipo: incrementoTipo,
    p_incremento_valor: incrementoValor,
    p_monto_cobrado_tramitador: montoCobradoTramitador,
  });

  if (error) {
    if (error.message.includes("abrir caja")) {
      return { error: "Debés abrir la caja de la sede antes de registrar una venta." };
    }
    if (error.message.includes("PIN")) {
      return { error: "PIN de autorización incorrecto." };
    }
    if (error.message.includes("descuento")) {
      return { error: error.message };
    }
    if (error.message.includes("incremento")) {
      return { error: error.message };
    }
    if (error.message.includes("precio del tramitador")) {
      return { error: error.message };
    }
    if (error.message.includes("monto cobrado por el tramitador")) {
      return { error: error.message };
    }
    if (error.message.includes("superar el total")) {
      return { error: "El pago no puede superar el total de la orden." };
    }
    return { error: "No se pudo registrar la venta." };
  }

  if (pinesRequeridos > 0 && ventaCreada) {
    const { error: pinError } = await supabase.from("venta_pines").insert(
      pines.map((pin) => ({
        organization_id: profile.organization_id!,
        sede_id: sedeId,
        venta_id: ventaCreada.id,
        cliente_id: clienteId,
        pin,
        created_by: profile.id,
      })),
    );
    if (pinError) {
      // La venta ya existe: se lleva a su detalle para completar los PIN ahí (no reenviar el formulario).
      revalidatePath("/ventas");
      redirect(`/ventas/${ventaCreada.id}`);
    }
  }

  revalidatePath("/ventas");
  revalidatePath("/caja");
  redirect("/ventas");
}

export async function anularVenta(formData: FormData) {
  const { supabase } = await getViewerContext();
  const id = String(formData.get("id") ?? "");
  if (!id) return;

  // Vía RPC (no un simple .update()) porque anular una venta con
  // tramitador puede dejar sin respaldo un crédito que ya se le había
  // cruzado a otra venta suya — anular_venta revisa eso y lo revierte
  // solo si hace falta (ver tramitador_revertir_credito_negativo).
  await supabase.rpc("anular_venta", { p_venta_id: id });

  revalidatePath("/ventas");
  revalidatePath("/tramitadores");
  revalidatePath("/caja");
}
