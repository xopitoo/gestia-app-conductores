"use client";

import { useActionState, useState } from "react";
import { CheckCircle2, XCircle } from "lucide-react";
import type { ClienteFormState } from "./actions";
import type { ClienteRow, SedeRow } from "@/lib/supabase/types";
import { RuntConsultaLink } from "@/components/runt-link";

const TIPOS_DOCUMENTO = [
  { value: "CC", label: "Cédula de ciudadanía" },
  { value: "TI", label: "Tarjeta de identidad" },
  { value: "CE", label: "Cédula de extranjería" },
  { value: "PPT", label: "Permiso por Protección Temporal" },
  { value: "PASAPORTE", label: "Pasaporte" },
  { value: "NIT", label: "NIT" },
];

const inputClass =
  "w-full rounded-lg border border-slate-300 px-3.5 py-2.5 text-sm text-slate-900 outline-none transition focus:border-indigo-600 focus:ring-1 focus:ring-indigo-600";

export function ClienteForm({
  action,
  cliente,
  sedes,
  showSedeSelect,
  submitLabel,
}: {
  action: (state: ClienteFormState, formData: FormData) => Promise<ClienteFormState>;
  cliente?: ClienteRow;
  sedes: SedeRow[];
  showSedeSelect: boolean;
  submitLabel: string;
}) {
  const [state, formAction, pending] = useActionState(action, {});
  const [runt, setRunt] = useState(cliente?.runt ?? false);
  const [numeroDocumento, setNumeroDocumento] = useState(cliente?.numero_documento ?? "");
  // Tope del selector de fecha para que no se puedan tipear años absurdos
  // (ej. "32223") — el input type="date" del navegador no lo evita solo.
  const hoy = new Date().toISOString().slice(0, 10);

  return (
    <form action={formAction} className="flex flex-col gap-5">
      {cliente ? <input type="hidden" name="id" value={cliente.id} /> : null}

      <section className="flex flex-col gap-3">
        <h3 className="text-xs font-semibold tracking-wide text-slate-500 uppercase">
          Identificación
        </h3>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <Field label="Tipo de documento" required>
            <select
              name="tipo_documento"
              required
              defaultValue={cliente?.tipo_documento ?? ""}
              className={inputClass}
            >
              <option value="" disabled>
                Seleccionar...
              </option>
              {TIPOS_DOCUMENTO.map((t) => (
                <option key={t.value} value={t.value}>
                  {t.label}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Número de documento" required>
            <input
              name="numero_documento"
              required
              defaultValue={cliente?.numero_documento}
              onChange={(e) => setNumeroDocumento(e.target.value)}
              placeholder="Ej. 12345678"
              className={inputClass}
            />
          </Field>
        </div>
        {showSedeSelect ? (
          <Field label="Sede" required>
            <select
              name="sede_id"
              required
              defaultValue={cliente?.sede_id ?? ""}
              className={inputClass}
            >
              <option value="" disabled>
                Seleccionar...
              </option>
              {sedes.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </select>
          </Field>
        ) : null}
      </section>

      <section className="flex flex-col gap-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h3 className="text-xs font-semibold tracking-wide text-slate-500 uppercase">
            Registro en RUNT
          </h3>
          <RuntConsultaLink documento={numeroDocumento || undefined} compact />
        </div>
        <p className="-mt-1 text-xs text-slate-400">
          Consultá el documento en el portal antes de marcar el estado de inscripción.
        </p>
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
        <h3 className="text-xs font-semibold tracking-wide text-slate-500 uppercase">
          Información personal
        </h3>
        <Field label="Nombre completo" required>
          <input
            name="nombre_completo"
            required
            defaultValue={cliente?.nombre_completo}
            placeholder="Nombre y apellidos"
            className={inputClass}
          />
        </Field>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <Field label="Sexo">
            <select
              name="sexo"
              defaultValue={cliente?.sexo ?? ""}
              className={inputClass}
            >
              <option value="">Seleccionar...</option>
              <option value="M">Masculino</option>
              <option value="F">Femenino</option>
              <option value="OTRO">Otro</option>
            </select>
          </Field>
          <Field label="Fecha de nacimiento">
            <input
              name="fecha_nacimiento"
              type="date"
              min="1900-01-01"
              max={hoy}
              defaultValue={cliente?.fecha_nacimiento ?? ""}
              className={inputClass}
            />
          </Field>
        </div>
      </section>

      <section className="flex flex-col gap-3">
        <h3 className="text-xs font-semibold tracking-wide text-slate-500 uppercase">
          Contacto
        </h3>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-[100px_1fr]">
          <Field label="País">
            <input
              name="telefono_pais"
              defaultValue={cliente?.telefono_pais ?? "+57"}
              className={inputClass}
            />
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
              defaultValue={cliente?.telefono ?? ""}
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
            defaultValue={cliente?.correo_electronico ?? ""}
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

      <div className="flex items-center justify-end gap-3 border-t border-slate-200 pt-4">
        <button
          type="submit"
          disabled={pending}
          className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white shadow-sm shadow-indigo-600/20 transition hover:bg-indigo-700 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {pending ? "Guardando..." : submitLabel}
        </button>
      </div>
    </form>
  );
}

function Field({
  label,
  required,
  children,
}: {
  label: string;
  required?: boolean;
  children: React.ReactNode;
}) {
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
