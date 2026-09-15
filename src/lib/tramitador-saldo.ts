import type { createClient } from "@/lib/supabase/server";

type Supabase = Awaited<ReturnType<typeof createClient>>;

export type TramitadorConSaldo = {
  id: string;
  nombre: string;
  pagadoClientes: number;
  reclamo: number;
  pagadoTramitador: number;
  saldoAFavor: number;
};

/**
 * Saldo de TODOS los tramitadores activos, con el detalle de sus 3
 * componentes (pagado por sus clientes, lo que le corresponde a la
 * organización, lo que ya se le pagó) — mismo RPC que consume tanto el
 * dashboard de recepcionista (una sede puntual) como /tramitadores
 * (todas las sedes, pasando sedeId=null), para que la fórmula viva en un
 * solo lugar. Llama al RPC `tramitadores_saldo` en vez de armar la cuenta
 * acá con queries propias — `tramitador_pagos` es de solo lectura para
 * admin (tramitador_pagos_select_admin), así que un recepcionista no puede
 * leerla directo, y el RPC corre con privilegios elevados para sumarla sin
 * exponer los pagos en sí, solo el neto.
 */
export async function getTramitadoresConSaldo(
  supabase: Supabase,
  sedeId: string | null,
): Promise<TramitadorConSaldo[]> {
  const { data } = await supabase.rpc("tramitadores_saldo", { p_sede_id: sedeId });
  return (data ?? []).map((t) => ({
    id: t.id,
    nombre: t.nombre,
    pagadoClientes: t.pagado_clientes,
    reclamo: t.reclamo,
    pagadoTramitador: t.pagado_tramitador,
    saldoAFavor: t.saldo_a_favor,
  }));
}

/**
 * Saldo a favor de UN tramitador puntual (ej. al ofrecer "cruzar" en una
 * venta) — mismo RPC que getTramitadoresConSaldo, filtrando el resultado a
 * uno solo, para no tener la fórmula duplicada en dos lugares que puedan
 * divergir (eso fue justo el bug que infló el saldo mostrado acá antes:
 * esta función tenía su propio cálculo, sin prorratear los carritos
 * mixtos). sedeId=null porque un tramitador puntual ya viene identificado
 * por su id, no hace falta acotar por sede.
 */
export async function getTramitadorSaldo(supabase: Supabase, tramitadorId: string): Promise<number> {
  const tramitadores = await getTramitadoresConSaldo(supabase, null);
  return tramitadores.find((t) => t.id === tramitadorId)?.saldoAFavor ?? 0;
}

export type MovimientoExtracto = {
  fecha: string;
  tipo: "venta" | "pago_tramitador";
  referenciaId: string;
  descripcion: string;
  monto: number;
  pagado: number | null;
  total: number | null;
  saldoAcumulado: number;
};

/**
 * Detalle cronológico (extracto) de cómo se armó el saldo de un
 * tramitador puntual — una fila por venta suya y una por cada pago que ya
 * se le hizo, con saldo acumulado corrido. Mismo RPC/fórmula que
 * tramitadores_saldo (ver schema.sql), así que el saldo final acá siempre
 * coincide con el que se ve en el resumen.
 */
export async function getTramitadorExtracto(
  supabase: Supabase,
  tramitadorId: string,
): Promise<MovimientoExtracto[]> {
  const { data } = await supabase.rpc("tramitador_extracto", { p_tramitador_id: tramitadorId });
  return (data ?? []).map((m) => ({
    fecha: m.fecha,
    tipo: m.tipo,
    referenciaId: m.referencia_id,
    descripcion: m.descripcion,
    monto: m.monto,
    pagado: m.pagado,
    total: m.total,
    saldoAcumulado: m.saldo_acumulado,
  }));
}
