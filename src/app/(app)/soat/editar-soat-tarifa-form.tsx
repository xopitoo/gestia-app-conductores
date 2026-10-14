"use client";

import { useState } from "react";
import { editarSoatTarifa } from "./actions";
import { formatCOP } from "@/lib/format";
import { buttonClass, linkClass } from "@/lib/ui";
import type { SoatTarifaRow } from "@/lib/supabase/types";

const inputClass =
  "w-full rounded-lg border border-slate-300 px-2.5 py-1.5 text-sm text-slate-900 outline-none focus:border-indigo-600 focus:ring-1 focus:ring-indigo-600";

export function EditarSoatTarifaForm({ tarifa, esAdmin }: { tarifa: SoatTarifaRow; esAdmin: boolean }) {
  const [editando, setEditando] = useState(false);

  if (!editando) {
    return (
      <tr>
        <td className="px-4 py-2.5 text-xs text-slate-400">{tarifa.codigo}</td>
        <td className="px-4 py-2.5 text-slate-700">{tarifa.descripcion}</td>
        <td className="px-4 py-2.5 text-right text-slate-500">{formatCOP(tarifa.prima)}</td>
        <td className="px-4 py-2.5 text-right text-slate-500">{formatCOP(tarifa.contribucion)}</td>
        <td className="px-4 py-2.5 text-right text-slate-500">{formatCOP(tarifa.tasa_runt)}</td>
        <td className="px-4 py-2.5 text-right text-base font-semibold text-slate-900">
          {formatCOP(tarifa.total)}
        </td>
        {esAdmin ? (
          <td className="px-4 py-2.5 text-right">
            <button type="button" onClick={() => setEditando(true)} className={linkClass("primary")}>
              Editar
            </button>
          </td>
        ) : null}
      </tr>
    );
  }

  return (
    <tr className="bg-indigo-50/40">
      <td colSpan={7} className="px-4 py-3">
        <form
          action={editarSoatTarifa}
          onSubmit={() => setEditando(false)}
          className="grid grid-cols-1 items-end gap-2 sm:grid-cols-6"
        >
          <input type="hidden" name="id" value={tarifa.id} />
          <div className="flex flex-col gap-1 text-xs text-slate-500 sm:col-span-2">
            <span className="font-medium text-slate-700">{tarifa.codigo}</span>
            {tarifa.descripcion}
          </div>
          <label className="flex flex-col gap-1 text-xs text-slate-500">
            Prima
            <input
              name="prima"
              type="number"
              min={0}
              step="100"
              defaultValue={tarifa.prima}
              required
              className={inputClass}
            />
          </label>
          <label className="flex flex-col gap-1 text-xs text-slate-500">
            Contribución
            <input
              name="contribucion"
              type="number"
              min={0}
              step="100"
              defaultValue={tarifa.contribucion}
              required
              className={inputClass}
            />
          </label>
          <label className="flex flex-col gap-1 text-xs text-slate-500">
            Tasa RUNT
            <input
              name="tasa_runt"
              type="number"
              min={0}
              step="100"
              defaultValue={tarifa.tasa_runt}
              required
              className={inputClass}
            />
          </label>
          <label className="flex flex-col gap-1 text-xs text-slate-500">
            Total a pagar
            <input
              name="total"
              type="number"
              min={0}
              step="100"
              defaultValue={tarifa.total}
              required
              className={inputClass}
            />
          </label>
          <div className="flex items-center gap-2 sm:col-span-6">
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
