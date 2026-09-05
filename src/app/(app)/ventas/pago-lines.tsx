"use client";

import { useState } from "react";
import { X } from "lucide-react";
import { formatCOP } from "@/lib/format";
import { METODO_PAGO_LABEL, type MetodoPago, type VentaPagoInput } from "@/lib/supabase/types";

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
}: {
  /** Monto que se espera cubrir (total de la orden, o saldo pendiente en un abono). */
  total: number;
  /** Si true, muestra el campo de PIN cuando el pago cae por debajo del 50%. */
  allowPin?: boolean;
}) {
  const [pagos, setPagos] = useState<VentaPagoInput[]>([
    { monto: total, metodo_pago: "efectivo" },
  ]);
  const [pin, setPin] = useState("");

  const pagado = pagos.reduce((acc, p) => acc + (Number(p.monto) || 0), 0);
  const saldo = total - pagado;
  const requierePin = allowPin && pagado > 0 && pagado < total * 0.5;

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

  function quitar(i: number) {
    setPagos((prev) => prev.filter((_, idx) => idx !== i));
  }

  return (
    <section className="flex flex-col gap-2 rounded-lg border border-slate-200 p-3">
      <input type="hidden" name="pagos" value={JSON.stringify(pagos)} />
      {allowPin ? <input type="hidden" name="pin" value={pin} /> : null}

      <span className="text-xs font-semibold tracking-wide text-slate-500 uppercase">Pago</span>

      {pagos.map((p, i) => (
        <div key={i} className="grid grid-cols-[1fr_140px_auto] items-center gap-2">
          <select
            value={p.metodo_pago}
            onChange={(e) => actualizar(i, "metodo_pago", e.target.value)}
            className={inputClass}
          >
            {Object.entries(METODO_PAGO_LABEL).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
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
          {pagos.length > 1 ? (
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
      ))}

      <button
        type="button"
        onClick={agregar}
        className="self-start text-xs font-medium text-indigo-700 hover:underline"
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
