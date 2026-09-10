"use client";

import { useActionState, useState } from "react";
import { HandCoins } from "lucide-react";
import { cruzarSaldoTramitador } from "./actions";
import { formatCOP } from "@/lib/format";

/**
 * Ofrece saldar el pendiente de esta venta contra el saldo a favor que ya
 * tiene acumulado el tramitador (ej. trajo gente y paga después, y para
 * entonces ya le sobró plata de otras ventas suyas) — no entra efectivo a
 * la caja, solo se descuenta de ese saldo. Admin-only, así que si no hay
 * saldo a favor no tiene sentido mostrar nada.
 */
export function CruceTramitadorForm({
  ventaId,
  tramitadorNombre,
  saldoPendienteVenta,
  saldoTramitador,
}: {
  ventaId: string;
  tramitadorNombre: string;
  saldoPendienteVenta: number;
  saldoTramitador: number;
}) {
  const [state, formAction, pending] = useActionState(cruzarSaldoTramitador, {});
  const sugerido = Math.max(0, Math.min(saldoPendienteVenta, saldoTramitador));
  const [monto, setMonto] = useState(sugerido);

  if (saldoTramitador <= 0) return null;

  return (
    <form
      action={formAction}
      className="flex flex-col gap-2.5 rounded-xl border border-amber-300 bg-amber-50 px-3.5 py-3"
    >
      <input type="hidden" name="venta_id" value={ventaId} />
      <div className="flex items-start gap-2.5">
        <HandCoins className="mt-0.5 h-4 w-4 shrink-0 text-amber-600" aria-hidden="true" />
        <div className="flex flex-col gap-0.5">
          <span className="text-xs font-semibold text-amber-900">
            {tramitadorNombre} tiene {formatCOP(saldoTramitador)} a favor
          </span>
          <span className="text-xs text-amber-700">
            Se puede cruzar hasta {formatCOP(sugerido)} de esa plata contra el pendiente de esta venta, sin que
            entre efectivo a la caja.
          </span>
        </div>
      </div>
      <div className="flex items-center gap-2">
        <input
          name="monto"
          type="number"
          min={1}
          max={sugerido}
          step="1"
          value={monto || ""}
          onChange={(e) => setMonto(Number(e.target.value) || 0)}
          className="w-36 rounded-lg border border-amber-300 bg-white px-3 py-2 text-sm text-slate-900 outline-none focus:border-amber-500 focus:ring-1 focus:ring-amber-500"
        />
        <button
          type="submit"
          disabled={pending || !(monto > 0)}
          className="rounded-lg bg-amber-600 px-3.5 py-2 text-sm font-semibold text-white transition hover:bg-amber-700 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {pending ? "Cruzando..." : "Cruzar saldo"}
        </button>
      </div>
      {state.error ? (
        <p role="alert" className="text-xs text-red-700">
          {state.error}
        </p>
      ) : null}
    </form>
  );
}
