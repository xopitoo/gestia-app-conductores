"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import { Pencil, Trash2 } from "lucide-react";
import { editarTramitador, eliminarTramitador, toggleTramitadorActive } from "./actions";
import { ConfirmSubmitButton } from "@/components/confirm-submit-button";
import { formatCOP } from "@/lib/format";
import { badgeClass, buttonClass, linkClass } from "@/lib/ui";

const inputClass =
  "w-full rounded-lg border border-slate-300 px-2.5 py-1.5 text-sm text-slate-900 outline-none focus:border-indigo-600 focus:ring-1 focus:ring-indigo-600";

export type TramitadorHeaderData = {
  id: string;
  nombre: string;
  sedeId: string | null;
  precioEspecial: number;
  active: boolean;
};

/**
 * Encabezado de la tarjeta de un tramitador (nombre, sede, precio especial,
 * saldo, y las acciones de admin: editar, activar/desactivar, eliminar) —
 * el resto de la tarjeta (abonos, comisión, precios por producto, extracto)
 * sigue viviendo en page.tsx tal cual. Solo llega acá si isAdmin=true en
 * lo que respecta a los botones de acción (page.tsx no la usa para
 * recepcionista).
 */
export function TramitadorHeader({
  tramitador,
  sedes,
  isAdmin,
  sedeNombre,
  personas,
  saldoAFavor,
  pagadoClientes,
  reclamo,
  pagadoTramitador,
}: {
  tramitador: TramitadorHeaderData;
  sedes: { id: string; name: string }[];
  isAdmin: boolean;
  sedeNombre: string;
  personas: number;
  saldoAFavor: number;
  pagadoClientes: number;
  reclamo: number;
  pagadoTramitador: number;
}) {
  const [editando, setEditando] = useState(false);
  const [eliminando, setEliminando] = useState(false);

  if (editando) {
    return (
      <form
        action={editarTramitador}
        onSubmit={() => setEditando(false)}
        className="grid w-full grid-cols-1 gap-2 sm:grid-cols-4"
      >
        <input type="hidden" name="id" value={tramitador.id} />
        <input name="nombre" defaultValue={tramitador.nombre} required className={inputClass} placeholder="Nombre" />
        <select name="sede_id" defaultValue={tramitador.sedeId ?? ""} className={`bg-white ${inputClass}`}>
          <option value="">Todas las sedes</option>
          {sedes.map((s) => (
            <option key={s.id} value={s.id}>
              Solo {s.name}
            </option>
          ))}
        </select>
        <input
          name="precio_especial"
          type="number"
          min={0}
          step="1"
          defaultValue={tramitador.precioEspecial}
          required
          className={inputClass}
          placeholder="Precio especial"
        />
        <div className="flex items-center gap-2">
          <button type="submit" className={buttonClass("primary", "sm")}>
            Guardar
          </button>
          <button type="button" onClick={() => setEditando(false)} className={linkClass("neutral")}>
            Cancelar
          </button>
        </div>
      </form>
    );
  }

  return (
    <>
      <div className="min-w-0">
        <div className="flex items-center gap-2">
          <h3 className="font-semibold text-slate-900">{tramitador.nombre}</h3>
          <span className={badgeClass(tramitador.active ? "success" : "neutral")}>
            {tramitador.active ? "Activo" : "Inactivo"}
          </span>
        </div>
        <p className="text-xs text-slate-500">
          {sedeNombre} · Precio especial {formatCOP(tramitador.precioEspecial)} · {personas}{" "}
          {personas === 1 ? "persona" : "personas"}
        </p>
        <p className="mt-1 text-xs text-slate-500">
          Pagado por sus clientes {formatCOP(pagadoClientes)} · Le corresponde a la organización{" "}
          {formatCOP(reclamo)} · Ya se le pagó {formatCOP(pagadoTramitador)}
        </p>
      </div>
      <div className="flex shrink-0 flex-col items-end gap-1.5">
        <div className="flex items-center gap-3">
          <span
            className={`text-lg font-semibold ${
              saldoAFavor > 0 ? "text-amber-600" : saldoAFavor < 0 ? "text-red-600" : "text-emerald-600"
            }`}
          >
            {formatCOP(saldoAFavor)}
          </span>
        </div>
        {isAdmin ? (
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => setEditando(true)}
              className={`flex items-center gap-1 ${linkClass("primary")}`}
            >
              <Pencil className="h-3 w-3" />
              Editar
            </button>
            <form action={toggleTramitadorActive}>
              <input type="hidden" name="id" value={tramitador.id} />
              <input type="hidden" name="active" value={String(tramitador.active)} />
              <ConfirmSubmitButton
                confirmMessage={
                  tramitador.active ? `¿Desactivar ${tramitador.nombre}?` : `¿Reactivar ${tramitador.nombre}?`
                }
                className={linkClass(tramitador.active ? "destructive" : "success")}
              >
                {tramitador.active ? "Desactivar" : "Activar"}
              </ConfirmSubmitButton>
            </form>
            <button
              type="button"
              onClick={() => setEliminando(true)}
              className={`flex items-center gap-1 ${linkClass("destructive")}`}
            >
              <Trash2 className="h-3 w-3" />
              Eliminar
            </button>
          </div>
        ) : null}
        {eliminando ? (
          <EliminarTramitadorForm
            tramitadorId={tramitador.id}
            nombre={tramitador.nombre}
            onCancel={() => setEliminando(false)}
          />
        ) : null}
      </div>
    </>
  );
}

function EliminarTramitadorForm({
  tramitadorId,
  nombre,
  onCancel,
}: {
  tramitadorId: string;
  nombre: string;
  onCancel: () => void;
}) {
  const [state, formAction, pending] = useActionState(eliminarTramitador, {});
  const eraPending = useRef(false);

  useEffect(() => {
    if (eraPending.current && !pending && !state.error) {
      onCancel();
    }
    eraPending.current = pending;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pending, state]);

  return (
    <form action={formAction} className="flex w-64 flex-col gap-1.5 rounded-lg border border-red-200 bg-red-50 p-3">
      <p className="text-xs text-red-800">
        Vas a eliminar a <span className="font-semibold">{nombre}</span> para siempre. Escribí el PIN de
        autorización para confirmar.
      </p>
      <input type="hidden" name="id" value={tramitadorId} />
      <input
        type="password"
        inputMode="numeric"
        name="pin"
        required
        placeholder="PIN"
        className="w-full rounded-lg border border-red-300 bg-white px-2.5 py-1.5 text-sm text-slate-900 outline-none focus:border-red-500 focus:ring-1 focus:ring-red-500"
      />
      <div className="flex items-center gap-2">
        <button type="submit" disabled={pending} className={buttonClass("destructive", "sm")}>
          {pending ? "Eliminando..." : "Confirmar"}
        </button>
        <button type="button" onClick={onCancel} className={linkClass("neutral")}>
          Cancelar
        </button>
      </div>
      {state.error ? <p className="text-xs text-red-700">{state.error}</p> : null}
    </form>
  );
}
