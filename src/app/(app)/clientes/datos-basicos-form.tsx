"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import { CheckCircle2, XCircle } from "lucide-react";
import { actualizarDatosCliente, type ClienteFormState } from "./actions";
import type { ClienteRow } from "@/lib/supabase/types";
import { buttonClass } from "@/lib/ui";

const inputClass =
  "w-full rounded-lg border border-slate-300 px-3.5 py-2.5 text-sm text-slate-900 outline-none transition focus:border-indigo-600 focus:ring-1 focus:ring-indigo-600";

/**
 * "Actualización de datos" para recepcionista: solo lo que
 * clientes_update_recepcionista/clientes_lock_privileged_columns dejan
 * tocar — documento, nombre, sexo, sede, etc. siguen siendo de solo lectura
 * acá (ver ClienteDetailPage).
 */
export function DatosBasicosForm({ cliente }: { cliente: ClienteRow }) {
  const [state, formAction, pending] = useActionState<ClienteFormState, FormData>(actualizarDatosCliente, {});
  const [runt, setRunt] = useState(cliente.runt);
  const [guardado, setGuardado] = useState(false);
  const eraPending = useRef(false);

  useEffect(() => {
    if (eraPending.current && !pending && !state.error) {
      setGuardado(true);
      const t = setTimeout(() => setGuardado(false), 3000);
      return () => clearTimeout(t);
    }
    eraPending.current = pending;
  }, [pending, state]);

  return (
    <form action={formAction} className="flex flex-col gap-5">
      <input type="hidden" name="id" value={cliente.id} />

      <section className="flex flex-col gap-3">
        <h3 className="text-xs font-semibold tracking-wide text-slate-500 uppercase">Registro en RUNT</h3>
        <input type="hidden" name="runt" value={String(runt)} />
        <div className="flex flex-col gap-2 sm:flex-row">
          <button
            type="button"
            onClick={() => setRunt(true)}
            aria-pressed={runt}
            className={`flex flex-1 items-center justify-center gap-2 rounded-lg border-2 px-4 py-3 text-sm font-semibold transition ${
              runt
                ? "border-emerald-500 bg-emerald-50 text-emerald-700"
                : "border-slate-200 text-slate-400 hover:border-slate-300 hover:text-slate-600"
            }`}
          >
            <CheckCircle2 className="h-4 w-4" aria-hidden="true" />
            Inscrito en RUNT
          </button>
          <button
            type="button"
            onClick={() => setRunt(false)}
            aria-pressed={!runt}
            className={`flex flex-1 items-center justify-center gap-2 rounded-lg border-2 px-4 py-3 text-sm font-semibold transition ${
              !runt
                ? "border-red-500 bg-red-50 text-red-700"
                : "border-slate-200 text-slate-400 hover:border-slate-300 hover:text-slate-600"
            }`}
          >
            <XCircle className="h-4 w-4" aria-hidden="true" />
            No tiene RUNT
          </button>
        </div>
      </section>

      <section className="flex flex-col gap-3">
        <h3 className="text-xs font-semibold tracking-wide text-slate-500 uppercase">Datos de contacto</h3>
        <Field label="Fecha de nacimiento">
          <input
            name="fecha_nacimiento"
            type="date"
            min="1900-01-01"
            max={new Date().toISOString().slice(0, 10)}
            defaultValue={cliente.fecha_nacimiento ?? ""}
            className={inputClass}
          />
        </Field>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-[100px_1fr]">
          <Field label="País">
            <input name="telefono_pais" defaultValue={cliente.telefono_pais ?? "+57"} className={inputClass} />
          </Field>
          <Field label="Teléfono de contacto" required>
            <input
              name="telefono"
              type="tel"
              inputMode="numeric"
              required
              maxLength={10}
              pattern="[0-9]{10}"
              title="10 dígitos, sin espacios ni guiones"
              defaultValue={cliente.telefono ?? ""}
              onChange={(e) => {
                e.target.value = e.target.value.replace(/\D/g, "").slice(0, 10);
              }}
              placeholder="Ej. 3001234567"
              className={inputClass}
            />
          </Field>
        </div>
        <Field label="Correo electrónico">
          <input
            name="correo_electronico"
            type="email"
            defaultValue={cliente.correo_electronico ?? ""}
            placeholder="correo@ejemplo.com"
            className={inputClass}
          />
        </Field>
      </section>

      {state.error ? (
        <p role="alert" className="rounded-lg bg-red-50 px-3.5 py-2.5 text-sm text-red-700">
          {state.error}
        </p>
      ) : null}
      {guardado ? (
        <p className="rounded-lg bg-emerald-50 px-3.5 py-2.5 text-sm text-emerald-700">Datos actualizados.</p>
      ) : null}

      <div className="flex items-center justify-end gap-3 border-t border-slate-200 pt-4">
        <button type="submit" disabled={pending} className={buttonClass("primary")}>
          {pending ? "Guardando..." : "Guardar datos"}
        </button>
      </div>
    </form>
  );
}

function Field({ label, required, children }: { label: string; required?: boolean; children: React.ReactNode }) {
  return (
    <label className="flex flex-col gap-1.5">
      <span className="text-sm font-medium text-slate-700">
        {label}
        {required ? <span className="ml-0.5 text-red-500">*</span> : null}
      </span>
      {children}
    </label>
  );
}
