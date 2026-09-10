"use client";

import { cambiarSedeUsuario } from "./actions";
import type { SedeRow } from "@/lib/supabase/types";

export function CambiarSedeSelect({
  usuarioId,
  sedeActual,
  sedes,
}: {
  usuarioId: string;
  sedeActual: string | null;
  sedes: SedeRow[];
}) {
  return (
    <form action={cambiarSedeUsuario}>
      <input type="hidden" name="id" value={usuarioId} />
      <select
        name="sede_id"
        defaultValue={sedeActual ?? ""}
        onChange={(e) => e.currentTarget.form?.requestSubmit()}
        className="rounded-md border border-slate-300 bg-white px-2 py-1 text-xs text-slate-700 outline-none focus:border-indigo-600"
      >
        <option value="">Sin asignar</option>
        {sedes.map((s) => (
          <option key={s.id} value={s.id}>
            {s.name}
          </option>
        ))}
      </select>
    </form>
  );
}
