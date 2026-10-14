"use client";

import { useMemo, useState } from "react";
import { Search } from "lucide-react";
import { EditarSoatTarifaForm } from "./editar-soat-tarifa-form";
import type { SoatTarifaRow } from "@/lib/supabase/types";

function normalizar(s: string) {
  return s
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase();
}

export function SoatTabla({ tarifas, esAdmin }: { tarifas: SoatTarifaRow[]; esAdmin: boolean }) {
  const [busqueda, setBusqueda] = useState("");

  const grupos = useMemo(() => {
    const q = normalizar(busqueda.trim());
    const filtradas = q
      ? tarifas.filter(
          (t) =>
            normalizar(t.categoria).includes(q) ||
            normalizar(t.descripcion).includes(q) ||
            normalizar(t.codigo).includes(q),
        )
      : tarifas;

    const mapa = new Map<string, SoatTarifaRow[]>();
    for (const t of filtradas) {
      if (!mapa.has(t.categoria)) mapa.set(t.categoria, []);
      mapa.get(t.categoria)!.push(t);
    }
    return Array.from(mapa.entries());
  }, [tarifas, busqueda]);

  return (
    <div className="flex flex-col gap-4">
      <label className="relative">
        <Search className="pointer-events-none absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-slate-400" />
        <input
          type="search"
          value={busqueda}
          onChange={(e) => setBusqueda(e.target.value)}
          placeholder="Buscar por tipo de vehículo (ej. moto, taxi, camioneta, carga)..."
          className="w-full rounded-xl border border-slate-300 py-2.5 pr-3.5 pl-10 text-sm text-slate-900 outline-none focus:border-indigo-600 focus:ring-1 focus:ring-indigo-600"
        />
      </label>

      {grupos.length === 0 ? (
        <div className="rounded-2xl border border-slate-200 bg-white p-8 text-center text-sm text-slate-400">
          No hay ninguna tarifa que coincida con &quot;{busqueda}&quot;.
        </div>
      ) : (
        grupos.map(([categoria, filas]) => (
          <div key={categoria} className="overflow-hidden rounded-2xl border border-slate-200 bg-white">
            <div className="border-b border-slate-200 bg-slate-50 px-4 py-2.5 text-sm font-semibold text-slate-800">
              {categoria}
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="text-left text-xs font-medium text-slate-500">
                  <tr>
                    <th className="px-4 py-2">Tarifa</th>
                    <th className="px-4 py-2">Vehículo</th>
                    <th className="px-4 py-2 text-right">Prima</th>
                    <th className="px-4 py-2 text-right">Contribución</th>
                    <th className="px-4 py-2 text-right">Tasa RUNT</th>
                    <th className="px-4 py-2 text-right">Total a pagar</th>
                    {esAdmin ? <th className="px-4 py-2" /> : null}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {filas.map((t) => (
                    <EditarSoatTarifaForm key={t.id} tarifa={t} esAdmin={esAdmin} />
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        ))
      )}
    </div>
  );
}
