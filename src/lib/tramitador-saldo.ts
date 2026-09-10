import type { createClient } from "@/lib/supabase/server";

type Supabase = Awaited<ReturnType<typeof createClient>>;

/**
 * Saldo a favor de UN tramitador puntual — misma fórmula que
 * /admin/tramitadores (pagado por sus clientes − lo que le corresponde a la
 * organización por todas sus ventas no anuladas − lo que ya se le pagó),
 * pero escopeada a un solo tramitador para no traer el catálogo completo
 * cuando solo hace falta el de uno (ej. al ofrecer "cruzar" en una venta).
 */
export async function getTramitadorSaldo(supabase: Supabase, tramitadorId: string): Promise<number> {
  const { data: ventas } = await supabase
    .from("ventas")
    .select("id, precio_tramitador")
    .eq("tramitador_id", tramitadorId)
    .neq("estado", "anulada");

  const ventaIds = (ventas ?? []).map((v) => v.id);
  const reclamo = (ventas ?? []).reduce((acc, v) => acc + v.precio_tramitador, 0);

  const [{ data: pagosClientes }, { data: pagosTramitador }] = await Promise.all([
    ventaIds.length
      ? supabase.from("venta_pagos").select("monto").in("venta_id", ventaIds)
      : Promise.resolve({ data: [] as { monto: number }[] }),
    supabase.from("tramitador_pagos").select("monto").eq("tramitador_id", tramitadorId),
  ]);

  const pagadoClientes = (pagosClientes ?? []).reduce((acc, p) => acc + p.monto, 0);
  const pagadoTramitador = (pagosTramitador ?? []).reduce((acc, p) => acc + p.monto, 0);

  return pagadoClientes - reclamo - pagadoTramitador;
}
