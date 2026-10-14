"use client";

import { useMemo, useState } from "react";
import { ChevronLeft, ShieldCheck } from "lucide-react";
import { formatCOP } from "@/lib/format";
import { buttonClass, linkClass } from "@/lib/ui";
import { agruparSoatPorFamilia, familiaDeSoat, type AnioSoat } from "@/lib/soat";
import type { SoatTarifaRow } from "@/lib/supabase/types";

export function CotizadorRapido({ tarifas }: { tarifas: SoatTarifaRow[] }) {
  const [familia, setFamilia] = useState<string | null>(null);
  const [anio, setAnio] = useState<AnioSoat | null>(null);
  const [tarifaId, setTarifaId] = useState<string | null>(null);

  const familias = useMemo(() => agruparSoatPorFamilia(tarifas), [tarifas]);

  const familiaActual = familias.find((f) => f.nombre === familia) ?? null;

  const opciones = useMemo(() => {
    if (!familiaActual) return [];
    if (!familiaActual.tieneAnio) return familiaActual.filas;
    if (!anio) return [];
    return familiaActual.filas.filter((t) => familiaDeSoat(t.categoria).anio === anio);
  }, [familiaActual, anio]);

  const tarifaElegida = tarifas.find((t) => t.id === tarifaId) ?? null;

  function reiniciar() {
    setFamilia(null);
    setAnio(null);
    setTarifaId(null);
  }

  return (
    <div className="rounded-2xl border-2 border-indigo-200 bg-indigo-50/40 p-4 sm:p-5">
      <div className="mb-3 flex items-center justify-between">
        <h2 className="flex items-center gap-2 text-sm font-semibold text-slate-800">
          <ShieldCheck className="h-4 w-4 text-indigo-600" />
          Cotizador rápido
        </h2>
        {familia ? (
          <button
            type="button"
            onClick={reiniciar}
            className="flex items-center gap-1 text-xs font-medium text-slate-500 hover:text-slate-700"
          >
            <ChevronLeft className="h-3.5 w-3.5" />
            Elegir otro vehículo
          </button>
        ) : null}
      </div>

      {tarifaElegida ? (
        <div className="rounded-xl border border-slate-200 bg-white p-4 sm:p-5">
          <p className="text-xs text-slate-400">
            {tarifaElegida.categoria} · {tarifaElegida.descripcion}
          </p>
          <p className="mt-1 text-3xl font-bold text-indigo-700">{formatCOP(tarifaElegida.total)}</p>
          <div className="mt-3 grid grid-cols-3 gap-2 text-xs text-slate-500">
            <div>
              <p className="text-slate-400">Prima</p>
              <p className="font-medium text-slate-700">{formatCOP(tarifaElegida.prima)}</p>
            </div>
            <div>
              <p className="text-slate-400">Contribución</p>
              <p className="font-medium text-slate-700">{formatCOP(tarifaElegida.contribucion)}</p>
            </div>
            <div>
              <p className="text-slate-400">Tasa RUNT</p>
              <p className="font-medium text-slate-700">{formatCOP(tarifaElegida.tasa_runt)}</p>
            </div>
          </div>
          <button type="button" onClick={reiniciar} className={`mt-4 ${buttonClass("secondary", "sm")}`}>
            Cotizar otro vehículo
          </button>
        </div>
      ) : !familia ? (
        <div className="flex flex-col gap-2">
          <p className="text-xs text-slate-500">¿Qué tipo de vehículo es?</p>
          <div className="flex flex-wrap gap-2">
            {familias.map((f) => (
              <button
                key={f.nombre}
                type="button"
                onClick={() => setFamilia(f.nombre)}
                className={`${buttonClass("secondary", "sm")} bg-white`}
              >
                {f.nombre}
              </button>
            ))}
          </div>
        </div>
      ) : familiaActual?.tieneAnio && !anio ? (
        <div className="flex flex-col gap-2">
          <p className="text-xs text-slate-500">{familia} — ¿qué antigüedad tiene?</p>
          <div className="flex flex-wrap gap-2">
            <button type="button" onClick={() => setAnio("0-9")} className={`${buttonClass("secondary", "sm")} bg-white`}>
              0 a 9 años
            </button>
            <button type="button" onClick={() => setAnio("10+")} className={`${buttonClass("secondary", "sm")} bg-white`}>
              10 años o más
            </button>
          </div>
          <button type="button" onClick={() => setFamilia(null)} className={`mt-1 self-start ${linkClass("neutral")}`}>
            Volver
          </button>
        </div>
      ) : (
        <div className="flex flex-col gap-2">
          <p className="text-xs text-slate-500">
            {familia}
            {anio ? ` (${anio === "0-9" ? "0 a 9 años" : "10 años o más"})` : ""} — ¿cuál exactamente?
          </p>
          <div className="flex flex-wrap gap-2">
            {opciones.map((t) => (
              <button
                key={t.id}
                type="button"
                onClick={() => setTarifaId(t.id)}
                className={`${buttonClass("secondary", "sm")} bg-white`}
              >
                {t.descripcion}
              </button>
            ))}
          </div>
          <button
            type="button"
            onClick={() => (anio ? setAnio(null) : setFamilia(null))}
            className={`mt-1 self-start ${linkClass("neutral")}`}
          >
            Volver
          </button>
        </div>
      )}
    </div>
  );
}
