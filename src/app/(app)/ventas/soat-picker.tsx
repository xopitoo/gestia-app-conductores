"use client";

import { useState } from "react";
import { Plus } from "lucide-react";

/**
 * El precio del SOAT varía según el vehículo (37 combinaciones, ver /soat) —
 * no tiene sentido como producto de precio fijo en el catálogo. En vez de un
 * selector guiado, se mete el valor directo (ya consultado en /soat o en el
 * documento del cliente) y se agrega al carrito como un ítem suelto.
 */
export function SoatPicker({ onAgregar }: { onAgregar: (nombre: string, precio: number) => void }) {
  const [valor, setValor] = useState("");
  const monto = Number(valor) || 0;

  function agregar() {
    if (!(monto > 0)) return;
    onAgregar("SOAT", monto);
    setValor("");
  }

  return (
    <div className="flex items-center gap-2">
      <input
        type="number"
        min={0}
        step="100"
        value={valor}
        onChange={(e) => setValor(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter") {
            e.preventDefault();
            agregar();
          }
        }}
        placeholder="Valor del SOAT"
        className="flex-1 rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900 outline-none focus:border-indigo-600 focus:ring-1 focus:ring-indigo-600"
      />
      <button
        type="button"
        disabled={!(monto > 0)}
        onClick={agregar}
        className="flex shrink-0 items-center gap-1 rounded-lg bg-amber-600 px-3 py-2 text-sm font-medium text-white transition hover:bg-amber-700 disabled:cursor-not-allowed disabled:opacity-50"
      >
        <Plus className="h-4 w-4" />
        Agregar
      </button>
    </div>
  );
}
