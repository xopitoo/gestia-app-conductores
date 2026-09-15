"use client";

import { useActionState } from "react";
import { registrarAbono } from "./actions";
import { PagoLines } from "../pago-lines";
import { buttonClass } from "@/lib/ui";

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
        className={buttonClass("primary")}
      >
        {pending ? "Registrando..." : "Registrar abono"}
      </button>
    </form>
  );
}
