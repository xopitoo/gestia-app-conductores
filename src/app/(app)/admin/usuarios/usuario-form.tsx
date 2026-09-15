"use client";

import { useActionState } from "react";
import { crearUsuarioRecepcionista } from "./actions";
import type { SedeRow } from "@/lib/supabase/types";
import { buttonClass } from "@/lib/ui";

const inputClass =
  "rounded-lg border border-slate-300 px-3.5 py-2 text-sm text-slate-900 outline-none focus:border-indigo-600 focus:ring-1 focus:ring-indigo-600";

export function UsuarioForm({ sedes }: { sedes: SedeRow[] }) {
  const [state, formAction, pending] = useActionState(crearUsuarioRecepcionista, {});

  return (
    <form action={formAction} className="mt-4 grid grid-cols-1 gap-2 sm:grid-cols-5">
      <input name="full_name" required placeholder="Nombre completo" className={inputClass} />
      <input name="email" type="email" required placeholder="Email" className={inputClass} />
      <input
        name="password"
        type="password"
        required
        minLength={8}
        placeholder="Contraseña (mín. 8)"
        className={inputClass}
      />
      <select name="sede_id" defaultValue="" className={`${inputClass} bg-white`}>
        <option value="">Sin asignar (la elige el usuario)</option>
        {sedes.map((s) => (
          <option key={s.id} value={s.id}>
            {s.name}
          </option>
        ))}
      </select>
      <button
        type="submit"
        disabled={pending}
        className={buttonClass("primary")}
      >
        {pending ? "Creando..." : "Crear usuario"}
      </button>
      {state.error ? (
        <p className="col-span-full text-xs text-red-600">{state.error}</p>
      ) : null}
    </form>
  );
}
