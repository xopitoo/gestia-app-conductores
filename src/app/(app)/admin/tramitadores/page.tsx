import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getViewerContext } from "@/lib/viewer";
import { ConfirmSubmitButton } from "@/components/confirm-submit-button";
import { formatCOP } from "@/lib/format";
import { crearTramitador, toggleTramitadorActive } from "./actions";
import { PagoTramitadorForm } from "./pago-tramitador-form";
import { PersonasModal } from "./personas-modal";
import { PreciosProductoForm } from "./precios-producto-form";

export const metadata: Metadata = { title: "Tramitadores | Gestia App Conductores" };

export default async function TramitadoresPage() {
  const { profile, supabase, sedes } = await getViewerContext();
  if (profile.role !== "admin") redirect("/ventas");

  const { data: tramitadores } = await supabase
    .from("tramitadores")
    .select("id, sede_id, nombre, precio_especial, active")
    .order("nombre");

  const tramitadorIds = (tramitadores ?? []).map((t) => t.id);

  const { data: ventasRows } = tramitadorIds.length
    ? await supabase
        .from("ventas")
        .select("id, tramitador_id, precio_tramitador, cliente_id, concepto, monto, descuento, estado, created_at")
        .in("tramitador_id", tramitadorIds)
        .neq("estado", "anulada")
        .order("created_at", { ascending: false })
    : {
        data: [] as {
          id: string;
          tramitador_id: string | null;
          precio_tramitador: number;
          cliente_id: string;
          concepto: string;
          monto: number;
          descuento: number;
          estado: string;
          created_at: string;
        }[],
      };

  const ventaIds = (ventasRows ?? []).map((v) => v.id);
  const clienteIds = [...new Set((ventasRows ?? []).map((v) => v.cliente_id))];

  const [{ data: pagosClientesRows }, { data: pagosTramitadorRows }, { data: clientesRows }, { data: productos }, { data: precioProductoRows }] =
    await Promise.all([
      ventaIds.length
        ? supabase.from("venta_pagos").select("venta_id, monto").in("venta_id", ventaIds)
        : Promise.resolve({ data: [] as { venta_id: string; monto: number }[] }),
      tramitadorIds.length
        ? supabase.from("tramitador_pagos").select("tramitador_id, monto").in("tramitador_id", tramitadorIds)
        : Promise.resolve({ data: [] as { tramitador_id: string; monto: number }[] }),
      clienteIds.length
        ? supabase.from("clientes").select("id, nombre_completo").in("id", clienteIds)
        : Promise.resolve({ data: [] as { id: string; nombre_completo: string }[] }),
      supabase.from("productos").select("id, sede_id, nombre").eq("active", true).order("nombre"),
      tramitadorIds.length
        ? supabase
            .from("tramitador_precios")
            .select("id, tramitador_id, producto_id, precio_especial")
            .in("tramitador_id", tramitadorIds)
        : Promise.resolve({
            data: [] as { id: string; tramitador_id: string; producto_id: string; precio_especial: number }[],
          }),
    ]);

  const sedeName = (id: string | null) => (id ? (sedes.find((s) => s.id === id)?.name ?? "—") : "Todas las sedes");
  const clienteNombre = (id: string) => (clientesRows ?? []).find((c) => c.id === id)?.nombre_completo ?? "—";
  const productoNombre = (id: string) => (productos ?? []).find((p) => p.id === id)?.nombre ?? "—";
  const pagadoDeVenta = (ventaId: string) =>
    (pagosClientesRows ?? []).filter((p) => p.venta_id === ventaId).reduce((acc, p) => acc + p.monto, 0);

  const filas = (tramitadores ?? []).map((t) => {
    const ventasDeT = (ventasRows ?? []).filter((v) => v.tramitador_id === t.id);
    // Lo que le corresponde a la organización por TODAS sus ventas, hayan
    // pagado o no — se cobra primero, antes que la ganancia del tramitador.
    const reclamo = ventasDeT.reduce((acc, v) => acc + v.precio_tramitador, 0);
    // Efectivo real que ya entregaron sus clientes (abonos incluidos).
    const pagadoClientes = ventasDeT.reduce((acc, v) => acc + pagadoDeVenta(v.id), 0);
    const pagadoTramitador = (pagosTramitadorRows ?? [])
      .filter((p) => p.tramitador_id === t.id)
      .reduce((acc, p) => acc + p.monto, 0);
    // Lo que ya cobramos de sus clientes, menos lo que nos corresponde a
    // nosotros, menos lo que ya le pagamos a él — el resto es suyo.
    const saldoAFavor = pagadoClientes - reclamo - pagadoTramitador;
    return { ...t, personas: ventasDeT.length, ventasDeT, reclamo, pagadoClientes, pagadoTramitador, saldoAFavor };
  });
  const totalPendiente = filas.reduce((acc, f) => acc + Math.max(0, f.saldoAFavor), 0);

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold text-slate-900">Tramitadores</h1>
        <p className="mt-1 text-sm text-slate-500">
          Cada tramitador tiene un precio especial (lo que le corresponde a la organización) — puede ser
          uno solo por defecto, o distinto según el producto que se venda. La diferencia con lo que paga
          el cliente es su ganancia. El saldo a favor cruza lo que ya pagaron sus clientes contra ese
          precio especial acumulado, y lo que ya se le pagó a él.
        </p>
      </div>

      <div className="rounded-2xl border border-slate-200 bg-white p-5">
        <h2 className="text-xs font-semibold tracking-wide text-slate-500 uppercase">
          Total pendiente por pagar
        </h2>
        <p className="mt-2 text-2xl font-semibold text-amber-600">{formatCOP(totalPendiente)}</p>
      </div>

      <div className="rounded-2xl border border-slate-200 bg-white p-6">
        <div className="flex flex-col gap-3">
          {filas.map((t) => (
            <div key={t.id} className="rounded-xl border border-slate-200 p-4">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <h3 className="font-semibold text-slate-900">{t.nombre}</h3>
                    <span
                      className={`rounded-full px-2 py-0.5 text-[11px] font-medium ${
                        t.active ? "bg-emerald-100 text-emerald-700" : "bg-slate-100 text-slate-500"
                      }`}
                    >
                      {t.active ? "Activo" : "Inactivo"}
                    </span>
                  </div>
                  <p className="text-xs text-slate-500">
                    {sedeName(t.sede_id)} · Precio especial {formatCOP(t.precio_especial)} · {t.personas}{" "}
                    {t.personas === 1 ? "persona" : "personas"}
                  </p>
                  <p className="mt-1 text-xs text-slate-500">
                    Pagado por sus clientes {formatCOP(t.pagadoClientes)} · Le corresponde a la organización{" "}
                    {formatCOP(t.reclamo)} · Ya se le pagó {formatCOP(t.pagadoTramitador)}
                  </p>
                </div>
                <div className="flex shrink-0 items-center gap-3">
                  <span
                    className={`text-lg font-semibold ${
                      t.saldoAFavor > 0
                        ? "text-amber-600"
                        : t.saldoAFavor < 0
                          ? "text-red-600"
                          : "text-emerald-600"
                    }`}
                  >
                    {formatCOP(t.saldoAFavor)}
                  </span>
                  <form action={toggleTramitadorActive}>
                    <input type="hidden" name="id" value={t.id} />
                    <input type="hidden" name="active" value={String(t.active)} />
                    <ConfirmSubmitButton
                      confirmMessage={t.active ? `¿Desactivar ${t.nombre}?` : `¿Reactivar ${t.nombre}?`}
                      className="text-xs font-medium text-indigo-700 hover:underline"
                    >
                      {t.active ? "Desactivar" : "Activar"}
                    </ConfirmSubmitButton>
                  </form>
                </div>
              </div>
              {t.saldoAFavor < 0 ? (
                <p className="mt-2 text-xs text-red-600">
                  El tramitador nos debe {formatCOP(-t.saldoAFavor)} — sus clientes pagaron menos de lo
                  que le corresponde a la organización por las personas ya registradas.
                </p>
              ) : null}
              <div className="mt-3">
                <PagoTramitadorForm tramitadorId={t.id} saldo={t.saldoAFavor} />
              </div>

              <div className="mt-3 border-t border-slate-100 pt-3">
                <PreciosProductoForm
                  tramitadorId={t.id}
                  productosDisponibles={(productos ?? [])
                    .filter((p) => p.sede_id === null || p.sede_id === t.sede_id)
                    .map((p) => ({ id: p.id, nombre: p.nombre }))}
                  precios={(precioProductoRows ?? [])
                    .filter((pp) => pp.tramitador_id === t.id)
                    .map((pp) => ({
                      id: pp.id,
                      productoId: pp.producto_id,
                      productoNombre: productoNombre(pp.producto_id),
                      precioEspecial: pp.precio_especial,
                    }))}
                />
              </div>

              {t.personas > 0 ? (
                <div className="mt-3 border-t border-slate-100 pt-3">
                  <PersonasModal
                    tramitadorNombre={t.nombre}
                    personas={t.ventasDeT.map((v) => ({
                      ventaId: v.id,
                      createdAt: v.created_at,
                      clienteNombre: clienteNombre(v.cliente_id),
                      estado: v.estado,
                      pagado: pagadoDeVenta(v.id),
                      total: v.monto - v.descuento,
                      precioTramitador: v.precio_tramitador,
                    }))}
                  />
                </div>
              ) : null}
            </div>
          ))}
          {filas.length === 0 ? (
            <p className="py-6 text-center text-sm text-slate-400">Todavía no hay tramitadores cargados.</p>
          ) : null}
        </div>

        <form action={crearTramitador} className="mt-5 grid grid-cols-1 gap-2 border-t border-slate-200 pt-4 sm:grid-cols-4">
          <input
            name="nombre"
            required
            placeholder="Nombre del tramitador"
            className="rounded-lg border border-slate-300 px-3.5 py-2 text-sm text-slate-900 outline-none focus:border-indigo-600 focus:ring-1 focus:ring-indigo-600"
          />
          <select
            name="sede_id"
            defaultValue=""
            className="rounded-lg border border-slate-300 bg-white px-3.5 py-2 text-sm text-slate-700 outline-none focus:border-indigo-600"
          >
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
            required
            placeholder="Precio especial"
            className="rounded-lg border border-slate-300 px-3.5 py-2 text-sm text-slate-900 outline-none focus:border-indigo-600 focus:ring-1 focus:ring-indigo-600"
          />
          <button
            type="submit"
            className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white shadow-sm shadow-indigo-600/20 transition hover:bg-indigo-700"
          >
            Agregar tramitador
          </button>
        </form>
      </div>
    </div>
  );
}
