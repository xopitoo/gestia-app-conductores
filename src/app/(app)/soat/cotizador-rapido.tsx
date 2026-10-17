"use client";

import { useMemo, useState } from "react";
import { ChevronLeft, ShieldCheck } from "lucide-react";
import { formatCOP } from "@/lib/format";
import { buttonClass, linkClass } from "@/lib/ui";
import { agruparSoatPorFamilia, ESTUDIO_SOAT, familiaDeSoat, type AnioSoat } from "@/lib/soat";
import type { SoatTarifaRow } from "@/lib/supabase/types";

export function CotizadorRapido({ tarifas }: { tarifas: SoatTarifaRow[] }) {
  const [familia, setFamilia] = useState<string | null>(null);
  const [anio, setAnio] = useState<AnioSoat | null>(null);
  const [tarifaId, setTarifaId] = useState<string | null>(null);
  // Cobro propio de la organización encima de la tarifa oficial: el estudio
  // del SOAT (fijo, editable por si algún día cambia) y un % opcional (ej.
  // cuando se financia con Brilla/Addi/Sistecrédito, que varía por cada una).
  const [estudio, setEstudio] = useState(ESTUDIO_SOAT);
  const [incrementoPct, setIncrementoPct] = useState(0);

  const familias = useMemo(() => agruparSoatPorFamilia(tarifas), [tarifas]);

  const familiaActual = familias.find((f) => f.nombre === familia) ?? null;

  const opciones = useMemo(() => {
    if (!familiaActual) return [];
    if (!familiaActual.tieneAnio) return familiaActual.filas;
    if (!anio) return [];
    return familiaActual.filas.filter((t) => familiaDeSoat(t.categoria).anio === anio);
  }, [familiaActual, anio]);

  const tarifaElegida = tarifas.find((t) => t.id === tarifaId) ?? null;
  // El incremento % se calcula sobre SOAT + estudio, que es lo que se financia.
  const baseIncremento = (tarifaElegida?.total ?? 0) + estudio;
  const incremento = Math.round((baseIncremento * incrementoPct) / 100);
  const totalCobrar = baseIncremento + incremento;

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
          <p className="mt-1 text-3xl font-bold text-indigo-700">{formatCOP(totalCobrar)}</p>
          <p className="text-xs text-slate-400">Total a cobrar al cliente</p>

          <div className="mt-3 flex flex-col gap-1 rounded-lg bg-slate-50 p-3 text-sm">
            <div className="flex justify-between text-slate-600">
              <span>SOAT (tarifa oficial)</span>
              <span className="font-medium">{formatCOP(tarifaElegida.total)}</span>
            </div>
            <div className="flex justify-between text-slate-600">
              <span>Estudio del SOAT</span>
              <span className="font-medium">{formatCOP(estudio)}</span>
            </div>
            {incrementoPct > 0 ? (
              <div className="flex justify-between text-slate-600">
                <span>Incremento {incrementoPct}%</span>
                <span className="font-medium">{formatCOP(incremento)}</span>
              </div>
            ) : null}
          </div>

          <div className="mt-3 grid grid-cols-2 gap-3">
            <label className="flex flex-col gap-1 text-xs text-slate-500">
              Estudio ($)
              <input
                type="number"
                min={0}
                step="1000"
                value={estudio}
                onChange={(e) => setEstudio(Math.max(0, Number(e.target.value) || 0))}
                className="rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900 outline-none focus:border-indigo-600 focus:ring-1 focus:ring-indigo-600"
              />
            </label>
            <label className="flex flex-col gap-1 text-xs text-slate-500">
              Incremento % (opcional)
              <input
                type="number"
                min={0}
                max={100}
                step="0.1"
                value={incrementoPct || ""}
                placeholder="0"
                onChange={(e) => setIncrementoPct(Math.min(100, Math.max(0, Number(e.target.value) || 0)))}
                className="rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900 outline-none focus:border-indigo-600 focus:ring-1 focus:ring-indigo-600"
              />
            </label>
          </div>

          <p className="mt-4 text-[11px] font-medium tracking-wide text-slate-400 uppercase">Desglose de la tarifa oficial</p>
          <div className="mt-1 grid grid-cols-3 gap-2 text-xs text-slate-500">
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
