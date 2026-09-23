"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import { pagarComisionTramitador } from "./actions";
import { METODO_PAGO_LABEL, METODO_PAGO_TRAMITADOR } from "@/lib/supabase/types";
import { buttonClass, linkClass } from "@/lib/ui";

const inputClass =
  "rounded-lg border border-slate-300 px-3 py-1.5 text-sm text-slate-900 outline-none focus:border-indigo-600 focus:ring-1 focus:ring-indigo-600";

/**
 * Le paga al tramitador su comisión (cuando la organización le debe a
 * él) — sale plata real de la caja de la sede elegida (egreso), afecta el
 * cierre del día.
 */
export function ComisionTramitadorForm({
  tramitadorId,
  saldo,
  sedes,
  defaultSedeId,
}: {
  tramitadorId: string;
  saldo: number;
  sedes: { id: string; name: string }[];
  defaultSedeId: string | null;
}) {
  const [state, formAction, pending] = useActionState(pagarComisionTramitador, {});
  const [abierto, setAbierto] = useState(false);
  const eraPending = useRef(false);

  useEffect(() => {
    if (eraPending.current && !pending && !state.error) {
      setAbierto(false);
    }
    eraPending.current = pending;
  }, [pending, state]);

  if (!abierto) {
    return (
      <button
        type="button"
        onClick={() => setAbierto(true)}
        disabled={saldo <= 0}
        className={buttonClass("secondary", "sm")}
      >
        Pagar comisión
      </button>
    );
  }

  return (
    <form action={formAction} className="flex flex-col gap-2 rounded-lg border border-slate-200 p-3">
      <input type="hidden" name="tramitador_id" value={tramitadorId} />
      <div className="flex flex-wrap items-center gap-2">
        <input
          name="monto"
          type="number"
          min={1}
          step="1"
          max={saldo}
          required
          defaultValue={saldo}
          placeholder="Monto"
          className={`w-32 ${inputClass}`}
        />
        <select name="metodo_pago" defaultValue="efectivo" className={inputClass}>
          {METODO_PAGO_TRAMITADOR.map((value) => (
            <option key={value} value={value}>
              {METODO_PAGO_LABEL[value]}
            </option>
          ))}
        </select>
        {sedes.length > 1 ? (
          <select name="sede_id" defaultValue={defaultSedeId ?? ""} className={inputClass}>
            {sedes.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </select>
        ) : (
          <input type="hidden" name="sede_id" value={defaultSedeId ?? ""} />
        )}
        <input
          name="nota"
          placeholder="Nota (opcional)"
          className={`min-w-[10rem] flex-1 ${inputClass}`}
        />
      </div>
      <div className="flex items-center gap-2">
        <button type="submit" disabled={pending} className={buttonClass("primary", "sm")}>
          {pending ? "Guardando..." : "Confirmar"}
        </button>
        <button type="button" onClick={() => setAbierto(false)} className={linkClass("neutral")}>
          Cancelar
        </button>
      </div>
      {state.error ? <p className="w-full text-xs text-red-600">{state.error}</p> : null}
    </form>
  );
}
