"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import { agregarItem } from "./actions";
import { formatCOP } from "@/lib/format";
import { buttonClass, linkClass } from "@/lib/ui";
import type { ProductoRow } from "@/lib/supabase/types";

const inputClass =
  "w-full rounded-lg border border-slate-300 px-2.5 py-1.5 text-xs text-slate-900 outline-none transition focus:border-indigo-600 focus:ring-1 focus:ring-indigo-600";

/**
 * Colapsado por defecto, mismo patrón que DescuentoForm — le anexa un
 * producto/servicio adicional a una venta ya existente (ej. al cliente le
 * faltaba otro trámite que no se vendió en el momento). Sube el saldo
 * pendiente en vez de bajarlo.
 */
export function AgregarItemForm({
  ventaId,
  productos,
}: {
  ventaId: string;
  productos: Pick<ProductoRow, "id" | "nombre" | "precio">[];
}) {
  const [state, formAction, pending] = useActionState(agregarItem, {});
  const [abierto, setAbierto] = useState(false);
  const [productoId, setProductoId] = useState("");
  const [nombre, setNombre] = useState("");
  const [precio, setPrecio] = useState<number | "">("");
  const eraPending = useRef(false);

  useEffect(() => {
    if (eraPending.current && !pending && !state.error) {
      setAbierto(false);
      setProductoId("");
      setNombre("");
      setPrecio("");
    }
    eraPending.current = pending;
  }, [pending, state]);

  if (!abierto) {
    return (
      <button type="button" onClick={() => setAbierto(true)} className={linkClass("neutral")}>
        + Anexar producto
      </button>
    );
  }

  function elegirProducto(id: string) {
    setProductoId(id);
    const p = productos.find((p) => p.id === id);
    if (p) {
      setNombre(p.nombre);
      setPrecio(p.precio);
    }
  }

  return (
    <form action={formAction} className="flex w-72 flex-col gap-2 rounded-lg border border-slate-200 p-3">
      <input type="hidden" name="venta_id" value={ventaId} />
      <input type="hidden" name="producto_id" value={productoId} />

      {productos.length > 0 ? (
        <select value={productoId} onChange={(e) => elegirProducto(e.target.value)} className={inputClass}>
          <option value="">Elegir del catálogo (opcional)...</option>
          {productos.map((p) => (
            <option key={p.id} value={p.id}>
              {p.nombre} — {formatCOP(p.precio)}
            </option>
          ))}
        </select>
      ) : null}

      <input
        name="nombre"
        value={nombre}
        onChange={(e) => setNombre(e.target.value)}
        placeholder="Nombre del producto/servicio"
        className={inputClass}
      />
      <input
        name="precio"
        type="number"
        min={1}
        value={precio}
        onChange={(e) => setPrecio(e.target.value === "" ? "" : Number(e.target.value))}
        placeholder="Precio"
        className={inputClass}
      />

      {state.error ? <p className="text-xs text-red-600">{state.error}</p> : null}

      <div className="flex items-center gap-3">
        <button
          type="submit"
          disabled={pending || !nombre.trim() || !(Number(precio) > 0)}
          className={buttonClass("primary", "sm")}
        >
          {pending ? "Guardando..." : "Anexar"}
        </button>
        <button type="button" onClick={() => setAbierto(false)} className={linkClass("neutral")}>
          Cancelar
        </button>
      </div>
    </form>
  );
}
