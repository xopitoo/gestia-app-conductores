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
    // El navegador ya lo limita a dígitos, pero se limpia igual acá por si
    // llega un form enviado a mano (curl, etc.) sin pasar por el input.
    telefono: String(formData.get("telefono") ?? "").replace(/\D/g, "") || null,
    correo_electronico: String(formData.get("correo_electronico") ?? "").trim() || null,
    runt: String(formData.get("runt") ?? "false") === "true",
  };
}

/**
 * El input type="date" del navegador no impide años de más de 4 dígitos al
 * escribirlos a mano (ej. "32223") — el propio HTML permite años largos.
 * Se valida acá el formato exacto YYYY-MM-DD y un rango razonable.
 */
function validarFechaNacimiento(fecha: string | null): string | null {
  if (!fecha) return null;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(fecha)) {
    return "La fecha de nacimiento no es válida.";
  }
  const anio = Number(fecha.slice(0, 4));
  const anioActual = new Date().getFullYear();
  if (anio < 1900 || anio > anioActual || Number.isNaN(new Date(fecha).getTime())) {
    return "La fecha de nacimiento no es válida.";
  }
  return null;
}

function validarTelefono(telefono: string | null): string | null {
  if (telefono && telefono.length !== 10) {
    return "El teléfono debe tener 10 dígitos.";
  }
  return null;
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
  const errorTelefono = validarTelefono(fields.telefono);
  if (errorTelefono) return { error: errorTelefono };
  const errorFecha = validarFechaNacimiento(fields.fecha_nacimiento);
  if (errorFecha) return { error: errorFecha };

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
  const errorTelefono = validarTelefono(fields.telefono);
  if (errorTelefono) return { error: errorTelefono };
  const errorFecha = validarFechaNacimiento(fields.fecha_nacimiento);
  if (errorFecha) return { error: errorFecha };

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
