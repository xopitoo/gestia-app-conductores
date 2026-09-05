"use client";

import { useActionState } from "react";
import { actualizarPin } from "./actions";

const inputClass =
  "w-full rounded-lg border border-slate-300 px-3.5 py-2.5 text-sm text-slate-900 outline-none transition focus:border-indigo-600 focus:ring-1 focus:ring-indigo-600";

export function PinForm() {
  const [state, formAction, pending] = useActionState(actualizarPin, {});

  return (
    <form action={formAction} className="flex max-w-sm flex-col gap-4">
      <label className="flex flex-col gap-1.5">
        <span className="text-sm font-medium text-slate-700">PIN nuevo</span>
        <input
          name="pin"
          type="password"
          inputMode="numeric"
          minLength={4}
          required
          placeholder="Mínimo 4 dígitos"
          className={inputClass}
        />
      </label>
      <label className="flex flex-col gap-1.5">
        <span className="text-sm font-medium text-slate-700">Confirmar PIN</span>
        <input
          name="pin_confirmacion"
          type="password"
          inputMode="numeric"
          minLength={4}
          required
          className={inputClass}
        />
      </label>

      {state.error ? (
        <p role="alert" className="rounded-lg bg-red-50 px-3.5 py-2.5 text-sm text-red-700">
          {state.error}
        </p>
      ) : null}
      {state.success ? (
        <p className="rounded-lg bg-emerald-50 px-3.5 py-2.5 text-sm text-emerald-700">
          PIN actualizado.
        </p>
      ) : null}

      <button
        type="submit"
        disabled={pending}
        className="rounded-lg bg-indigo-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm shadow-indigo-600/20 transition hover:bg-indigo-700 disabled:cursor-not-allowed disabled:opacity-60"
      >
        {pending ? "Guardando..." : "Guardar PIN"}
      </button>
    </form>
  );
}
