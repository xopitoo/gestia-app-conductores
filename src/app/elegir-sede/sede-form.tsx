"use client";

import { useActionState } from "react";
import { elegirSede } from "./actions";
import type { SedeRow } from "@/lib/supabase/types";

export function SedeForm({ sedes }: { sedes: SedeRow[] }) {
  const [state, formAction, pending] = useActionState(elegirSede, {});

  return (
    <form action={formAction} className="flex flex-col gap-4">
      <div className="flex flex-col gap-2">
        {sedes.map((s) => (
          <label
            key={s.id}
            className="flex cursor-pointer items-center gap-3 rounded-lg border border-slate-300 px-4 py-3 text-sm transition has-checked:border-indigo-600 has-checked:bg-indigo-50"
          >
            <input type="radio" name="sede_id" value={s.id} required className="h-4 w-4 accent-indigo-600" />
            <div>
              <p className="font-medium text-slate-800">{s.name}</p>
              {s.address ? <p className="text-xs text-slate-400">{s.address}</p> : null}
            </div>
          </label>
        ))}
      </div>

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
        {pending ? "Guardando..." : "Confirmar sede"}
      </button>
    </form>
  );
}
