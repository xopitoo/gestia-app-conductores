"use client";

import { useState } from "react";
import { Camera, Clock, FileCheck2, X } from "lucide-react";
import { formatCOP } from "@/lib/format";
import {
  METODO_PAGO_CON_COMPROBANTE,
  METODO_PAGO_LABEL,
  METODO_PAGO_SELECCIONABLE,
  type MetodoPago,
  type VentaPagoInput,
} from "@/lib/supabase/types";
import { pagoComprobanteFieldName } from "./parse-form-arrays";
import { linkClass } from "@/lib/ui";

const inputClass =
  "w-full rounded-lg border border-slate-300 px-3.5 py-2.5 text-sm text-slate-900 outline-none transition focus:border-indigo-600 focus:ring-1 focus:ring-indigo-600";

/**
 * Líneas de pago repetibles (monto + método) para registrar una venta o un
 * abono. Se auto-contiene: renderiza sus propios <input type="hidden">
 * (name="pagos", y name="pin" si allowPin) dentro del <form> que la
 * envuelve — no hace falta levantar el estado al padre.
 */
export function PagoLines({
  total,
  allowPin = false,
  metodos = METODO_PAGO_SELECCIONABLE,
  metodosConComprobante = METODO_PAGO_CON_COMPROBANTE,
}: {
  /** Monto que se espera cubrir (total de la orden, o saldo pendiente en un abono). */
  total: number;
  /** Si true, muestra el campo de PIN cuando el pago cae por debajo del 50%. */
  allowPin?: boolean;
  /** Restringe qué métodos se pueden elegir — por defecto, todos los de venta (ver METODO_PAGO_TRAMITADOR para el subconjunto de tramitadores). */
  metodos?: MetodoPago[];
  /** Restringe en cuáles se ofrece adjuntar comprobante — por defecto, los de venta. */
  metodosConComprobante?: MetodoPago[];
}) {
  const [pagos, setPagos] = useState<VentaPagoInput[]>([
    { monto: total, metodo_pago: "efectivo" },
  ]);
  const [pin, setPin] = useState("");
  // Solo para mostrar el nombre del archivo elegido — el archivo en sí
  // viaja en su propio <input type="file"> (no se puede meter en el JSON
  // de "pagos"), el server action lo lee aparte por índice.
  const [comprobantes, setComprobantes] = useState<Record<number, string>>({});

  const pagado = pagos.reduce((acc, p) => acc + (Number(p.monto) || 0), 0);
  const saldo = total - pagado;
  const requierePin = allowPin && pagado < total * 0.5;
  // Solo al crear la venta (allowPin) tiene sentido dejarla sin ningún pago
  // inicial (ej. el tramitador trae gente y paga al día siguiente) — un
  // abono siempre necesita al menos un monto, si no no hay nada que registrar.
  const puedeQuedarSinPagos = allowPin;

  function actualizar(i: number, field: keyof VentaPagoInput, value: string) {
    setPagos((prev) =>
      prev.map((p, idx) =>
        idx === i
          ? { ...p, [field]: field === "monto" ? Number(value) || 0 : (value as MetodoPago) }
          : p,
      ),
    );
  }

  function agregar() {
    setPagos((prev) => [...prev, { monto: 0, metodo_pago: "efectivo" }]);
  }

  function deshacerSinPagos() {
    setPagos([{ monto: total, metodo_pago: "efectivo" }]);
  }

  function quitar(i: number) {
    setPagos((prev) => prev.filter((_, idx) => idx !== i));
    setComprobantes({});
  }

  function elegirComprobante(i: number, file: File | undefined) {
    setComprobantes((prev) => {
      const next = { ...prev };
      if (file) next[i] = file.name;
      else delete next[i];
      return next;
    });
  }

  return (
    <section className="flex flex-col gap-2 rounded-lg border border-slate-200 p-3">
      <input type="hidden" name="pagos" value={JSON.stringify(pagos)} />
      {allowPin ? <input type="hidden" name="pin" value={pin} /> : null}

      <div className="flex flex-wrap items-center justify-between gap-2">
        <span className="text-xs font-semibold tracking-wide text-slate-500 uppercase">Pago</span>
        {puedeQuedarSinPagos && pagos.length > 0 ? (
          <button
            type="button"
            onClick={() => setPagos([])}
            className="flex items-center gap-1.5 rounded-lg border border-amber-300 bg-amber-50 px-3 py-1.5 text-xs font-semibold text-amber-800 shadow-sm shadow-amber-900/5 transition hover:border-amber-400 hover:bg-amber-100"
          >
            <Clock className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
            Sin pago inicial — queda pendiente
          </button>
        ) : null}
      </div>

      {pagos.length === 0 ? (
        <div className="flex items-center justify-between gap-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2.5">
          <p className="flex items-center gap-1.5 text-xs font-medium text-amber-800">
            <Clock className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
            Se registra sin ningún pago inicial — queda totalmente pendiente.
          </p>
          <button
            type="button"
            onClick={deshacerSinPagos}
            className={linkClass("neutral")}
          >
            Deshacer
          </button>
        </div>
      ) : null}

      {pagos.map((p, i) => (
        <div key={i} className="flex flex-col gap-1.5">
          <div className="grid grid-cols-[1fr_140px_auto] items-center gap-2">
            <select
              value={p.metodo_pago}
              onChange={(e) => actualizar(i, "metodo_pago", e.target.value)}
              className={inputClass}
            >
              {metodos.map((value) => (
                <option key={value} value={value}>
                  {METODO_PAGO_LABEL[value]}
                </option>
              ))}
            </select>
            <input
              type="number"
              min={1}
              step="1"
              value={p.monto || ""}
              onChange={(e) => actualizar(i, "monto", e.target.value)}
              placeholder="Monto"
              className={inputClass}
            />
            {pagos.length > 1 || puedeQuedarSinPagos ? (
              <button
                type="button"
                onClick={() => quitar(i)}
                className="flex h-9 w-9 items-center justify-center text-slate-400 hover:text-red-600"
                title="Quitar"
              >
                <X className="h-4 w-4" />
              </button>
            ) : (
              <span />
            )}
          </div>

          {metodosConComprobante.includes(p.metodo_pago) ? (
            <label className="flex w-fit cursor-pointer items-center gap-1.5 rounded-lg border border-dashed border-slate-300 px-3 py-1.5 text-xs font-medium text-slate-600 transition hover:border-indigo-400 hover:text-indigo-700">
              {comprobantes[i] ? (
                <FileCheck2 className="h-3.5 w-3.5 shrink-0 text-emerald-600" aria-hidden="true" />
              ) : (
                <Camera className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
              )}
              <span className="max-w-[14rem] truncate">
                {comprobantes[i] ?? "Adjuntar comprobante (opcional)"}
              </span>
              <input
                type="file"
                name={pagoComprobanteFieldName(i)}
                accept="image/*,.pdf"
                capture="environment"
                className="hidden"
                onChange={(e) => elegirComprobante(i, e.target.files?.[0])}
              />
            </label>
          ) : null}
        </div>
      ))}

      <button
        type="button"
        onClick={agregar}
        className={`self-start ${linkClass("primary")}`}
      >
        + Agregar otro pago
      </button>

      <div className="flex flex-col gap-0.5 border-t border-slate-200 pt-2 text-sm">
        <div className="flex items-center justify-between text-slate-600">
          <span>Total a cubrir</span>
          <span>{formatCOP(total)}</span>
        </div>
        <div className="flex items-center justify-between font-medium text-slate-900">
          <span>Pagando ahora</span>
          <span>{formatCOP(pagado)}</span>
        </div>
        {saldo > 0 ? (
          <div className="flex items-center justify-between text-amber-700">
            <span>Queda pendiente</span>
            <span>{formatCOP(saldo)}</span>
          </div>
        ) : null}
      </div>

      {requierePin ? (
        <div className="flex flex-col gap-1.5 rounded-lg bg-amber-50 p-3">
          <label className="text-sm font-medium text-amber-800">
            PIN de autorización — el pago es menor al 50% del total
            <span className="ml-0.5 text-red-500">*</span>
          </label>
          <input
            type="password"
            inputMode="numeric"
            required
            value={pin}
            onChange={(e) => setPin(e.target.value)}
            placeholder="PIN"
            className={inputClass}
          />
        </div>
      ) : null}
    </section>
  );
}
