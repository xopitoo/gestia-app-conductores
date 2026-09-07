"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import { Pencil } from "lucide-react";
import { corregirMetodoPago } from "./actions";
import { METODO_PAGO_LABEL, type MetodoPago } from "@/lib/supabase/types";

/**
 * Corrección puntual del método de pago de un pago ya registrado — para
 * cuando se equivocan y cargan "efectivo" en vez de "transferencia". No
 * toca nada más del pago (monto, fecha, etc.).
 */
export function EditarMetodoPago({
  ventaId,
  pagoId,
  metodoActual,
}: {
  ventaId: string;
  pagoId: string;
  metodoActual: MetodoPago;
}) {
  const [editando, setEditando] = useState(false);
  const accionConVenta = corregirMetodoPago.bind(null, ventaId);
  const [state, formAction, pending] = useActionState(accionConVenta, {});
  const eraPending = useRef(false);

  useEffect(() => {
    if (eraPending.current && !pending && !state.error) {
      setEditando(false);
    }
    eraPending.current = pending;
  }, [pending, state]);

  if (!editando) {
    return (
      <button
        type="button"
        onClick={() => setEditando(true)}
        className="flex items-center gap-1 text-xs font-medium text-slate-400 hover:text-indigo-700"
        title="Corregir forma de pago"
      >
        <Pencil className="h-3 w-3" aria-hidden="true" />
        Corregir
      </button>
    );
  }

  return (
    <form action={formAction} className="flex flex-wrap items-center gap-1.5">
      <input type="hidden" name="pago_id" value={pagoId} />
      <select
        name="metodo_pago"
        defaultValue={metodoActual}
        className="rounded-md border border-slate-300 px-2 py-1 text-xs text-slate-900 outline-none focus:border-indigo-600 focus:ring-1 focus:ring-indigo-600"
      >
        {Object.entries(METODO_PAGO_LABEL).map(([value, label]) => (
          <option key={value} value={value}>
            {label}
          </option>
        ))}
      </select>
      <button
        type="submit"
        disabled={pending}
        className="rounded-md bg-indigo-600 px-2 py-1 text-xs font-medium text-white hover:bg-indigo-700 disabled:cursor-not-allowed disabled:opacity-60"
      >
        {pending ? "..." : "Guardar"}
      </button>
      <button
        type="button"
        onClick={() => setEditando(false)}
        className="text-xs font-medium text-slate-400 hover:text-slate-600"
      >
        Cancelar
      </button>
      {state.error ? (
        <p role="alert" className="w-full text-xs text-red-600">
          {state.error}
        </p>
      ) : null}
    </form>
  );
}
