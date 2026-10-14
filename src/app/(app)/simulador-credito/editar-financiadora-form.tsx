"use client";

import { useState } from "react";
import { editarFinanciadora } from "./actions";
import { badgeClass, buttonClass, linkClass } from "@/lib/ui";
import type { FinanciadoraRow } from "@/lib/supabase/types";

const inputClass =
  "w-full rounded-lg border border-slate-300 px-2.5 py-1.5 text-sm text-slate-900 outline-none focus:border-indigo-600 focus:ring-1 focus:ring-indigo-600";

export function EditarFinanciadoraForm({ financiadora }: { financiadora: FinanciadoraRow }) {
  const [editando, setEditando] = useState(false);

  if (!editando) {
    return (
      <tr>
        <td className="px-4 py-2.5 font-medium text-slate-800">{financiadora.nombre}</td>
        <td className="px-4 py-2.5 text-slate-600">{(financiadora.tasa_mensual * 100).toFixed(4)}%</td>
        <td className="px-4 py-2.5 text-slate-600">{(financiadora.tasa_seguro * 100).toFixed(4)}%</td>
        <td className="px-4 py-2.5 text-slate-600">{financiadora.plazo_max}</td>
        <td className="px-4 py-2.5">
          <span className={badgeClass(financiadora.active ? "success" : "neutral")}>
            {financiadora.active ? "Activa" : "Inactiva"}
          </span>
        </td>
        <td className="px-4 py-2.5 text-right">
          <button type="button" onClick={() => setEditando(true)} className={linkClass("primary")}>
            Editar
          </button>
        </td>
      </tr>
    );
  }

  return (
    <tr className="bg-indigo-50/40">
      <td colSpan={6} className="px-4 py-3">
        <form
          action={editarFinanciadora}
          onSubmit={() => setEditando(false)}
          className="grid grid-cols-1 items-end gap-2 sm:grid-cols-6"
        >
          <input type="hidden" name="id" value={financiadora.id} />
          <label className="flex flex-col gap-1 text-xs text-slate-500">
            Nombre
            <input disabled value={financiadora.nombre} className={`${inputClass} bg-slate-100`} />
          </label>
          <label className="flex flex-col gap-1 text-xs text-slate-500">
            % mensual
            <input
              name="tasa_mensual_pct"
              type="number"
              min={0}
              step="0.0001"
              defaultValue={(financiadora.tasa_mensual * 100).toFixed(4)}
              required
              className={inputClass}
            />
          </label>
          <label className="flex flex-col gap-1 text-xs text-slate-500">
            % seguro deudor
            <input
              name="tasa_seguro_pct"
              type="number"
              min={0}
              step="0.0001"
              defaultValue={(financiadora.tasa_seguro * 100).toFixed(4)}
              required
              className={inputClass}
            />
          </label>
          <label className="flex flex-col gap-1 text-xs text-slate-500">
            Plazo máx. (cuotas)
            <input
              name="plazo_max"
              type="number"
              min={1}
              step="1"
              defaultValue={financiadora.plazo_max}
              required
              className={inputClass}
            />
          </label>
          <label className="flex items-center gap-2 text-xs text-slate-500">
            <input type="checkbox" name="active" defaultChecked={financiadora.active} className="h-4 w-4" />
            Activa
          </label>
          <div className="flex items-center gap-2">
            <button type="submit" className={buttonClass("primary", "sm")}>
              Guardar
            </button>
            <button type="button" onClick={() => setEditando(false)} className={linkClass("neutral")}>
              Cancelar
            </button>
          </div>
        </form>
      </td>
    </tr>
  );
}
