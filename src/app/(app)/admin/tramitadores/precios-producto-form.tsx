"use client";

import { useState } from "react";
import { X } from "lucide-react";
import { formatCOP } from "@/lib/format";
import { guardarPrecioProducto, eliminarPrecioProducto } from "./actions";

export type PrecioProducto = {
  id: string;
  productoId: string;
  productoNombre: string;
  precioEspecial: number;
};

/**
 * Precios especiales por producto de un tramitador (ej. distinto para
 * "Examen 1 categoría" que para "Examen 2 categorías") — ver comentario en
 * la tabla tramitador_precios. Los productos ya con precio fijado no
 * vuelven a aparecer en el selector, para no crear duplicados sin querer
 * (el índice único los rechazaría igual, pero así queda más claro).
 */
export function PreciosProductoForm({
  tramitadorId,
  productosDisponibles,
  precios,
}: {
  tramitadorId: string;
  productosDisponibles: { id: string; nombre: string }[];
  precios: PrecioProducto[];
}) {
  const [abierto, setAbierto] = useState(false);
  const productoIdsConPrecio = new Set(precios.map((p) => p.productoId));
  const opciones = productosDisponibles.filter((p) => !productoIdsConPrecio.has(p.id));

  return (
    <div className="flex flex-col gap-1.5">
      {precios.length > 0 ? (
        <ul className="flex flex-wrap gap-1.5">
          {precios.map((p) => (
            <li
              key={p.id}
              className="flex items-center gap-1.5 rounded-full border border-slate-200 bg-slate-50 py-0.5 pr-1 pl-2.5 text-[11px]"
            >
              <span className="text-slate-600">{p.productoNombre}</span>
              <span className="font-medium text-slate-900">{formatCOP(p.precioEspecial)}</span>
              <form action={eliminarPrecioProducto}>
                <input type="hidden" name="id" value={p.id} />
                <button
                  type="submit"
                  className="flex h-4 w-4 items-center justify-center rounded-full text-slate-400 hover:bg-slate-200 hover:text-slate-700"
                  title="Quitar este precio"
                >
                  <X className="h-3 w-3" />
                </button>
              </form>
            </li>
          ))}
        </ul>
      ) : null}

      {abierto ? (
        <form
          action={async (formData) => {
            await guardarPrecioProducto(formData);
            setAbierto(false);
          }}
          className="flex flex-wrap items-center gap-1.5"
        >
          <input type="hidden" name="tramitador_id" value={tramitadorId} />
          <select
            name="producto_id"
            required
            defaultValue=""
            className="rounded-md border border-slate-300 bg-white px-2 py-1 text-xs text-slate-700 outline-none focus:border-indigo-600"
          >
            <option value="" disabled>
              Producto...
            </option>
            {opciones.map((p) => (
              <option key={p.id} value={p.id}>
                {p.nombre}
              </option>
            ))}
          </select>
          <input
            name="precio_especial"
            type="number"
            min={0}
            step="1"
            required
            placeholder="Precio especial"
            className="w-32 rounded-md border border-slate-300 px-2 py-1 text-xs text-slate-900 outline-none focus:border-indigo-600"
          />
          <button
            type="submit"
            className="rounded-md bg-indigo-600 px-2 py-1 text-xs font-medium text-white hover:bg-indigo-700"
          >
            Guardar
          </button>
          <button
            type="button"
            onClick={() => setAbierto(false)}
            className="text-xs font-medium text-slate-400 hover:text-slate-600"
          >
            Cancelar
          </button>
        </form>
      ) : opciones.length > 0 ? (
        <button
          type="button"
          onClick={() => setAbierto(true)}
          className="self-start text-xs font-medium text-indigo-700 hover:underline"
        >
          + Precio por producto
        </button>
      ) : null}
    </div>
  );
}
