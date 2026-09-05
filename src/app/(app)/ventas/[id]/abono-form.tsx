"use client";

import { useActionState } from "react";
import { registrarAbono } from "./actions";
import { PagoLines } from "../pago-lines";

export function AbonoForm({ ventaId, saldo }: { ventaId: string; saldo: number }) {
  const [state, formAction, pending] = useActionState(registrarAbono, {});

  return (
    <form action={formAction} className="flex flex-col gap-3">
      <input type="hidden" name="venta_id" value={ventaId} />
      <PagoLines total={saldo} />

      {state.error ? (
        <p role="alert" className="rounded-lg bg-red-50 px-3.5 py-2.5 text-sm text-red-700">
          {state.error}
        </p>
      ) : null}

      <button
        type="submit"
        disabled={pending}
        className="rounded-lg bg-indigo-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm shadow-indigo-600/20 transition hover:bg-indigo-700 disabled:cursor-not-allowed disabled:opacity-60"
      >
        {pending ? "Registrando..." : "Registrar abono"}
      </button>
    </form>
  );
}
