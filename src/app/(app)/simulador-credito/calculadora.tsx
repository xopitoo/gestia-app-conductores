"use client";

import { useMemo, useState } from "react";
import { calcularAmortizacion } from "@/lib/simulador-credito";
import { formatCOP } from "@/lib/format";
import { buttonClass } from "@/lib/ui";
import type { FinanciadoraRow } from "@/lib/supabase/types";

type Tema = {
  /** Pestaña activa (seleccionada). */
  tabActiva: string;
  /** Punto de color junto al nombre en la pestaña — para distinguir de un vistazo incluso sin seleccionar. */
  punto: string;
  texto: string;
  fondoSuave: string;
  borde: string;
  barra: string;
  anillo: string;
};

/**
 * Un color de marca por financiadora, para que el simulador se "sienta"
 * distinto según cuál esté eligiendo el recepcionista (Brilla=rojo,
 * Addi=azul clarito, Sistecrédito=verde, a pedido del admin). Cualquier
 * financiadora nueva que no esté acá (ej. una que agregue un admin después)
 * cae en el tema por defecto (índigo, el color primario del resto de la
 * app).
 */
const TEMAS: Record<string, Tema> = {
  brilla: {
    tabActiva: "border-red-600 bg-red-50 text-red-700",
    punto: "bg-red-500",
    texto: "text-red-700",
    fondoSuave: "bg-red-50",
    borde: "border-red-200",
    barra: "bg-red-600",
    anillo: "focus:border-red-600 focus:ring-red-600",
  },
  addi: {
    tabActiva: "border-sky-500 bg-sky-50 text-sky-700",
    punto: "bg-sky-400",
    texto: "text-sky-700",
    fondoSuave: "bg-sky-50",
    borde: "border-sky-200",
    barra: "bg-sky-500",
    anillo: "focus:border-sky-500 focus:ring-sky-500",
  },
  sistecredito: {
    tabActiva: "border-green-600 bg-green-50 text-green-700",
    punto: "bg-green-500",
    texto: "text-green-700",
    fondoSuave: "bg-green-50",
    borde: "border-green-200",
    barra: "bg-green-600",
    anillo: "focus:border-green-600 focus:ring-green-600",
  },
};

const TEMA_DEFAULT: Tema = {
  tabActiva: "border-indigo-600 bg-indigo-50 text-indigo-700",
  punto: "bg-indigo-500",
  texto: "text-indigo-700",
  fondoSuave: "bg-indigo-50",
  borde: "border-indigo-200",
  barra: "bg-indigo-600",
  anillo: "focus:border-indigo-600 focus:ring-indigo-600",
};

function normalizar(s: string) {
  return s
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .trim();
}

function temaDe(nombre: string): Tema {
  return TEMAS[normalizar(nombre)] ?? TEMA_DEFAULT;
}

