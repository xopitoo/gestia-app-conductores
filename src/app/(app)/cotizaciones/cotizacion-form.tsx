"use client";

import { useActionState, useMemo, useState } from "react";
import { Plus, X } from "lucide-react";
import { crearCotizacion } from "./actions";
import type { ClienteRow, ProductoRow, VentaItemInput } from "@/lib/supabase/types";
import { formatCOP } from "@/lib/format";

const inputClass =
  "w-full rounded-lg border border-slate-300 px-3.5 py-2.5 text-sm text-slate-900 outline-none transition focus:border-indigo-600 focus:ring-1 focus:ring-indigo-600";

export function CotizacionForm({
  sedeId,
  clientes,
  productos,
}: {
  sedeId: string;
  clientes: ClienteRow[];
  productos: ProductoRow[];
}) {
  const [state, formAction, pending] = useActionState(crearCotizacion, {});
  const [items, setItems] = useState<VentaItemInput[]>([]);
  const [q, setQ] = useState("");
  const [libreNombre, setLibreNombre] = useState("");
  const [librePrecio, setLibrePrecio] = useState("");

  const productosFiltrados = useMemo(() => {
    const term = q.trim().toLowerCase();
    if (!term) return productos;
    return productos.filter(
      (p) =>
        p.nombre.toLowerCase().includes(term) ||
        (p.categoria ?? "").toLowerCase().includes(term),
    );
  }, [q, productos]);

  function agregarProducto(p: ProductoRow) {
    setItems((prev) => [...prev, { producto_id: p.id, nombre: p.nombre, precio: p.precio }]);
  }

  function agregarLibre() {
    const precio = Number(librePrecio);
    if (!libreNombre.trim() || !(precio > 0)) return;
    setItems((prev) => [...prev, { producto_id: null, nombre: libreNombre.trim(), precio }]);
    setLibreNombre("");
    setLibrePrecio("");
  }

  function quitarItem(index: number) {
    setItems((prev) => prev.filter((_, i) => i !== index));
  }

  const total = items.reduce((acc, item) => acc + item.precio, 0);

  return (
    <form action={formAction} className="flex flex-col gap-5">
      <input type="hidden" name="sede_id" value={sedeId} />
      <input type="hidden" name="items" value={JSON.stringify(items)} />

      <Field label="Cliente" required>
        <select name="cliente_id" required defaultValue="" className={inputClass}>
          <option value="" disabled>
            Seleccionar...
          </option>
          {clientes.map((c) => (
            <option key={c.id} value={c.id}>
              {c.nombre_completo} — {c.numero_documento}
            </option>
          ))}
        </select>
      </Field>

      <section className="flex flex-col gap-2">
        <span className="text-sm font-medium text-slate-700">Productos</span>

        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Buscar productos por nombre o categoría..."
          className={inputClass}
        />

        <div className="grid max-h-64 grid-cols-1 gap-2 overflow-y-auto rounded-lg border border-slate-200 p-2 sm:grid-cols-2">
          {productosFiltrados.map((p) => (
            <button
              key={p.id}
              type="button"
              onClick={() => agregarProducto(p)}
              className="flex items-center justify-between gap-2 rounded-lg border border-slate-200 px-3 py-2 text-left text-sm transition hover:border-indigo-300 hover:bg-indigo-50"
            >
              <div className="min-w-0">
                <p className="truncate font-medium text-slate-800">{p.nombre}</p>
                <p className="text-xs text-slate-500">{formatCOP(p.precio)}</p>
              </div>
              <Plus className="h-4 w-4 shrink-0 text-indigo-600" />
            </button>
          ))}
          {productosFiltrados.length === 0 ? (
            <p className="col-span-full py-4 text-center text-sm text-slate-400">
              Sin productos que coincidan.
            </p>
          ) : null}
        </div>

        <div className="grid grid-cols-1 gap-2 sm:grid-cols-[1fr_140px_auto]">
          <input
            value={libreNombre}
            onChange={(e) => setLibreNombre(e.target.value)}
            placeholder="Fuera de catálogo: concepto"
            className={inputClass}
          />
          <input
            value={librePrecio}
            onChange={(e) => setLibrePrecio(e.target.value)}
            type="number"
            min={1}
            step="1"
            placeholder="Precio"
            className={inputClass}
          />
          <button
            type="button"
            onClick={agregarLibre}
            className="rounded-lg border border-slate-300 px-3 py-2.5 text-sm font-medium text-slate-600 transition hover:bg-slate-100"
          >
            Agregar
          </button>
        </div>
      </section>

      <section className="flex flex-col gap-2 rounded-lg border border-slate-200 p-3">
        <span className="text-xs font-semibold tracking-wide text-slate-500 uppercase">
          {items.length} {items.length === 1 ? "producto" : "productos"} en la cotización
        </span>
        {items.length === 0 ? (
          <p className="py-2 text-center text-sm text-slate-400">
            Elegí al menos un producto de arriba.
          </p>
        ) : (
          <ul className="flex flex-col divide-y divide-slate-100">
            {items.map((item, i) => (
              <li key={i} className="flex items-center justify-between gap-2 py-1.5 text-sm">
                <span className="truncate text-slate-700">{item.nombre}</span>
                <div className="flex shrink-0 items-center gap-2">
                  <span className="font-medium text-slate-800">{formatCOP(item.precio)}</span>
                  <button
                    type="button"
                    onClick={() => quitarItem(i)}
                    className="text-slate-400 hover:text-red-600"
                    title="Quitar"
                  >
                    <X className="h-4 w-4" />
                  </button>
                </div>
              </li>
            ))}
          </ul>
        )}
        <div className="flex items-center justify-between border-t border-slate-200 pt-2 text-sm font-semibold text-slate-900">
          <span>Total</span>
          <span>{formatCOP(total)}</span>
        </div>
      </section>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <Field label="Asesor o tramitador referido (opcional)">
          <input
            name="referido_nombre"
            placeholder="Nombre de la persona que refirió al cliente"
            className={inputClass}
          />
        </Field>
        <Field label="Válida hasta (opcional)">
          <input name="valida_hasta" type="date" className={inputClass} />
        </Field>
      </div>

      {state.error ? (
        <p role="alert" className="rounded-lg bg-red-50 px-3.5 py-2.5 text-sm text-red-700">
          {state.error}
        </p>
      ) : null}

      <button
        type="submit"
        disabled={pending || items.length === 0}
        className="mt-1 rounded-lg bg-indigo-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm shadow-indigo-600/20 transition hover:bg-indigo-700 disabled:cursor-not-allowed disabled:opacity-60"
      >
        {pending ? "Guardando..." : `Crear cotización — ${formatCOP(total)}`}
      </button>
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
