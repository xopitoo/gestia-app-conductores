"use server";

import { revalidatePath } from "next/cache";
import { getViewerContext } from "@/lib/viewer";
import { parsePagos } from "../parse-form-arrays";
import { adjuntarComprobantes } from "@/lib/comprobante-pago";
import type { MetodoPago } from "@/lib/supabase/types";

export type AbonoFormState = {
  error?: string;
};

export type CorregirMetodoPagoState = {
  error?: string;
};

/**
 * Corrige solo la forma de pago de un pago ya registrado (ej. se cargó
 * "efectivo" por error y era "transferencia"). Todo el resto de reglas
 * (quién puede, hasta cuándo) vive en corregir_forma_pago_venta — acá solo
 * se traduce el error de la base a un mensaje legible.
 */
export async function corregirMetodoPago(
  ventaId: string,
  _prevState: CorregirMetodoPagoState,
  formData: FormData,
): Promise<CorregirMetodoPagoState> {
  const { supabase } = await getViewerContext();
  const pagoId = String(formData.get("pago_id") ?? "");
  const metodoPago = String(formData.get("metodo_pago") ?? "") as MetodoPago;

  if (!pagoId || !metodoPago) {
    return { error: "Datos inválidos." };
  }

  const { error } = await supabase.rpc("corregir_forma_pago_venta", {
    p_venta_pago_id: pagoId,
    p_metodo_pago: metodoPago,
  });

  if (error) {
    if (error.message.includes("Abrí la caja")) {
      return { error: "Abrí la caja de esta sede para poder corregir la forma de pago." };
    }
    return { error: "No se pudo corregir la forma de pago." };
  }

  revalidatePath(`/ventas/${ventaId}`);
  revalidatePath("/caja");
  return {};
}

export async function registrarAbono(
  _prevState: AbonoFormState,
  formData: FormData,
): Promise<AbonoFormState> {
  const { supabase, profile } = await getViewerContext();
  const ventaId = String(formData.get("venta_id") ?? "");
  const pagos = parsePagos(String(formData.get("pagos") ?? "[]"));

  if (!ventaId || pagos.length === 0) {
    return { error: "Registrá al menos un pago." };
  }

  const adjunto = await adjuntarComprobantes(supabase, formData, pagos, profile.organization_id!);
  if ("error" in adjunto) {
    return { error: adjunto.error };
  }

  const { error } = await supabase.rpc("registrar_abono", {
    p_venta_id: ventaId,
    p_pagos: adjunto.pagos,
  });

  if (error) {
    if (error.message.includes("abrir caja")) {
      return { error: "Debés abrir la caja de la sede antes de registrar un abono." };
    }
    if (error.message.includes("saldo pendiente")) {
      return { error: "El pago supera el saldo pendiente." };
    }
    return { error: "No se pudo registrar el abono." };
  }

  revalidatePath(`/ventas/${ventaId}`);
  revalidatePath("/ventas");
  revalidatePath("/caja");
  return {};
}

export type CorregirPrecioTramitadorState = {
  error?: string;
};

/**
 * Corrige el precio especial (lo que le corresponde a la organización) de
 * una venta ya creada — para cuando queda mal cargado (ej. se editó a mano
 * por error y quedó en $0). Solo admin, sin límite de tiempo (a diferencia
 * de corregir_forma_pago_venta, que un recepcionista también puede tocar
 * mientras la caja siga abierta — esto es plata del tramitador, no del
 * método de pago, así que queda admin-only siempre).
 */
export async function corregirPrecioTramitador(
  ventaId: string,
  _prevState: CorregirPrecioTramitadorState,
  formData: FormData,
): Promise<CorregirPrecioTramitadorState> {
  const { supabase, profile } = await getViewerContext();
  if (profile.role !== "admin") {
    return { error: "No autorizado." };
  }

  const precioTramitador = Number(formData.get("precio_tramitador") ?? NaN);
  if (!Number.isFinite(precioTramitador) || precioTramitador < 0) {
    return { error: "Ingresá un monto válido." };
  }

  const { error } = await supabase.rpc("corregir_precio_tramitador_venta", {
    p_venta_id: ventaId,
    p_precio_tramitador: precioTramitador,
  });

  if (error) {
    if (error.message.includes("superar el total")) {
      return { error: "El precio del tramitador no puede superar el total de la orden." };
    }
    return { error: "No se pudo corregir el precio del tramitador." };
  }

  revalidatePath(`/ventas/${ventaId}`);
  revalidatePath("/ventas");
  revalidatePath("/tramitadores");
  revalidatePath("/dashboard");
  return {};
}