export function Calculadora({ financiadoras }: { financiadoras: FinanciadoraRow[] }) {
  const [financiadoraId, setFinanciadoraId] = useState(financiadoras[0]?.id ?? "");
  const [monto, setMonto] = useState(1_000_000);
  const [plazo, setPlazo] = useState(financiadoras[0]?.plazo_max ?? 36);

  const financiadora = financiadoras.find((f) => f.id === financiadoraId) ?? null;
  const tema = financiadora ? temaDe(financiadora.nombre) : TEMA_DEFAULT;

  const inputClass = `w-full rounded-lg border border-slate-300 px-3.5 py-2.5 text-sm text-slate-900 outline-none transition ${tema.anillo} focus:ring-1`;

  const usaTablaFactores = !!financiadora?.tabla_factores?.length;

  const filas = useMemo(() => {
    if (!financiadora) return [];
    return calcularAmortizacion({
      monto,
      plazo,
      tasaMensual: financiadora.tasa_mensual,
      tasaSeguro: financiadora.tasa_seguro,
      tablaFactores: financiadora.tabla_factores,
    });
  }, [financiadora, monto, plazo]);

  const totalPagar = filas.reduce((acc, f) => acc + f.total, 0);

  if (financiadoras.length === 0) {
    return (
      <div className="rounded-2xl border border-slate-200 bg-white p-8 text-center text-sm text-slate-400">
        Todavía no hay financiadoras cargadas.
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-wrap gap-2">
        {financiadoras.map((f) => {
          const tf = temaDe(f.nombre);
          const activa = f.id === financiadoraId;
          return (
            <button
              key={f.id}
              type="button"
              onClick={() => {
                setFinanciadoraId(f.id);
                setPlazo((p) => Math.min(p, f.plazo_max));
              }}
              className={`flex items-center gap-2 rounded-xl border px-4 py-2 text-sm font-semibold transition ${
                activa ? tf.tabActiva : "border-slate-300 text-slate-600 hover:bg-slate-100"
              }`}
            >
              <span className={`h-2 w-2 shrink-0 rounded-full ${tf.punto}`} />
              {f.nombre}
            </button>
          );
        })}
      </div>

      {!financiadora ? null : financiadora.tasa_mensual === 0 && !usaTablaFactores ? (
        <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">
          {financiadora.nombre} todavía no tiene una tasa cargada — pedile a un admin que la configure acá
          abajo antes de usarla para cotizar con un cliente.
        </div>
      ) : (
        <div className={`rounded-2xl border-2 p-4 transition sm:p-5 ${tema.borde} ${tema.fondoSuave}`}>
          <div className="flex flex-col gap-5">
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <label className="flex flex-col gap-1 text-sm">
                <span className="font-medium text-slate-700">Valor a financiar</span>
                <input
                  type="number"
                  min={1}
                  step="1000"
                  value={monto || ""}
                  onChange={(e) => setMonto(Math.max(0, Number(e.target.value) || 0))}
                  className={inputClass}
                />
              </label>
              <label className="flex flex-col gap-1 text-sm">
                <span className="font-medium text-slate-700">
                  Número de cuotas (máx. {financiadora.plazo_max})
                </span>
                <input
                  type="number"
                  min={1}
                  max={financiadora.plazo_max}
                  step="1"
                  value={plazo || ""}
                  onChange={(e) =>
                    setPlazo(Math.min(financiadora.plazo_max, Math.max(1, Number(e.target.value) || 0)))
                  }
                  className={inputClass}
                />
              </label>
            </div>

            {filas.length > 0 ? (
              <>
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                  <div className="rounded-xl border border-slate-200 bg-white p-4">
                    <p className="text-xs text-slate-400">Primera cuota</p>
                    <p className={`mt-1 text-xl font-semibold ${tema.texto}`}>{formatCOP(filas[0].total)}</p>
                  </div>
                  <div className="rounded-xl border border-slate-200 bg-white p-4">
                    <p className="text-xs text-slate-400">Última cuota</p>
                    <p className="mt-1 text-xl font-semibold text-slate-700">
                      {formatCOP(filas[filas.length - 1].total)}
                    </p>
                  </div>
                  <div className="rounded-xl border border-slate-200 bg-white p-4">
                    <p className="text-xs text-slate-400">Total a pagar ({plazo} cuotas)</p>
                    <p className="mt-1 text-xl font-semibold text-slate-700">{formatCOP(totalPagar)}</p>
                  </div>
                </div>

                <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white">
                  <div className={`h-1.5 w-full ${tema.barra}`} />
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead className="bg-slate-50 text-left text-xs font-medium text-slate-500">
                        <tr>
                          <th className="px-4 py-2">Mes</th>
                          <th className="px-4 py-2 text-right">Valor cuota</th>
                          {usaTablaFactores ? null : (
                            <th className="px-4 py-2 text-right">Seguro deudor</th>
                          )}
                          <th className="px-4 py-2 text-right">Total</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {filas.map((f) => (
                          <tr key={f.mes}>
                            <td className="px-4 py-2 text-slate-600">{f.mes}</td>
                            <td className="px-4 py-2 text-right text-slate-700">{formatCOP(f.cuota)}</td>
                            {usaTablaFactores ? null : (
                              <td className="px-4 py-2 text-right text-slate-500">{formatCOP(f.seguro)}</td>
                            )}
                            <td className={`px-4 py-2 text-right font-semibold ${tema.texto}`}>
                              {formatCOP(f.total)}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
                <p className="text-xs text-slate-400">
                  {usaTablaFactores
                    ? `Cuotas tomadas directamente del simulador público de ${financiadora.nombre} (tabla real, no una tasa calculada) — pueden variar si ellos actualizan sus condiciones.`
                    : `Cálculo estimado con la tasa cargada en el sistema — puede variar levemente frente al simulador oficial de ${financiadora.nombre} por redondeos.`}
                </p>
              </>
            ) : null}
          </div>
        </div>
      )}

      <button type="button" onClick={() => window.print()} className={`self-start ${buttonClass("secondary")}`}>
        Imprimir / guardar como PDF
      </button>
    </div>
  );
}
