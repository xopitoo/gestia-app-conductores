"use client";

import { useActionState } from "react";
import { convertirCotizacion } from "./actions";
import { PagoLines } from "../../../ventas/pago-lines";
import { buttonClass } from "@/lib/ui";

export function ConvertirForm({ cotizacionId, total }: { cotizacionId: string; total: number }) {
  const [state, formAction, pending] = useActionState(convertirCotizacion, {});

  return (
    <form action={formAction} className="flex flex-col gap-4">
      <input type="hidden" name="cotizacion_id" value={cotizacionId} />
      <PagoLines total={total} allowPin />

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
        {pending ? "Registrando..." : "Confirmar venta"}
      </button>
    </form>
  );
}
