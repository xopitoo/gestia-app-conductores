"use client";

import { useActionState } from "react";
import { abrirCaja, cerrarCaja, registrarEgreso, type CajaActionState } from "./actions";
import { METODO_PAGO_LABEL, METODO_PAGO_SELECCIONABLE } from "@/lib/supabase/types";

const inputClass =
  "w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900 outline-none transition focus:border-indigo-600 focus:ring-1 focus:ring-indigo-600";

function ErrorText({ state }: { state: CajaActionState }) {
  if (!state.error) return null;
  return <p className="text-xs text-red-600">{state.error}</p>;
}

export function AbrirCajaForm({ sedeId }: { sedeId: string }) {
  const [state, formAction, pending] = useActionState(abrirCaja, {});

  return (
    <form action={formAction} className="flex flex-col gap-3">
      <input type="hidden" name="sede_id" value={sedeId} />
      <label className="flex flex-col gap-1 text-sm">
        <span className="font-medium text-slate-700">Base inicial (opcional)</span>
        <input
          name="opening_balance"
          type="number"
          min={0}
          step="1"
          defaultValue={0}
          className={inputClass}
        />
      </label>
      <ErrorText state={state} />
      <button
        type="submit"
        disabled={pending}
        className="rounded-lg bg-emerald-600 px-4 py-2 text-sm font-semibold text-white shadow-sm shadow-emerald-600/20 transition hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-60"
      >
        {pending ? "Abriendo..." : "Abrir caja"}
      </button>
    </form>
  );
}

export function CerrarCajaForm({ sesionId }: { sesionId: string }) {
  const [state, formAction, pending] = useActionState(cerrarCaja, {});

  return (
    <form action={formAction} className="flex flex-col gap-3">
      <input type="hidden" name="sesion_id" value={sesionId} />
      <label className="flex flex-col gap-1 text-sm">
        <span className="font-medium text-slate-700">Saldo de cierre contado</span>
        <input
          name="closing_balance"
          type="number"
          min={0}
          step="1"
          required
          className={inputClass}
        />
      </label>
      <ErrorText state={state} />
      <button
        type="submit"
        disabled={pending}
        className="rounded-lg border border-red-200 bg-red-50 px-4 py-2 text-sm font-semibold text-red-700 transition hover:bg-red-100 disabled:cursor-not-allowed disabled:opacity-60"
      >
        {pending ? "Cerrando..." : "Cerrar caja"}
      </button>
    </form>
  );
}

export function RegistrarEgresoForm({
  sesionId,
  sedeId,
}: {
  sesionId: string;
  sedeId: string;
}) {
  const [state, formAction, pending] = useActionState(registrarEgreso, {});

  return (
    <form action={formAction} className="grid grid-cols-1 gap-2 sm:grid-cols-4">
      <input type="hidden" name="sesion_id" value={sesionId} />
      <input type="hidden" name="sede_id" value={sedeId} />
      <input name="concepto" required placeholder="Concepto del egreso" className={inputClass} />
      <input
        name="monto"
        type="number"
        min={1}
        step="1"
        required
        placeholder="Monto"
        className={inputClass}
      />
      <select name="metodo_pago" defaultValue="efectivo" className={inputClass}>
        {METODO_PAGO_SELECCIONABLE.map((value) => (
          <option key={value} value={value}>
            {METODO_PAGO_LABEL[value]}
          </option>
        ))}
      </select>
      <button
        type="submit"
        disabled={pending}
        className="rounded-lg bg-slate-800 px-4 py-2 text-sm font-semibold text-white transition hover:bg-slate-900 disabled:cursor-not-allowed disabled:opacity-60"
      >
        {pending ? "Registrando..." : "Registrar egreso"}
      </button>
      {state.error ? (
        <p className="col-span-full text-xs text-red-600">{state.error}</p>
      ) : null}
    </form>
  );
}
