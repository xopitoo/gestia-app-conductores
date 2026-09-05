"use client";

import { useActionState, useState } from "react";
import { aplicarDescuento } from "./actions";
import { DescuentoPicker } from "@/components/descuento-picker";
import { formatCOP } from "@/lib/format";
import type { DescuentoTipo } from "@/lib/supabase/types";

export function DescuentoForm({
  ventaId,
  montoBruto,
  pagado,
  descuentoActual,
}: {
  ventaId: string;
  montoBruto: number;
  pagado: number;
  descuentoActual: number;
}) {
  const [state, formAction, pending] = useActionState(aplicarDescuento, {});
  const [tipo, setTipo] = useState<DescuentoTipo | "">(descuentoActual > 0 ? "fijo" : "");
  const [valor, setValor] = useState(descuentoActual > 0 ? descuentoActual : 0);

  const descuentoMonto =
    tipo === "porcentaje"
      ? Math.round((montoBruto * valor) / 100)
      : tipo === "fijo"
        ? Math.min(valor, montoBruto)
        : 0;
  const maxDescuento = montoBruto - pagado;
  const excede = descuentoMonto > maxDescuento;
  const nuevoSaldo = montoBruto - descuentoMonto - pagado;

  return (
    <form action={formAction} className="flex w-72 flex-col gap-2 rounded-lg border border-slate-200 p-3">
      <input type="hidden" name="venta_id" value={ventaId} />
      <input type="hidden" name="descuento_tipo" value={tipo} />
      <input type="hidden" name="descuento_valor" value={valor} />

      <DescuentoPicker tipo={tipo} valor={valor} onTipoChange={setTipo} onValorChange={setValor} />

      <div className="flex items-center justify-between text-xs text-slate-600">
        <span>Nuevo saldo pendiente</span>
        <span className={`font-semibold ${nuevoSaldo <= 0 ? "text-emerald-600" : "text-amber-700"}`}>
          {formatCOP(Math.max(0, nuevoSaldo))}
        </span>
      </div>

      {excede ? (
        <p className="text-xs text-red-600">
          El descuento no puede superar {formatCOP(maxDescuento)} — ya se pagaron {formatCOP(pagado)}.
        </p>
      ) : null}
      {state.error ? <p className="text-xs text-red-600">{state.error}</p> : null}

      <button
        type="submit"
        disabled={pending || excede}
        className="rounded-lg bg-indigo-600 px-3 py-1.5 text-xs font-semibold text-white transition hover:bg-indigo-700 disabled:cursor-not-allowed disabled:opacity-60"
      >
        {pending ? "Guardando..." : "Aplicar descuento"}
      </button>
    </form>
  );
}
