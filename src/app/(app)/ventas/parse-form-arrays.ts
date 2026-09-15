import type { VentaItemInput, VentaPagoInput } from "@/lib/supabase/types";

export function parseItems(raw: string): VentaItemInput[] {
  try {
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed
      .filter(
        (item): item is VentaItemInput =>
          item &&
          typeof item.nombre === "string" &&
          item.nombre.trim().length > 0 &&
          typeof item.precio === "number" &&
          item.precio > 0,
      )
      .map((item) => ({
        producto_id: typeof item.producto_id === "string" ? item.producto_id : null,
        nombre: item.nombre.trim(),
        precio: item.precio,
      }));
  } catch {
    return [];
  }
}

export function parsePagos(raw: string): VentaPagoInput[] {
  try {
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed
      .filter(
        (p): p is VentaPagoInput =>
          p && typeof p.monto === "number" && p.monto > 0 && typeof p.metodo_pago === "string",
      )
      .map((p) => ({ monto: p.monto, metodo_pago: p.metodo_pago }));
  } catch {
    return [];
  }
}

/**
 * El comprobante de cada línea de pago viaja aparte del JSON de `pagos`
 * (los <input type="file"> no se pueden meter en un string) — se manda en
 * el mismo <form> como `comprobante_<índice>`, en el mismo orden que el
 * array de pagos, y acá se juntan.
 */
export function pagoComprobanteFieldName(index: number): string {
  return `comprobante_${index}`;
}
