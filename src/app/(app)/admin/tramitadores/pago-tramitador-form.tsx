"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import { registrarPagoTramitador } from "./actions";

export function PagoTramitadorForm({ tramitadorId, saldo }: { tramitadorId: string; saldo: number }) {
  const [state, formAction, pending] = useActionState(registrarPagoTramitador, {});
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
        className="rounded-lg border border-slate-300 px-3 py-1.5 text-xs font-medium text-slate-600 transition hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-50"
      >
        Registrar pago
      </button>
    );
  }

  return (
    <form action={formAction} className="flex flex-col gap-2 rounded-lg border border-slate-200 p-3 sm:flex-row sm:items-start">
      <input type="hidden" name="tramitador_id" value={tramitadorId} />
      <input
        name="monto"
        type="number"
        min={1}
        step="1"
        max={saldo}
        required
        defaultValue={saldo}
        placeholder="Monto"
        className="w-32 rounded-lg border border-slate-300 px-3 py-1.5 text-sm text-slate-900 outline-none focus:border-indigo-600 focus:ring-1 focus:ring-indigo-600"
      />
      <input
        name="nota"
        placeholder="Nota (opcional)"
        className="flex-1 rounded-lg border border-slate-300 px-3 py-1.5 text-sm text-slate-900 outline-none focus:border-indigo-600 focus:ring-1 focus:ring-indigo-600"
      />
      <div className="flex items-center gap-2">
        <button
          type="submit"
          disabled={pending}
          className="rounded-lg bg-indigo-600 px-3 py-1.5 text-xs font-semibold text-white transition hover:bg-indigo-700 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {pending ? "Guardando..." : "Confirmar"}
        </button>
        <button
          type="button"
          onClick={() => setAbierto(false)}
          className="text-xs font-medium text-slate-400 hover:text-slate-600"
        >
          Cancelar
        </button>
      </div>
      {state.error ? <p className="w-full text-xs text-red-600">{state.error}</p> : null}
    </form>
  );
}
