"use server";

import { revalidatePath } from "next/cache";
import { getViewerContext } from "@/lib/viewer";
import { parsePagos } from "../parse-form-arrays";

export type AbonoFormState = {
  error?: string;
};

export async function registrarAbono(
  _prevState: AbonoFormState,
  formData: FormData,
): Promise<AbonoFormState> {
  const { supabase } = await getViewerContext();
  const ventaId = String(formData.get("venta_id") ?? "");
  const pagos = parsePagos(String(formData.get("pagos") ?? "[]"));

  if (!ventaId || pagos.length === 0) {
    return { error: "Registrá al menos un pago." };
  }

  const { error } = await supabase.rpc("registrar_abono", {
    p_venta_id: ventaId,
    p_pagos: pagos,
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
