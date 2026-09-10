"use client";

import { useActionState, useMemo, useState } from "react";
import { CheckCircle2, ChevronDown, HandCoins, Plus, X } from "lucide-react";
import { registrarVenta } from "./actions";
import { PagoLines } from "./pago-lines";
import { DescuentoPicker } from "@/components/descuento-picker";
import { RuntConsultaLink } from "@/components/runt-link";
import { RuntBadge } from "@/app/(app)/clientes/runt-badge";
import type {
  ClienteRow,
  DescuentoTipo,
  ProductoRow,
  TramitadorPrecioRow,
  TramitadorRow,
  VentaItemInput,
} from "@/lib/supabase/types";
import { formatCOP } from "@/lib/format";

const inputClass =
  "w-full rounded-lg border border-slate-300 px-3.5 py-2.5 text-sm text-slate-900 outline-none transition focus:border-indigo-600 focus:ring-1 focus:ring-indigo-600";

export function VentaForm({
  sedeId,
  clientes,
  productos,
  tramitadores,
  tramitadorPrecios,
  clienteIdInicial,
}: {
  sedeId: string;
  clientes: ClienteRow[];
  productos: ProductoRow[];
  tramitadores: TramitadorRow[];
  /** Precio especial de un tramitador para un producto puntual — tiene prioridad sobre su precio_especial genérico. */
  tramitadorPrecios: TramitadorPrecioRow[];
  /** Precarga el cliente cuando se llega desde "Crear venta" en su ficha. */
  clienteIdInicial?: string;
}) {
  const [state, formAction, pending] = useActionState(registrarVenta, {});
  const [clienteId, setClienteId] = useState(clienteIdInicial ?? "");
  const [items, setItems] = useState<VentaItemInput[]>([]);
  const [q, setQ] = useState("");
  const [listaProductosAbierta, setListaProductosAbierta] = useState<"normal" | "tramitador">("normal");
  const [descuentoTipo, setDescuentoTipo] = useState<DescuentoTipo | "">("");
  const [descuentoValor, setDescuentoValor] = useState(0);
  const [tramitadorId, setTramitadorId] = useState("");
  const [precioTramitador, setPrecioTramitador] = useState(0);

  // Si alguno de los productos elegidos tiene un precio puntual para este
  // tramitador (ej. "Examen 2 categorías" vale distinto que "Examen 1
  // categoría"), se usa la suma de esos; si ninguno tiene, se cae al
  // precio especial genérico del tramitador. Se recalcula explícitamente
  // al elegir tramitador o al tocar los productos (ver más abajo) — sigue
  // siendo editable a mano después.
  function precioSugerido(tId: string, itemsActuales: VentaItemInput[]) {
    const sumaEspecifica = itemsActuales.reduce((acc, item) => {
      if (!item.producto_id) return acc;
      const match = tramitadorPrecios.find(
        (tp) => tp.tramitador_id === tId && tp.producto_id === item.producto_id,
      );
      return acc + (match ? match.precio_especial : 0);
    }, 0);
    if (sumaEspecifica > 0) return sumaEspecifica;
    return tramitadores.find((t) => t.id === tId)?.precio_especial ?? 0;
  }

  // Cuánto de la orden es realmente atribuible al tramitador: solo los
  // productos para los que tiene un precio puntual (ej. los exámenes que él
  // trae) — si en la misma orden se agregan productos que no le corresponden
  // (ej. una impresión que vende directo el centro), esos quedan afuera. Si
  // ninguno de los productos tiene precio puntual, se asume que trajo toda
  // la orden (mismo criterio que precioSugerido).
  function montoReferido(tId: string, itemsActuales: VentaItemInput[]) {
    const referidos = itemsActuales.filter(
      (item) =>
        item.producto_id &&
        tramitadorPrecios.some((tp) => tp.tramitador_id === tId && tp.producto_id === item.producto_id),
    );
    const base = referidos.length > 0 ? referidos : itemsActuales;
    return base.reduce((acc, item) => acc + item.precio, 0);
  }

  const productosFiltrados = useMemo(() => {
    const term = q.trim().toLowerCase();
    if (!term) return productos;
    return productos.filter(
      (p) =>
        p.nombre.toLowerCase().includes(term) ||
        (p.categoria ?? "").toLowerCase().includes(term),
    );
  }, [q, productos]);

  const preciosTramitadorSeleccionado = useMemo(() => {
    if (!tramitadorId) return [];
    return tramitadorPrecios
      .filter((tp) => tp.tramitador_id === tramitadorId)
      .map((tp) => ({ producto: productos.find((p) => p.id === tp.producto_id), precio: tp.precio_especial }))
      .filter((tp): tp is { producto: ProductoRow; precio: number } => !!tp.producto);
  }, [tramitadorId, tramitadorPrecios, productos]);

  function agregarProducto(p: ProductoRow) {
    const next = [...items, { producto_id: p.id, nombre: p.nombre, precio: p.precio }];
    setItems(next);
    if (tramitadorId) setPrecioTramitador(precioSugerido(tramitadorId, next));
  }

  // Agrega el producto ya cobrando el precio especial del tramitador en vez
  // del precio normal — para cuando el cliente paga directo esa plata (ver
  // "Precios tramitador" más abajo). El precio especial de la organización
  // queda igual al precio del ítem, así la ganancia del tramitador da $0
  // automáticamente sin tener que aplicar el ajuste aparte.
  function agregarProductoTramitador(p: ProductoRow, precioEspecial: number) {
    const next = [...items, { producto_id: p.id, nombre: `${p.nombre} (tramitador)`, precio: precioEspecial }];
    setItems(next);
    setPrecioTramitador(precioSugerido(tramitadorId, next));
  }

  function quitarItem(index: number) {
    const next = items.filter((_, i) => i !== index);
    setItems(next);
    if (tramitadorId) setPrecioTramitador(precioSugerido(tramitadorId, next));
  }

  const clienteSeleccionado = clientes.find((c) => c.id === clienteId);
  const total = items.reduce((acc, item) => acc + item.precio, 0);
  const descuentoMonto =
    descuentoTipo === "porcentaje"
      ? Math.round((total * descuentoValor) / 100)
      : descuentoTipo === "fijo"
        ? Math.min(descuentoValor, total)
        : 0;
  const totalNeto = total - descuentoMonto;

  return (
    <form action={formAction} className="flex flex-col gap-5">
      <input type="hidden" name="sede_id" value={sedeId} />
      <input type="hidden" name="items" value={JSON.stringify(items)} />
      <input type="hidden" name="descuento_tipo" value={descuentoTipo} />
      <input type="hidden" name="descuento_valor" value={descuentoValor} />

      <Field label="Cliente" required>
        <select
          name="cliente_id"
          required
          defaultValue={clienteIdInicial ?? ""}
          onChange={(e) => setClienteId(e.target.value)}
          className={inputClass}
        >
          <option value="" disabled>
            Seleccionar...
          </option>
          {clientes.map((c) => (
            <option key={c.id} value={c.id}>
              {c.nombre_completo} — {c.numero_documento}
            </option>
          ))}
        </select>
        <div className="flex flex-wrap items-center justify-between gap-2">
          {clienteSeleccionado ? <RuntBadge runt={clienteSeleccionado.runt} /> : <span />}
          <RuntConsultaLink documento={clienteSeleccionado?.numero_documento} compact />
        </div>
      </Field>

      <section className="flex flex-col gap-2">
        <span className="text-sm font-medium text-slate-700">Productos</span>

        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Buscar productos por nombre o categoría..."
          className={inputClass}
        />

        <details
          open={listaProductosAbierta === "normal"}
          onToggle={(e) => {
            if (e.currentTarget.open) setListaProductosAbierta("normal");
          }}
          className="group rounded-lg border border-slate-200 [&_summary::-webkit-details-marker]:hidden"
        >
          <summary className="flex cursor-pointer list-none items-center justify-between gap-2 px-3 py-2">
            <span className="text-sm font-medium text-slate-700">Precios normal</span>
            <ChevronDown className="h-4 w-4 shrink-0 text-slate-400 transition-transform group-open:rotate-180" />
          </summary>
          <div className="grid max-h-64 grid-cols-1 gap-2 overflow-y-auto border-t border-slate-200 p-2 sm:grid-cols-2">
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
        </details>

        {tramitadores.length > 0 ? (
          <details
            open={listaProductosAbierta === "tramitador"}
            onToggle={(e) => {
              if (e.currentTarget.open) setListaProductosAbierta("tramitador");
            }}
            className="group rounded-lg border border-amber-200 bg-amber-50/40 [&_summary::-webkit-details-marker]:hidden"
          >
            <summary className="flex cursor-pointer list-none items-center justify-between gap-2 px-3 py-2">
              <span className="text-sm font-medium text-amber-900">Precios tramitador</span>
              <ChevronDown className="h-4 w-4 shrink-0 text-amber-500 transition-transform group-open:rotate-180" />
            </summary>
            <div className="border-t border-amber-200 p-2">
              {!tramitadorId ? (
                <p className="py-2 text-center text-xs text-amber-700">
                  Elegí un tramitador más abajo para ver y agregar sus productos al precio especial.
                </p>
              ) : preciosTramitadorSeleccionado.length === 0 ? (
                <p className="py-2 text-center text-xs text-amber-700">
                  Este tramitador no tiene precios por producto cargados.
                </p>
              ) : (
                <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                  {preciosTramitadorSeleccionado.map(({ producto, precio }) => (
                    <button
                      key={producto.id}
                      type="button"
                      onClick={() => agregarProductoTramitador(producto, precio)}
                      className="flex items-center justify-between gap-2 rounded-lg border border-amber-300 bg-white px-3 py-2 text-left text-sm transition hover:border-amber-400 hover:bg-amber-50"
                    >
                      <div className="min-w-0">
                        <p className="truncate font-medium text-slate-800">{producto.nombre} (tramitador)</p>
                        <p className="text-xs text-amber-700">{formatCOP(precio)}</p>
                      </div>
                      <Plus className="h-4 w-4 shrink-0 text-amber-600" />
                    </button>
                  ))}
                </div>
              )}
            </div>
          </details>
        ) : null}
      </section>

      <section className="flex flex-col gap-2 rounded-lg border border-slate-200 p-3">
        <span className="text-xs font-semibold tracking-wide text-slate-500 uppercase">
          {items.length} {items.length === 1 ? "producto" : "productos"} en la orden
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
        <div className="flex flex-col gap-0.5 border-t border-slate-200 pt-2 text-sm">
          <div className={`flex items-center justify-between ${descuentoMonto > 0 ? "text-slate-500" : "font-semibold text-slate-900"}`}>
            <span>{descuentoMonto > 0 ? "Subtotal" : "Total"}</span>
            <span>{formatCOP(total)}</span>
          </div>
          {descuentoMonto > 0 ? (
            <>
              <div className="flex items-center justify-between text-emerald-600">
                <span>Descuento</span>
                <span>−{formatCOP(descuentoMonto)}</span>
              </div>
              <div className="flex items-center justify-between font-semibold text-slate-900">
                <span>Total con descuento</span>
                <span>{formatCOP(totalNeto)}</span>
              </div>
            </>
          ) : null}
        </div>
      </section>

      <Field label="Descuento (opcional)">
        <DescuentoPicker
          tipo={descuentoTipo}
          valor={descuentoValor}
          onTipoChange={setDescuentoTipo}
          onValorChange={setDescuentoValor}
        />
      </Field>

      {tramitadores.length > 0 ? (
        <Field label="Tramitador o asesor referido (opcional)">
          <input type="hidden" name="tramitador_id" value={tramitadorId} />
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-[1fr_160px]">
            <select
              value={tramitadorId}
              onChange={(e) => {
                const id = e.target.value;
                setTramitadorId(id);
                setPrecioTramitador(id ? precioSugerido(id, items) : 0);
              }}
              className={inputClass}
            >
              <option value="">Sin tramitador</option>
              {tramitadores.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.nombre}
                </option>
              ))}
            </select>
            {tramitadorId ? (
              <input
                name="precio_tramitador"
                type="number"
                min={0}
                step="1"
                value={precioTramitador}
                onChange={(e) => setPrecioTramitador(Number(e.target.value) || 0)}
                placeholder="Precio especial"
                className={inputClass}
              />
            ) : (
              <input type="hidden" name="precio_tramitador" value={0} />
            )}
          </div>
          {tramitadorId ? (
            (() => {
              const totalReferido = montoReferido(tramitadorId, items);
              // Ganancia "bruta" (sin descontar el ajuste que este mismo botón aplica) — se usa para
              // decidir si mostrar el botón y para detectar si ya está aplicado, así no desaparece en
              // cuanto el descuento la lleva a $0.
              const gananciaBruta = Math.max(0, totalReferido - precioTramitador);
              const descuentoProporcional =
                total > 0 ? Math.round((descuentoMonto * totalReferido) / total) : 0;
              const totalReferidoNeto = totalReferido - descuentoProporcional;
              const gananciaTramitador = Math.max(0, totalReferidoNeto - precioTramitador);
              const hayItemsAjenos = totalReferido < total;
              const ajusteAplicado =
                gananciaBruta > 0 && descuentoTipo === "fijo" && descuentoValor === gananciaBruta;
              return (
                <div className="flex flex-col gap-2">
                  <p className="text-xs text-slate-500">
                    El precio especial (lo que le corresponde a la organización) es {formatCOP(precioTramitador)} —
                    la ganancia del tramitador sería {formatCOP(gananciaTramitador)} sobre{" "}
                    {formatCOP(totalReferidoNeto)} (lo que él trajo)
                    {hayItemsAjenos ? "; el resto de la orden no le corresponde a él." : "."}
                  </p>
                  {gananciaBruta > 0 ? (
                    ajusteAplicado ? (
                      <div className="flex items-center justify-between gap-3 rounded-xl border border-emerald-200 bg-emerald-50 px-3.5 py-2.5">
                        <span className="flex items-center gap-2 text-xs font-semibold text-emerald-800">
                          <CheckCircle2 className="h-4 w-4 shrink-0" aria-hidden="true" />
                          Ajustado: se cobra solo {formatCOP(precioTramitador)} — el tramitador ya se quedó con
                          su ganancia.
                        </span>
                        <button
                          type="button"
                          onClick={() => {
                            setDescuentoTipo("");
                            setDescuentoValor(0);
                          }}
                          className="shrink-0 text-xs font-medium text-emerald-700 underline hover:text-emerald-900"
                        >
                          Quitar
                        </button>
                      </div>
                    ) : (
                      <button
                        type="button"
                        onClick={() => {
                          setDescuentoTipo("fijo");
                          setDescuentoValor(gananciaBruta);
                        }}
                        className="flex items-start gap-2.5 rounded-xl border border-amber-300 bg-amber-50 px-3.5 py-2.5 text-left shadow-sm shadow-amber-900/5 transition hover:border-amber-400 hover:bg-amber-100"
                      >
                        <HandCoins className="mt-0.5 h-4 w-4 shrink-0 text-amber-600" aria-hidden="true" />
                        <span className="flex flex-col gap-0.5">
                          <span className="text-xs font-semibold text-amber-900">
                            ¿El cliente ya le pagó su ganancia directo al tramitador?
                          </span>
                          <span className="text-xs text-amber-700">
                            Tocá acá para cobrar solo {formatCOP(precioTramitador)} — aplica un descuento de{" "}
                            {formatCOP(gananciaBruta)}
                          </span>
                        </span>
                      </button>
                    )
                  ) : null}
                </div>
              );
            })()
          ) : null}
        </Field>
      ) : null}

      {items.length > 0 ? <PagoLines key={totalNeto} total={totalNeto} allowPin /> : null}

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
        {pending ? "Registrando..." : `Registrar orden — ${formatCOP(totalNeto)}`}
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
