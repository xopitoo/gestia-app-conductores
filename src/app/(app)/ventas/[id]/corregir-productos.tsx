"use client";

import { useState, useTransition } from "react";
import { Pencil, Plus, X } from "lucide-react";
import { corregirProductosVenta } from "./actions";
import { formatCOP } from "@/lib/format";
import { buttonClass, linkClass } from "@/lib/ui";
import type { ProductoRow, VentaItemInput } from "@/lib/supabase/types";

const inputClass =
  "w-full rounded-lg border border-slate-300 px-2.5 py-1.5 text-sm text-slate-900 outline-none transition focus:border-indigo-600 focus:ring-1 focus:ring-indigo-600";

/**
 * Cambia los productos de una venta ya creada (ej. el cliente decide hacer
 * dos categorías en vez de una) sin tocar lo que ya abonó — los pagos y la
 * caja no se modifican, solo el total y el saldo pendiente. Solo admin.
 */
export function CorregirProductos({
  ventaId,
  itemsActuales,
  productos,
  pagado,
  descuento,
  incremento,
}: {
  ventaId: string;
  itemsActuales: VentaItemInput[];
  productos: Pick<ProductoRow, "id" | "nombre" | "precio">[];
  pagado: number;
  descuento: number;
  incremento: number;
}) {
  const [abierto, setAbierto] = useState(false);
  const [items, setItems] = useState<VentaItemInput[]>(itemsActuales);
  const [productoId, setProductoId] = useState("");
  const [nombreLibre, setNombreLibre] = useState("");
  const [precioLibre, setPrecioLibre] = useState<number | "">("");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const subtotal = items.reduce((acc, i) => acc + i.precio, 0);
  const total = subtotal - descuento + incremento;
  const saldo = total - pagado;
  const bajoLoPagado = total < pagado;
  const descuentoExcede = descuento > subtotal;

  function abrir() {
    setItems(itemsActuales);
    setError(null);
    setAbierto(true);
  }

  function agregarCatalogo() {
    const p = productos.find((x) => x.id === productoId);
    if (!p) return;
    setItems((prev) => [...prev, { producto_id: p.id, nombre: p.nombre, precio: p.precio }]);
    setProductoId("");
  }

  function agregarLibre() {
    if (!nombreLibre.trim() || !(Number(precioLibre) > 0)) return;
    setItems((prev) => [...prev, { producto_id: null, nombre: nombreLibre.trim(), precio: Number(precioLibre) }]);
    setNombreLibre("");
    setPrecioLibre("");
  }

  function guardar() {
    setError(null);
    startTransition(async () => {
      const res = await corregirProductosVenta(ventaId, items);
      if (res.error) {
        setError(res.error);
      } else {
        setAbierto(false);
      }
    });
  }

  if (!abierto) {
    return (
      <button type="button" onClick={abrir} className={`inline-flex items-center gap-1 ${linkClass("primary")}`}>
        <Pencil className="h-3 w-3" aria-hidden="true" />
        Corregir productos
      </button>
    );
  }

  return (
    <div className="flex flex-col gap-3 rounded-xl border border-indigo-200 bg-indigo-50/40 p-3">
      <p className="text-xs text-slate-500">
        Quita o agrega productos. Lo que el cliente ya pagó no se toca: solo cambia el total y el saldo pendiente.
      </p>

      <ul className="flex flex-col divide-y divide-slate-100 rounded-lg border border-slate-200 bg-white">
        {items.map((item, i) => (
          <li key={i} className="flex items-center justify-between gap-2 px-3 py-2 text-sm">
            <span className="truncate text-slate-700">{item.nombre}</span>
            <span className="flex shrink-0 items-center gap-2">
              <span className="font-medium text-slate-800">{formatCOP(item.precio)}</span>
              <button
                type="button"
                onClick={() => setItems((prev) => prev.filter((_, idx) => idx !== i))}
                className="text-slate-400 hover:text-red-600"
                title="Quitar"
                aria-label={`Quitar ${item.nombre}`}
              >
                <X className="h-4 w-4" />
              </button>
            </span>
          </li>
        ))}
        {items.length === 0 ? <li className="px-3 py-2 text-sm text-slate-400">Sin productos.</li> : null}
      </ul>

      <div className="flex gap-2">
        <select value={productoId} onChange={(e) => setProductoId(e.target.value)} className={inputClass}>
          <option value="">Agregar del catálogo...</option>
          {productos.map((p) => (
            <option key={p.id} value={p.id}>
              {p.nombre} — {formatCOP(p.precio)}
            </option>
          ))}
        </select>
        <button type="button" onClick={agregarCatalogo} disabled={!productoId} className={buttonClass("secondary", "sm")}>
          <Plus className="h-4 w-4" />
          Agregar
        </button>
      </div>

      <div className="flex gap-2">
        <input
          value={nombreLibre}
          onChange={(e) => setNombreLibre(e.target.value)}
          placeholder="Otro producto (nombre)"
          className={inputClass}
        />
        <input
          type="number"
          min={1}
          value={precioLibre}
          onChange={(e) => setPrecioLibre(e.target.value === "" ? "" : Number(e.target.value))}
          placeholder="Precio"
          className={`${inputClass} w-32 shrink-0`}
        />
        <button
          type="button"
          onClick={agregarLibre}
          disabled={!nombreLibre.trim() || !(Number(precioLibre) > 0)}
          className={buttonClass("secondary", "sm")}
        >
          <Plus className="h-4 w-4" />
          Agregar
        </button>
      </div>

      <div className="flex flex-col gap-0.5 rounded-lg bg-white p-3 text-sm">
        <div className="flex justify-between text-slate-600">
          <span>Nuevo total</span>
          <span className="font-semibold text-slate-900">{formatCOP(total)}</span>
        </div>
        <div className="flex justify-between text-emerald-600">
          <span>Ya pagado (no cambia)</span>
          <span>{formatCOP(pagado)}</span>
        </div>
        <div className="flex justify-between text-amber-700">
          <span>Nuevo saldo pendiente</span>
          <span className="font-semibold">{formatCOP(Math.max(0, saldo))}</span>
        </div>
      </div>

      {bajoLoPagado ? (
        <p role="alert" className="text-xs font-medium text-red-600">
          El nuevo total queda por debajo de lo ya pagado ({formatCOP(pagado)}). Agrega productos o devuelve plata
          antes de bajarlo.
        </p>
      ) : null}
      {descuentoExcede ? (
        <p role="alert" className="text-xs font-medium text-red-600">
          El descuento de la venta ({formatCOP(descuento)}) supera el nuevo subtotal.
        </p>
      ) : null}
      {error ? (
        <p role="alert" className="text-xs font-medium text-red-600">
          {error}
        </p>
      ) : null}

      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={guardar}
          disabled={pending || items.length === 0 || bajoLoPagado || descuentoExcede}
          className={buttonClass("primary", "sm")}
        >
          {pending ? "Guardando..." : "Guardar cambios"}
        </button>
        <button type="button" onClick={() => setAbierto(false)} className={linkClass("neutral")}>
          Cancelar
        </button>
      </div>
    </div>
  );
}
