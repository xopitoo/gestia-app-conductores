"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getViewerContext } from "@/lib/viewer";
import type { Sexo, TipoDocumento } from "@/lib/supabase/types";

export type ClienteFormState = {
  error?: string;
};

function readClienteFields(formData: FormData) {
  return {
    tipo_documento: String(formData.get("tipo_documento") ?? "") as TipoDocumento,
    numero_documento: String(formData.get("numero_documento") ?? "").trim(),
    nombre_completo: String(formData.get("nombre_completo") ?? "").trim(),
    sexo: (String(formData.get("sexo") ?? "") || null) as Sexo | null,
    fecha_nacimiento: String(formData.get("fecha_nacimiento") ?? "") || null,
    telefono_pais: String(formData.get("telefono_pais") ?? "+57").trim() || "+57",
    telefono: String(formData.get("telefono") ?? "").trim() || null,
    correo_electronico: String(formData.get("correo_electronico") ?? "").trim() || null,
    runt: String(formData.get("runt") ?? "false") === "true",
  };
}

export async function crearCliente(
  _prevState: ClienteFormState,
  formData: FormData,
): Promise<ClienteFormState> {
  const { supabase, profile, sedes } = await getViewerContext();
  const fields = readClienteFields(formData);

  if (!fields.tipo_documento || !fields.numero_documento || !fields.nombre_completo || !fields.telefono) {
    return { error: "Completá tipo y número de documento, nombre y teléfono." };
  }

  const sedeId =
    profile.role === "recepcionista"
      ? profile.sede_id
      : String(formData.get("sede_id") ?? sedes[0]?.id ?? "");

  if (!sedeId) {
    return { error: "Seleccioná una sede." };
  }

  const { error } = await supabase.from("clientes").insert({
    organization_id: profile.organization_id!,
    sede_id: sedeId,
    created_by: profile.id,
    ...fields,
  });

  if (error) {
    if (error.code === "23505") {
      return { error: "Ya existe un cliente con ese tipo y número de documento." };
    }
    return { error: "No se pudo crear el cliente. Intentá de nuevo." };
  }

  revalidatePath("/clientes");
  redirect("/clientes");
}

export async function actualizarCliente(
  _prevState: ClienteFormState,
  formData: FormData,
): Promise<ClienteFormState> {
  const { supabase, profile } = await getViewerContext();
  if (profile.role !== "admin") {
    return { error: "Solo un administrador puede modificar los datos de un cliente." };
  }

  const id = String(formData.get("id") ?? "");
  const fields = readClienteFields(formData);

  if (!id || !fields.tipo_documento || !fields.numero_documento || !fields.nombre_completo || !fields.telefono) {
    return { error: "Completá tipo y número de documento, nombre y teléfono." };
  }

  const { error } = await supabase.from("clientes").update(fields).eq("id", id);

  if (error) {
    if (error.code === "23505") {
      return { error: "Ya existe un cliente con ese tipo y número de documento." };
    }
    return { error: "No se pudo actualizar el cliente." };
  }

  revalidatePath("/clientes");
  redirect("/clientes");
}

export async function toggleClienteActive(formData: FormData) {
  const { supabase, profile } = await getViewerContext();
  if (profile.role !== "admin") return;

  const id = String(formData.get("id") ?? "");
  const active = String(formData.get("active") ?? "true") === "true";

  await supabase.from("clientes").update({ active: !active }).eq("id", id);
  revalidatePath("/clientes");
}
