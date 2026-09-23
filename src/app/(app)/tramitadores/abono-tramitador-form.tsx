"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import { registrarAbonoTramitador } from "./actions";
import { PagoLines } from "../ventas/pago-lines";
import { formatCOP } from "@/lib/format";
import { buttonClass, linkClass } from "@/lib/ui";
import { METODO_PAGO_TRAMITADOR, METODO_PAGO_TRAMITADOR_CON_COMPROBANTE } from "@/lib/supabase/types";

const inputClass =
  "rounded-lg border border-slate-300 px-3 py-1.5 text-sm text-slate-900 outline-none focus:border-indigo-600 focus:ring-1 focus:ring-indigo-600";

/**
 * El tramitador salda lo que debe (no un cliente puntual) — ej. trajo
 * varias personas en el día, ninguna pagó en el momento, y al cierre él
 * paga todo junto. Si ya tenía saldo a favor (le debíamos comisión), ese
 * crédito se cruza automáticamente primero — acá solo se pide el
 * efectivo que falte después de ese cruce (ver registrar_abono_tramitador
 * en schema.sql), repartido entre sus ventas pendientes de la sede
 * elegida, de la más vieja a la más nueva.
 */
export function AbonoTramitadorForm({
  tramitadorId,
  pendiente,
  creditoAplicable,
  sedes,
  defaultSedeId,
}: {
  tramitadorId: string;
  /**
   * Suma de lo pendiente de sus ventas 'abonada' en la sede elegida — NO
   * el saldo a favor agregado: ese puede incluir comisión ya pagada
   * (tramitador_pagos), que no está en ninguna venta y por lo tanto no se
   * puede "cobrar" acá, solo lo que de verdad está pendiente de cobrar.
   */
  pendiente: number;
  /** Crédito a favor que se cruza automático antes de pedir efectivo. */
  creditoAplicable: number;
  sedes: { id: string; name: string }[];
  defaultSedeId: string | null;
}) {
  const [state, formAction, pending] = useActionState(registrarAbonoTramitador, {});
  const [abierto, setAbierto] = useState(false);
  const eraPending = useRef(false);
  const faltaEnEfectivo = Math.max(0, pendiente - creditoAplicable);

  useEffect(() => {
    if (eraPending.current && !pending && !state.error) {
      setAbierto(false);
    }
    eraPending.current = pending;
  }, [pending, state]);

  if (!abierto) {
    return (
      <div className="flex flex-col items-start gap-1.5">
        <button type="button" onClick={() => setAbierto(true)} className={buttonClass("secondary", "sm")}>
          Registrar abono
        </button>
        {state.mensaje ? <p className="text-xs text-emerald-600">{state.mensaje}</p> : null}
      </div>
    );
  }

  return (
    <form action={formAction} className="flex flex-col gap-2 rounded-lg border border-slate-200 p-3">
      <input type="hidden" name="tramitador_id" value={tramitadorId} />
      {sedes.length > 1 ? (
        <select name="sede_id" defaultValue={defaultSedeId ?? ""} className={`w-fit ${inputClass}`}>
          {sedes.map((s) => (
            <option key={s.id} value={s.id}>
              {s.name}
            </option>
          ))}
        </select>
      ) : (
        <input type="hidden" name="sede_id" value={defaultSedeId ?? ""} />
      )}

      {creditoAplicable > 0 ? (
        <p className="rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-800">
          Debe {formatCOP(pendiente)} · Crédito a favor que se cruza automático{" "}
          <strong>{formatCOP(creditoAplicable)}</strong> · Falta en efectivo{" "}
          <strong>{formatCOP(faltaEnEfectivo)}</strong>
        </p>
      ) : null}

      <PagoLines
        total={faltaEnEfectivo}
        metodos={METODO_PAGO_TRAMITADOR}
        metodosConComprobante={METODO_PAGO_TRAMITADOR_CON_COMPROBANTE}
      />

      {state.error ? <p className="text-xs text-red-600">{state.error}</p> : null}

      <div className="flex items-center gap-2">
        <button type="submit" disabled={pending} className={buttonClass("primary", "sm")}>
          {pending ? "Registrando..." : "Confirmar"}
        </button>
        <button type="button" onClick={() => setAbierto(false)} className={linkClass("neutral")}>
          Cancelar
        </button>
      </div>
    </form>
  );
}
