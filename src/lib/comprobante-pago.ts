import type { createClient } from "@/lib/supabase/server";
import { METODO_PAGO_CON_COMPROBANTE, type VentaPagoInput } from "@/lib/supabase/types";
import { pagoComprobanteFieldName } from "@/app/(app)/ventas/parse-form-arrays";

type Supabase = Awaited<ReturnType<typeof createClient>>;

const EXTENSIONES_PERMITIDAS = ["jpg", "jpeg", "png", "webp", "pdf"];
const TAMANO_MAXIMO = 10 * 1024 * 1024; // 10 MB

/**
 * Sube el comprobante (foto/captura) de cada línea de pago que traiga uno,
 * al bucket privado `comprobantes-pago`, y devuelve el mismo array de
 * pagos con `comprobante_path` completado — para pasárselo tal cual al
 * RPC que registra el pago (registrar_venta / registrar_abono /
 * registrar_abono_tramitador / convertir_cotizacion), que lo guarda junto
 * con el resto del pago en una sola operación (venta_pagos es inmutable,
 * así que esto tiene que quedar bien desde el insert, no se corrige
 * después).
 *
 * No es obligatorio: si una línea con un método "con comprobante"
 * (transferencia, nequi, etc.) no trae archivo, sigue sin él. `efectivo`
 * nunca necesita comprobante.
 */
export async function adjuntarComprobantes(
  supabase: Supabase,
  formData: FormData,
  pagos: VentaPagoInput[],
  organizationId: string,
): Promise<{ pagos: VentaPagoInput[] } | { error: string }> {
  const resultado: VentaPagoInput[] = [];

  for (let i = 0; i < pagos.length; i++) {
    const pago = pagos[i];
    const file = formData.get(pagoComprobanteFieldName(i));

    if (!METODO_PAGO_CON_COMPROBANTE.includes(pago.metodo_pago) || !(file instanceof File) || file.size === 0) {
      resultado.push(pago);
      continue;
    }

    if (file.size > TAMANO_MAXIMO) {
      return { error: "El comprobante no puede superar los 10 MB." };
    }
    const ext = file.name.split(".").pop()?.toLowerCase() ?? "";
    if (!EXTENSIONES_PERMITIDAS.includes(ext)) {
      return { error: "El comprobante debe ser una foto (JPG/PNG/WEBP) o PDF." };
    }

    const path = `${organizationId}/${crypto.randomUUID()}.${ext}`;
    const { error } = await supabase.storage
      .from("comprobantes-pago")
      .upload(path, file, { contentType: file.type || undefined });
    if (error) {
      return { error: "No se pudo subir el comprobante. Intentá de nuevo." };
    }

    resultado.push({ ...pago, comprobante_path: path });
  }

  return { pagos: resultado };
}
