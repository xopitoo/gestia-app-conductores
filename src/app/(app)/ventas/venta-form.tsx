"use client";

import { useActionState, useMemo, useState } from "react";
import { AlertTriangle, CheckCircle2, ChevronDown, HandCoins, Plus, X } from "lucide-react";
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
import { buttonClass, linkClass } from "@/lib/ui";

const inputClass =
  "w-full rounded-lg border border-slate-300 px-3.5 py-2.5 text-sm text-slate-900 outline-none transition focus:border-indigo-600 focus:ring-1 focus:ring-indigo-600";

// Agrupa el catálogo por tipo de producto para que la lista de "Precios
// normal" no quede como un mosaico desordenado. Pensado para varias sedes
// con catálogos distintos (ej. C.R.C. Valorar vende exámenes médicos,
// CEAPP Cali vende cursos de conducción) — cada sede solo ve los grupos
// que de verdad tiene productos, en este orden: combos primero (lo que
// más se vende junto), después cursos de escuela, médico, licencia,
// RUNT, refuerzo/práctica, impresiones, y al final los trámites sueltos
// que no calzan en ningún otro grupo. Cada grupo tiene su propio color
// para que se distingan de un vistazo, no solo por el orden.
type GrupoProducto =
  | "combos"
  | "escuela"
  | "medico"
  | "licencia"
  | "runt"
  | "refuerzo"
  | "impresiones"
  | "otros";

const GRUPO_ORDEN: GrupoProducto[] = [
  "combos",
  "escuela",
  "medico",
  "licencia",
  "runt",
  "refuerzo",
  "impresiones",
  "otros",
];

const GRUPO_LABEL: Record<GrupoProducto, string> = {
  combos: "Combos y promociones",
  escuela: "Cursos de escuela",
  medico: "Médico",
  licencia: "Licencia",
  runt: "RUNT",
  refuerzo: "Refuerzo y práctica",
  impresiones: "Impresiones",
  otros: "Otros trámites",
};

const GRUPO_STYLE: Record<GrupoProducto, { badge: string; borderLeft: string; hover: string; icon: string }> = {
  combos: {
    badge: "bg-indigo-100 text-indigo-700",
    borderLeft: "border-l-indigo-400",
    hover: "hover:border-indigo-300 hover:bg-indigo-50",
    icon: "text-indigo-600",
  },
  escuela: {
    badge: "bg-sky-100 text-sky-700",
    borderLeft: "border-l-sky-400",
    hover: "hover:border-sky-300 hover:bg-sky-50",
    icon: "text-sky-600",
  },
  medico: {
    badge: "bg-emerald-100 text-emerald-700",
    borderLeft: "border-l-emerald-400",
    hover: "hover:border-emerald-300 hover:bg-emerald-50",
    icon: "text-emerald-600",
  },
  licencia: {
    badge: "bg-cyan-100 text-cyan-700",
    borderLeft: "border-l-cyan-400",
    hover: "hover:border-cyan-300 hover:bg-cyan-50",
    icon: "text-cyan-600",
  },
  runt: {
    badge: "bg-violet-100 text-violet-700",
    borderLeft: "border-l-violet-400",
    hover: "hover:border-violet-300 hover:bg-violet-50",
    icon: "text-violet-600",
  },
  refuerzo: {
    badge: "bg-orange-100 text-orange-700",
    borderLeft: "border-l-orange-400",
    hover: "hover:border-orange-300 hover:bg-orange-50",
    icon: "text-orange-600",
  },
  impresiones: {
    badge: "bg-amber-100 text-amber-700",
    borderLeft: "border-l-amber-400",
    hover: "hover:border-amber-300 hover:bg-amber-50",
    icon: "text-amber-600",
  },
  otros: {
    badge: "bg-slate-200 text-slate-600",
    borderLeft: "border-l-slate-300",
    hover: "hover:border-slate-300 hover:bg-slate-50",
    icon: "text-slate-500",
  },
};

// El orden de los "if" importa: un producto se queda con el primer grupo
// que calce. "Combo" siempre gana primero (ej. "Médico Combo" es un combo,
// no un médico suelto) — mismo criterio que ya existía. Los cursos de
// escuela se detectan por la categoría de licencia (A2/B1/C1) o la
// palabra "escuela"; ninguna otra categoría usa esas siglas, así que no
// hay falsos positivos con productos como "Placa de Carro". Se le quitan
// las tildes al nombre antes de comparar (NFD + strip de diacríticos) para
// no tener que repetir cada palabra clave con y sin tilde ("MÉDICO" vs
// "MEDICO", "RUNT MODIFICACIÓN" vs "MODIFICACION").
function grupoDeProducto(nombre: string): GrupoProducto {
  const n = nombre
    .toUpperCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "");
  if (n.includes("COMBO") || n.includes("PROMO") || n.includes("+")) return "combos";
  if (/(^|\s)(A2|B1|C1)(\s|$)/.test(n) || n.includes("ESCUELA") || n.includes("RECATEGORIZA") || n.includes("PUBLICO"))
    return "escuela";
  if (n.includes("MEDIC") || n.includes("EXAMEN")) return "medico";
  if (n.includes("LICENCIA") || n.includes("RENOVACION")) return "licencia";
  if (n.includes("RUNT")) return "runt";
  if (n.includes("REFUERZO") || n.includes("PRACTICA")) return "refuerzo";
  if (n.includes("IMPRESION")) return "impresiones";
  return "otros";
}

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

  const productosAgrupados = useMemo(() => {
    return GRUPO_ORDEN.map((grupo) => ({
      grupo,
      productos: productosFiltrados.filter((p) => grupoDeProducto(p.nombre) === grupo),
    })).filter((g) => g.productos.length > 0);
  }, [productosFiltrados]);

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
          <div className="flex max-h-72 flex-col gap-3 overflow-y-auto border-t border-slate-200 p-2">
            {productosAgrupados.map(({ grupo, productos: productosGrupo }) => {
              const style = GRUPO_STYLE[grupo];
              return (
                <div key={grupo} className="flex flex-col gap-1.5">
                  <span className={`w-fit rounded-full px-2 py-0.5 text-[11px] font-semibold ${style.badge}`}>
                    {GRUPO_LABEL[grupo]}
                  </span>
                  <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                    {productosGrupo.map((p) => (
                      <button
                        key={p.id}
                        type="button"
                        onClick={() => agregarProducto(p)}
                        className={`flex items-center justify-between gap-2 rounded-lg border border-slate-200 border-l-4 ${style.borderLeft} px-3 py-2 text-left text-sm transition ${style.hover}`}
                      >
                        <div className="min-w-0">
                          <p className="truncate font-medium text-slate-800">{p.nombre}</p>
                          <p className="text-xs text-slate-500">{formatCOP(p.precio)}</p>
                        </div>
                        <Plus className={`h-4 w-4 shrink-0 ${style.icon}`} />
                      </button>
                    ))}
                  </div>
                </div>
              );
            })}
            {productosFiltrados.length === 0 ? (
              <p className="py-4 text-center text-sm text-slate-400">
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
          {tramitadorId && precioTramitador === 0 && montoReferido(tramitadorId, items) > 0 ? (
            <p className="flex items-center gap-1.5 text-xs font-medium text-amber-700">
              <AlertTriangle className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
              El precio especial quedó en $0 pero hay productos de este tramitador en el carrito — revisá que
              sea a propósito antes de registrar.
            </p>
          ) : null}
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
                          className={`shrink-0 ${linkClass("success")}`}
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
        className={`mt-1 ${buttonClass("primary")} w-full`}
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