export type CruceFormState = {
  error?: string;
};

/**
 * Salda una venta pendiente de un tramitador contra su saldo a favor, sin
 * que entre plata real a la caja — para cuando trae gente y paga después,
 * y para entonces ya le quedó plata de sobra de otras ventas suyas. Solo
 * admin (mismo criterio que un pago directo al tramitador).
 */
export async function cruzarSaldoTramitador(
  _prevState: CruceFormState,
  formData: FormData,
): Promise<CruceFormState> {
  const { supabase, profile } = await getViewerContext();
  if (profile.role !== "admin") {
    return { error: "No autorizado." };
  }

  const ventaId = String(formData.get("venta_id") ?? "");
  const monto = Number(formData.get("monto") ?? 0);

  if (!ventaId || !(monto > 0)) {
    return { error: "Ingresá un monto válido." };
  }

  const { error } = await supabase.rpc("cruzar_saldo_tramitador", {
    p_venta_id: ventaId,
    p_monto: monto,
  });

  if (error) {
    if (error.message.includes("saldo pendiente de la venta")) {
      return { error: "El monto supera el saldo pendiente de la venta." };
    }
    if (error.message.includes("saldo a favor")) {
      return { error: "El tramitador no tiene suficiente saldo a favor para cruzar ese monto." };
    }
    return { error: "No se pudo cruzar el saldo." };
  }

  revalidatePath(`/ventas/${ventaId}`);
  revalidatePath("/ventas");
  revalidatePath("/tramitadores");
  return {};
}

export type CertificadoFormState = {
  error?: string;
};

const EXTENSIONES_PERMITIDAS = ["pdf", "jpg", "jpeg", "png"];
const TAMANO_MAXIMO = 10 * 1024 * 1024; // 10 MB

/**
 * Sube el certificado RUNT (PDF o foto) al bucket privado y deja la
 * constancia en la venta. Lo puede hacer un recepcionista (de su propia
 * sede) o un admin — nunca antes de que la venta esté paga por completo
 * (lo valida registrar_certificado_runt en la base, no solo acá).
 */
export async function subirCertificadoRunt(
  _prevState: CertificadoFormState,
  formData: FormData,
): Promise<CertificadoFormState> {
  const { supabase, profile } = await getViewerContext();

  const ventaId = String(formData.get("venta_id") ?? "");
  const file = formData.get("file");

  if (!ventaId) {
    return { error: "Venta inválida." };
  }
  if (!(file instanceof File) || file.size === 0) {
    return { error: "Seleccioná un archivo." };
  }
  if (file.size > TAMANO_MAXIMO) {
    return { error: "El archivo no puede superar los 10 MB." };
  }
  const ext = file.name.split(".").pop()?.toLowerCase() ?? "";
  if (!EXTENSIONES_PERMITIDAS.includes(ext)) {
    return { error: "Solo se aceptan archivos PDF, JPG o PNG." };
  }

  const path = `${profile.organization_id}/${ventaId}/${Date.now()}.${ext}`;
  const { error: uploadError } = await supabase.storage
    .from("certificados-runt")
    .upload(path, file, { contentType: file.type || undefined });

  if (uploadError) {
    return { error: "No se pudo subir el archivo. Intentá de nuevo." };
  }

  const { error } = await supabase.rpc("registrar_certificado_runt", {
    p_venta_id: ventaId,
    p_certificado_path: path,
  });

  if (error) {
    // El archivo ya quedó en Storage pero no se pudo dejar la constancia en
    // la venta — lo borramos para no dejar un huérfano sin registrar.
    await supabase.storage.from("certificados-runt").remove([path]);
    if (error.message.includes("saldo pendiente")) {
      return { error: "No se puede subir: todavía queda saldo pendiente por cobrar." };
    }
    if (error.message.includes("ya tiene el certificado")) {
      return { error: "Esta venta ya tiene el certificado RUNT subido." };
    }
    return { error: "No se pudo registrar el certificado." };
  }

  revalidatePath(`/ventas/${ventaId}`);
  revalidatePath("/ventas");
  return {};
}
