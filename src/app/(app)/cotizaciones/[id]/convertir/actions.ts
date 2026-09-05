"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getViewerContext } from "@/lib/viewer";
import { parsePagos } from "../../../ventas/parse-form-arrays";

export type ConvertirFormState = {
  error?: string;
};

export async function convertirCotizacion(
  _prevState: ConvertirFormState,
  formData: FormData,
): Promise<ConvertirFormState> {
  const { supabase } = await getViewerContext();
  const cotizacionId = String(formData.get("cotizacion_id") ?? "");
  const pagos = parsePagos(String(formData.get("pagos") ?? "[]"));
  const pin = String(formData.get("pin") ?? "") || null;

  if (!cotizacionId || pagos.length === 0) {
    return { error: "Registrá al menos un pago." };
  }

  const { data, error } = await supabase.rpc("convertir_cotizacion", {
    p_cotizacion_id: cotizacionId,
    p_pagos: pagos,
    p_pin: pin,
  });

  if (error || !data) {
    if (error?.message.includes("abrir caja")) {
      return { error: "Debés abrir la caja de la sede antes de registrar la venta." };
    }
    if (error?.message.includes("PIN")) {
      return { error: "PIN de autorización incorrecto." };
    }
    if (error?.message.includes("superar el total")) {
      return { error: "El pago no puede superar el total de la orden." };
    }
    if (error?.message.includes("ya no está pendiente")) {
      return { error: "Esta cotización ya no está pendiente." };
    }
    return { error: "No se pudo convertir la cotización." };
  }

  revalidatePath("/cotizaciones");
  revalidatePath(`/cotizaciones/${cotizacionId}`);
  revalidatePath("/ventas");
  revalidatePath("/caja");
  redirect(`/ventas/${data.id}`);
}
