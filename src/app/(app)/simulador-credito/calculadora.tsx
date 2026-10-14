"use client";

import { useMemo, useState } from "react";
import { calcularAmortizacion } from "@/lib/simulador-credito";
import { formatCOP } from "@/lib/format";
import { buttonClass } from "@/lib/ui";
import type { FinanciadoraRow } from "@/lib/supabase/types";

const inputClass =
  "w-full rounded-lg border border-slate-300 px-3.5 py-2.5 text-sm text-slate-900 outline-none transition focus:border-indigo-600 focus:ring-1 focus:ring-indigo-600";

export function Calculadora({ financiadoras }: { financiadoras: FinanciadoraRow[] }) {
  const [financiadoraId, setFinanciadoraId] = useState(financiadoras[0]?.id ?? "");
  const [monto, setMonto] = useState(1_000_000);
  const [plazo, setPlazo] = useState(financiadoras[0]?.plazo_max ?? 36);

  const financiadora = financiadoras.find((f) => f.id === financiadoraId) ?? null;

  const filas = useMemo(() => {
    if (!financiadora) return [];
    return calcularAmortizacion({
      monto,
      plazo,
      tasaMensual: financiadora.tasa_mensual,
      tasaSeguro: financiadora.tasa_seguro,
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
        {financiadoras.map((f) => (
          <button
            key={f.id}
            type="button"
            onClick={() => {
              setFinanciadoraId(f.id);
              setPlazo((p) => Math.min(p, f.plazo_max));
            }}
            className={`rounded-xl border px-4 py-2 text-sm font-semibold transition ${
              f.id === financiadoraId
                ? "border-indigo-600 bg-indigo-50 text-indigo-700"
                : "border-slate-300 text-slate-600 hover:bg-slate-100"
            }`}
          >
            {f.nombre}
          </button>
        ))}
      </div>

      {!financiadora ? null : financiadora.tasa_mensual === 0 ? (
        <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">
          {financiadora.nombre} todavía no tiene una tasa cargada — pedile a un admin que la configure acá
          abajo antes de usarla para cotizar con un cliente.
        </div>
      ) : (
        <>
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
              <span className="font-medium text-slate-700">Número de cuotas (máx. {financiadora.plazo_max})</span>
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
                  <p className="mt-1 text-xl font-semibold text-indigo-700">{formatCOP(filas[0].total)}</p>
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

              <div className="overflow-x-auto rounded-2xl border border-slate-200 bg-white">
                <table className="w-full text-sm">
                  <thead className="bg-slate-50 text-left text-xs font-medium text-slate-500">
                    <tr>
                      <th className="px-4 py-2">Mes</th>
                      <th className="px-4 py-2 text-right">Valor cuota</th>
                      <th className="px-4 py-2 text-right">Seguro deudor</th>
                      <th className="px-4 py-2 text-right">Total</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {filas.map((f) => (
                      <tr key={f.mes}>
                        <td className="px-4 py-2 text-slate-600">{f.mes}</td>
                        <td className="px-4 py-2 text-right text-slate-700">{formatCOP(f.cuota)}</td>
                        <td className="px-4 py-2 text-right text-slate-500">{formatCOP(f.seguro)}</td>
                        <td className="px-4 py-2 text-right font-semibold text-slate-800">
                          {formatCOP(f.total)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <p className="text-xs text-slate-400">
                Cálculo estimado con la tasa cargada en el sistema — puede variar levemente frente al
                simulador oficial de {financiadora.nombre} por redondeos.
              </p>
            </>
          ) : null}
        </>
      )}

      <button type="button" onClick={() => window.print()} className={`self-start ${buttonClass("secondary")}`}>
        Imprimir / guardar como PDF
      </button>
    </div>
  );
}
