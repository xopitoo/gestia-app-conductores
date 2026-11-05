"use client";

import { useActionState } from "react";
import { agregarPinesVenta } from "./actions";
import { buttonClass } from "@/lib/ui";

/** Campos para los PIN de curso que aún faltan en una venta. */
export function PinesForm({ ventaId, faltan }: { ventaId: string; faltan: number }) {
  const [state, formAction, pending] = useActionState(agregarPinesVenta.bind(null, ventaId), {});

  return (
    <form action={formAction} className="flex flex-col gap-2">
      <p className="text-xs font-medium text-amber-700">
        Falta registrar {faltan} {faltan === 1 ? "PIN" : "PIN"} de curso — es obligatorio para cerrar la caja.
      </p>
      <div className="flex flex-wrap items-center gap-2">
        {Array.from({ length: faltan }, (_, i) => (
          <input
            key={i}
            name="pin"
            required
            inputMode="numeric"
            placeholder={faltan > 1 ? `PIN ${i + 1}` : "Número de PIN"}
            className="w-40 rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900 outline-none focus:border-indigo-600 focus:ring-1 focus:ring-indigo-600"
          />
        ))}
        <button type="submit" disabled={pending} className={buttonClass("primary", "sm")}>
          {pending ? "Guardando..." : "Guardar PIN"}
        </button>
      </div>
      {state.error ? <p className="text-xs text-red-600">{state.error}</p> : null}
    </form>
  );
}
