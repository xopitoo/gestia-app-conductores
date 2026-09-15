"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import { Pencil } from "lucide-react";
import { corregirPrecioTramitador } from "./actions";
import { linkClass } from "@/lib/ui";

/**
 * Corrección puntual del precio especial (lo que le corresponde a la
 * organización) de una venta ya creada — antes no existía forma de arreglar
 * esto si quedaba mal cargado (ej. se editó a mano sin querer y quedó en
 * $0), solo se podía ver, nunca corregir. Admin-only.
 */
export function EditarPrecioTramitador({
  ventaId,
  precioActual,
}: {
  ventaId: string;
  precioActual: number;
}) {
  const [editando, setEditando] = useState(false);
  const accionConVenta = corregirPrecioTramitador.bind(null, ventaId);
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
        className={`inline-flex items-center gap-1 ${linkClass("primary")}`}
        title="Corregir precio del tramitador"
      >
        <Pencil className="h-3 w-3" aria-hidden="true" />
        Corregir
      </button>
    );
  }

  return (
    <form action={formAction} className="mt-1 flex flex-wrap items-center gap-1.5">
      <input
        name="precio_tramitador"
        type="number"
        min={0}
        step="1"
        defaultValue={precioActual}
        autoFocus
        className="w-32 rounded-md border border-slate-300 px-2 py-1 text-xs text-slate-900 outline-none focus:border-indigo-600 focus:ring-1 focus:ring-indigo-600"
      />
      <button
        type="submit"
        disabled={pending}
        className="rounded-md bg-indigo-600 px-2 py-1 text-xs font-medium text-white hover:bg-indigo-700 disabled:cursor-not-allowed disabled:opacity-60"
      >
        {pending ? "..." : "Guardar"}
      </button>
      <button type="button" onClick={() => setEditando(false)} className={linkClass("neutral")}>
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
