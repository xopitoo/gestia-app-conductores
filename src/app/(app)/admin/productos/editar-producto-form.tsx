"use client";

import { useState } from "react";
import { Pencil } from "lucide-react";
import { editarProducto, toggleProductoActive } from "./actions";
import { ConfirmSubmitButton } from "@/components/confirm-submit-button";
import { formatCOP } from "@/lib/format";
import { badgeClass, buttonClass, linkClass } from "@/lib/ui";
import type { Categoria } from "@/lib/supabase/types";

export type ProductoEditable = {
  id: string;
  nombre: string;
  descripcion: string | null;
  categoria: Categoria | null;
  precio: number;
  active: boolean;
};

const inputClass =
  "w-full rounded-lg border border-slate-300 px-2.5 py-1.5 text-sm text-slate-900 outline-none focus:border-indigo-600 focus:ring-1 focus:ring-indigo-600";

/**
 * Fila de la tabla de productos — en modo lectura, con un botón "Editar"
 * que la convierte en un formulario inline (nombre/descripción/categoría/
 * precio). Solo llega acá si el que mira la página ya es admin (la propia
 * /admin/productos redirige a cualquier otro rol) — pensado justo para
 * que solo el admin pueda corregir nombres/precios, nunca un
 * recepcionista.
 */
export function EditarProductoForm({ producto }: { producto: ProductoEditable }) {
  const [editando, setEditando] = useState(false);

  if (!editando) {
    return (
      <tr>
        <td className="px-4 py-2.5 font-medium text-slate-800">{producto.nombre}</td>
        <td className="px-4 py-2.5 text-slate-600">{producto.descripcion ?? "—"}</td>
        <td className="px-4 py-2.5 text-slate-600 capitalize">{producto.categoria ?? "—"}</td>
        <td className="px-4 py-2.5 text-slate-600">{formatCOP(producto.precio)}</td>
        <td className="px-4 py-2.5">
          <span className={badgeClass(producto.active ? "success" : "neutral")}>
            {producto.active ? "Activo" : "Inactivo"}
          </span>
        </td>
        <td className="px-4 py-2.5 text-right">
          <div className="flex items-center justify-end gap-3">
            <button
              type="button"
              onClick={() => setEditando(true)}
              className={`flex items-center gap-1 ${linkClass("primary")}`}
            >
              <Pencil className="h-3 w-3" />
              Editar
            </button>
            <form action={toggleProductoActive}>
              <input type="hidden" name="id" value={producto.id} />
              <input type="hidden" name="active" value={String(producto.active)} />
              <ConfirmSubmitButton
                confirmMessage={producto.active ? `¿Desactivar ${producto.nombre}?` : `¿Reactivar ${producto.nombre}?`}
                className={linkClass(producto.active ? "destructive" : "success")}
              >
                {producto.active ? "Desactivar" : "Activar"}
              </ConfirmSubmitButton>
            </form>
          </div>
        </td>
      </tr>
    );
  }

  return (
    <tr className="bg-indigo-50/40">
      <td colSpan={6} className="px-4 py-3">
        <form
          action={editarProducto}
          onSubmit={() => setEditando(false)}
          className="grid grid-cols-1 gap-2 sm:grid-cols-5"
        >
          <input type="hidden" name="id" value={producto.id} />
          <input name="nombre" defaultValue={producto.nombre} required className={inputClass} placeholder="Nombre" />
          <input
            name="descripcion"
            defaultValue={producto.descripcion ?? ""}
            className={inputClass}
            placeholder="Descripción (opcional)"
          />
          <select name="categoria" defaultValue={producto.categoria ?? ""} className={`bg-white ${inputClass}`}>
            <option value="">Sin categoría</option>
            <option value="individual">Individual</option>
            <option value="multiple">Múltiple</option>
          </select>
          <input
            name="precio"
            type="number"
            min={0}
            step="1"
            defaultValue={producto.precio}
            required
            className={inputClass}
            placeholder="Precio"
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
      </td>
    </tr>
  );
}
