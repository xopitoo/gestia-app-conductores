"use client";

import { useMemo, useState } from "react";
import { AlertTriangle, CheckCircle2, XCircle } from "lucide-react";
import { calcularCursoInfractor, diasTranscurridos, type TipoNotificacion } from "@/lib/curso-infractores";
import { formatCOP } from "@/lib/format";
import { badgeClass, buttonClass } from "@/lib/ui";

const inputClass =
  "w-full rounded-lg border border-slate-300 px-3.5 py-2.5 text-sm text-slate-900 outline-none transition focus:border-indigo-600 focus:ring-1 focus:ring-indigo-600";

function hoyISO() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

/** Evita pasar por Date/toISOString para mostrar la fecha — "YYYY-MM-DD" ya viene sin ambigüedad de huso horario. */
function formatFechaISO(iso: string) {
  const [anio, mes, dia] = iso.split("-");
  return `${dia}/${mes}/${anio}`;
}

export function Calculadora({ porcentajeCurso }: { porcentajeCurso: number }) {
  const [multa, setMulta] = useState(0);
  const [tipo, setTipo] = useState<TipoNotificacion>("fisico");
  const [fecha, setFecha] = useState("");
  // % que la organización suma encima del valor del curso (varía, se escribe a mano).
  const [incrementoPct, setIncrementoPct] = useState(0);

  const dias = fecha ? diasTranscurridos(fecha) : null;
  const resultado = useMemo(() => {
    if (dias === null || !(multa > 0)) return null;
    return calcularCursoInfractor({ multa, dias, tipo, porcentajeCurso });
  }, [multa, dias, tipo, porcentajeCurso]);

  const incremento = resultado ? Math.round((resultado.valorCurso * incrementoPct) / 100) : 0;

  return (
    <div className="flex flex-col gap-5">
      <div className="rounded-2xl border border-slate-200 bg-white p-4 sm:p-5">
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <label className="flex flex-col gap-1 text-sm">
            <span className="font-medium text-slate-700">Valor de la multa</span>
            <input
              type="number"
              min={0}
              step="1000"
              value={multa || ""}
              onChange={(e) => setMulta(Math.max(0, Number(e.target.value) || 0))}
              placeholder="Ej. 633.200"
              className={inputClass}
            />
          </label>
          <label className="flex flex-col gap-1 text-sm">
            <span className="font-medium text-slate-700">Tipo de notificación</span>
            <select value={tipo} onChange={(e) => setTipo(e.target.value as TipoNotificacion)} className={inputClass}>
              <option value="fisico">Comparendo físico</option>
              <option value="foto">Foto-multa</option>
            </select>
          </label>
          <label className="flex flex-col gap-1 text-sm">
            <span className="font-medium text-slate-700">Fecha de notificación</span>
            <input
              type="date"
              value={fecha}
              max={hoyISO()}
              onChange={(e) => setFecha(e.target.value)}
              className={inputClass}
            />
          </label>
          <label className="flex flex-col gap-1 text-sm">
            <span className="font-medium text-slate-700">Incremento % (opcional)</span>
            <input
              type="number"
              min={0}
              max={100}
              step="0.1"
              value={incrementoPct || ""}
              placeholder="0"
              onChange={(e) => setIncrementoPct(Math.min(100, Math.max(0, Number(e.target.value) || 0)))}
              className={inputClass}
            />
          </label>
        </div>
      </div>

      {resultado && dias !== null ? (
        <div
          className={`rounded-2xl border-2 p-4 sm:p-5 ${
            resultado.tier === "50"
              ? "border-emerald-200 bg-emerald-50/50"
              : resultado.tier === "25"
                ? "border-amber-200 bg-amber-50/50"
                : "border-red-200 bg-red-50/50"
          }`}
        >
          <div className="flex flex-wrap items-center gap-2">
            {resultado.tier === "vencido" ? (
              <span className={badgeClass("danger", "md")}>
                <XCircle className="mr-1 inline h-3.5 w-3.5" />
                Venció el plazo de descuento
              </span>
            ) : (
              <span className={badgeClass(resultado.tier === "50" ? "success" : "warning", "md")}>
                <CheckCircle2 className="mr-1 inline h-3.5 w-3.5" />
                Aplica {resultado.tier}% de descuento
              </span>
            )}
            <span className="text-xs text-slate-500">
              {dias} {dias === 1 ? "día" : "días"} desde la notificación ({formatFechaISO(fecha)})
            </span>
          </div>

          {resultado.tier === "vencido" ? (
            <p className="mt-3 text-sm text-slate-700">
              Ya pasaron los días hábiles para el descuento (
              {tipo === "fisico" ? "20 días desde el comparendo" : "26 días desde la notificación"}). El cliente debe
              pagar el valor completo de la multa directo en los puntos SIMIT — no aplica curso.
            </p>
          ) : (
            <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div className="rounded-xl border border-slate-200 bg-white p-4">
                <p className="text-xs text-slate-400">Multa con descuento ({resultado.tier}%)</p>
                <p className="mt-1 text-xl font-semibold text-slate-700">{formatCOP(resultado.montoConDescuento)}</p>
                <p className="mt-1 text-xs text-slate-400">de {formatCOP(multa)} original</p>
              </div>
              <div className="rounded-xl border border-indigo-200 bg-indigo-50 p-4">
                <p className="text-xs text-indigo-500">Valor del curso (lo cobrás acá)</p>
                <p className="mt-1 text-xl font-semibold text-indigo-700">
                  {formatCOP(resultado.valorCurso + incremento)}
                </p>
                {incrementoPct > 0 ? (
                  <p className="mt-1 text-xs text-indigo-500">
                    {formatCOP(resultado.valorCurso)} + {incrementoPct}% ({formatCOP(incremento)})
                  </p>
                ) : null}
              </div>
              <div className="rounded-xl border border-slate-200 bg-white p-4 sm:col-span-2">
                <p className="text-xs text-slate-400">Saldo que el cliente paga en el SIMIT</p>
                <p className="mt-1 text-xl font-semibold text-slate-700">{formatCOP(resultado.saldoMulta)}</p>
              </div>
            </div>
          )}
        </div>
      ) : (
        <div className="rounded-2xl border border-slate-200 bg-white p-6 text-center text-sm text-slate-400">
          Completá el valor de la multa y la fecha de notificación para calcular el descuento.
        </div>
      )}

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <div className="rounded-xl border border-emerald-200 bg-emerald-50/40 p-4 text-sm">
          <p className="font-semibold text-emerald-800">50% de descuento</p>
          <p className="mt-1 text-emerald-700">
            Dentro de los primeros 5 días desde que se expidió el comparendo físico, o dentro de los primeros 11
            días desde que se notificó la foto-multa.
          </p>
        </div>
        <div className="rounded-xl border border-amber-200 bg-amber-50/40 p-4 text-sm">
          <p className="font-semibold text-amber-800">25% de descuento</p>
          <p className="mt-1 text-amber-700">
            Entre el día 6 y el día 20 desde el comparendo físico, o entre el día 12 y el día 26 desde la
            notificación de la foto-multa.
          </p>
        </div>
      </div>

      <p className="flex items-start gap-1.5 text-xs text-slate-400">
        <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
        Cálculo informativo basado en los plazos legales vigentes — confirmá siempre el valor exacto de la multa y
        el estado del comparendo en el RUNT o el SIMIT antes de cobrar.
      </p>

      <button type="button" onClick={() => window.print()} className={`self-start ${buttonClass("secondary")}`}>
        Imprimir / guardar como PDF
      </button>
    </div>
  );
}
