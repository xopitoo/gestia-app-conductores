"use client";

import { useActionState } from "react";
import { provisionOrganization } from "./actions";

const inputClass =
  "w-full rounded-lg border border-slate-300 px-3.5 py-2.5 text-sm text-slate-900 outline-none transition focus:border-indigo-600 focus:ring-1 focus:ring-indigo-600";

export function ProvisionForm() {
  const [state, formAction, pending] = useActionState(provisionOrganization, {});

  return (
    <form action={formAction} className="flex flex-col gap-5">
      <section className="flex flex-col gap-3">
        <h3 className="text-xs font-semibold tracking-wide text-slate-500 uppercase">
          Organización
        </h3>
        <Field label="Nombre">
          <input name="org_name" required placeholder="Ej. Escuela de Conducción El Volante" className={inputClass} />
        </Field>
        <Field label="Slug">
          <input name="org_slug" required placeholder="ej-el-volante" pattern="[a-z0-9-]+" className={inputClass} />
        </Field>
      </section>

      <section className="flex flex-col gap-3">
        <h3 className="text-xs font-semibold tracking-wide text-slate-500 uppercase">
          Primera sede
        </h3>
        <Field label="Nombre de la sede">
          <input name="sede_name" required placeholder="Ej. Sede Principal" className={inputClass} />
        </Field>
      </section>

      <section className="flex flex-col gap-3">
        <h3 className="text-xs font-semibold tracking-wide text-slate-500 uppercase">
          Cuenta admin
        </h3>
        <Field label="Nombre completo">
          <input name="admin_full_name" required className={inputClass} />
        </Field>
        <Field label="Email">
          <input name="admin_email" type="email" required className={inputClass} />
        </Field>
        <Field label="Contraseña">
          <input name="admin_password" type="password" required minLength={8} className={inputClass} />
        </Field>
      </section>

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
        {pending ? "Creando..." : "Crear organización"}
      </button>
    </form>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="flex flex-col gap-1.5">
      <span className="text-sm font-medium text-slate-700">{label}</span>
      {children}
    </label>
  );
}
