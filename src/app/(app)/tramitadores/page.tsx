import type { Metadata } from "next";
import { getViewerContext } from "@/lib/viewer";
import { getTramitadoresConSaldo } from "@/lib/tramitador-saldo";
import { formatCOP } from "@/lib/format";
import { crearTramitador } from "./actions";
import { AbonoTramitadorForm } from "./abono-tramitador-form";
import { ComisionTramitadorForm } from "./comision-tramitador-form";
import { ExtractoModal } from "./extracto-modal";
import { PreciosProductoForm } from "./precios-producto-form";
import { TramitadorHeader } from "./tramitador-header";
import { buttonClass } from "@/lib/ui";

export const metadata: Metadata = { title: "Tramitadores | Gestia App Conductores" };

export default async function TramitadoresPage() {
  const { profile, supabase, sedes } = await getViewerContext();
  const isAdmin = profile.role === "admin";

  // Un recepcionista solo ve los tramitadores de su propia sede (o los
  // globales, sede_id null) — un admin ve el catálogo completo, de todas
  // las sedes, igual que antes.
  let tramitadoresQuery = supabase
    .from("tramitadores")
    .select("id, sede_id, nombre, precio_especial, active")
    .order("nombre");
  if (!isAdmin && profile.sede_id) {
    tramitadoresQuery = tramitadoresQuery.or(`sede_id.is.null,sede_id.eq.${profile.sede_id}`);
  }
  const { data: tramitadores } = await tramitadoresQuery;

  const tramitadorIds = (tramitadores ?? []).map((t) => t.id);

  // Para el conteo de "X personas" en el resumen (el detalle completo, con
  // pagos y saldo acumulado, lo trae ExtractoModal bajo demanda) y para
  // saber cuánto puede aplicarse realmente por "Registrar abono" — el
  // saldo agregado (saldoAFavor) no sirve para eso: si ya se le pagó algo
  // de comisión, incluye esa plata, que no está en ninguna venta pendiente
  // y por lo tanto registrar_abono_tramitador no puede recibirla.
  const { data: ventasRows } = tramitadorIds.length
    ? await supabase
        .from("ventas")
        .select("id, tramitador_id, sede_id, estado, monto, descuento")
        .in("tramitador_id", tramitadorIds)
        .neq("estado", "anulada")
    : {
        data: [] as {
          id: string;
          tramitador_id: string | null;
          sede_id: string;
          estado: string;
          monto: number;
          descuento: number;
        }[],
      };

  const ventaAbonadaIds = (ventasRows ?? []).filter((v) => v.estado === "abonada").map((v) => v.id);

  const [saldos, { data: productos }, { data: precioProductoRows }, { data: pagosAbonadasRows }] = await Promise.all([
    // sedeId=null porque acá se ven todos los tramitadores, de todas las
    // sedes, en una sola lista — mismo RPC que usa el dashboard de
    // recepcionista (una sede puntual), así la fórmula del saldo vive en
    // un solo lugar.
    getTramitadoresConSaldo(supabase, null),
    // Los precios por producto solo los edita un admin — un recepcionista
    // no necesita traer este catálogo.
    isAdmin
      ? supabase.from("productos").select("id, sede_id, nombre").eq("active", true).order("nombre")
      : Promise.resolve({ data: [] as { id: string; sede_id: string | null; nombre: string }[] }),
    isAdmin && tramitadorIds.length
      ? supabase
          .from("tramitador_precios")
          .select("id, tramitador_id, producto_id, precio_especial")
          .in("tramitador_id", tramitadorIds)
      : Promise.resolve({
          data: [] as { id: string; tramitador_id: string; producto_id: string; precio_especial: number }[],
        }),
    ventaAbonadaIds.length
      ? supabase.from("venta_pagos").select("venta_id, monto").in("venta_id", ventaAbonadaIds)
      : Promise.resolve({ data: [] as { venta_id: string; monto: number }[] }),
  ]);

  const saldoPorId = new Map(saldos.map((s) => [s.id, s]));
  const sedeName = (id: string | null) => (id ? (sedes.find((s) => s.id === id)?.name ?? "—") : "Todas las sedes");
  const productoNombre = (id: string) => (productos ?? []).find((p) => p.id === id)?.nombre ?? "—";
  const pagadoDeVenta = (ventaId: string) =>
    (pagosAbonadasRows ?? []).filter((p) => p.venta_id === ventaId).reduce((acc, p) => acc + p.monto, 0);

  // Cuánto puede realmente cobrarse con "Registrar abono" para un
  // tramitador en una sede puntual: la suma de lo pendiente de sus ventas
  // 'abonada' EN ESA SEDE (mismo alcance que registrar_abono_tramitador,
  // que solo toca ventas de la sede que se le pasa).
  const pendienteVentasPorSede = new Map<string, number>();
  for (const v of ventasRows ?? []) {
    if (v.estado !== "abonada" || !v.tramitador_id) continue;
    const pendiente = v.monto - v.descuento - pagadoDeVenta(v.id);
    const key = `${v.tramitador_id}|${v.sede_id}`;
    pendienteVentasPorSede.set(key, (pendienteVentasPorSede.get(key) ?? 0) + pendiente);
  }

  const filas = (tramitadores ?? []).map((t) => {
    const personas = (ventasRows ?? []).filter((v) => v.tramitador_id === t.id).length;
    const saldo = saldoPorId.get(t.id);
    const defaultSedeId = t.sede_id ?? profile.sede_id ?? sedes[0]?.id ?? null;
    return {
      ...t,
      personas,
      reclamo: saldo?.reclamo ?? 0,
      pagadoClientes: saldo?.pagadoClientes ?? 0,
      pagadoTramitador: saldo?.pagadoTramitador ?? 0,
      saldoAFavor: saldo?.saldoAFavor ?? 0,
      defaultSedeId,
      pendienteVentas: defaultSedeId ? (pendienteVentasPorSede.get(`${t.id}|${defaultSedeId}`) ?? 0) : 0,
    };
  }).map((t) => ({
    ...t,
    // Lo que se le cruza automáticamente al registrar un abono (ver
    // registrar_abono_tramitador): el menor entre lo que ya le debemos y
    // lo que él debe en esa sede — nunca más de lo uno ni de lo otro.
    creditoAplicable: Math.max(0, Math.min(t.saldoAFavor, t.pendienteVentas)),
  }));
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
              <div className="flex flex-wrap items-start justify-between gap-3">
                <TramitadorHeader
                  tramitador={{
                    id: t.id,
                    nombre: t.nombre,
                    sedeId: t.sede_id,
                    precioEspecial: t.precio_especial,
                    active: t.active,
                  }}
                  sedes={sedes}
                  isAdmin={isAdmin}
                  sedeNombre={sedeName(t.sede_id)}
                  personas={t.personas}
                  saldoAFavor={t.saldoAFavor}
                  pagadoClientes={t.pagadoClientes}
                  reclamo={t.reclamo}
                  pagadoTramitador={t.pagadoTramitador}
                />
              </div>
              {t.saldoAFavor < 0 ? (
                <p className="mt-2 text-xs text-red-600">
                  El tramitador nos debe {formatCOP(-t.saldoAFavor)} — sus clientes pagaron menos de lo
                  que le corresponde a la organización por las personas ya registradas.
                </p>
              ) : null}
              <div className="mt-3 flex flex-col gap-3">
                {t.pendienteVentas > 0 ? (
                  <AbonoTramitadorForm
                    tramitadorId={t.id}
                    pendiente={t.pendienteVentas}
                    creditoAplicable={t.creditoAplicable}
                    sedes={sedes}
                    defaultSedeId={t.defaultSedeId}
                  />
                ) : null}
                {t.saldoAFavor > 0 ? (
                  <ComisionTramitadorForm
                    tramitadorId={t.id}
                    saldo={t.saldoAFavor}
                    sedes={sedes}
                    defaultSedeId={t.defaultSedeId}
                  />
                ) : null}
              </div>

              {isAdmin ? (
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
              ) : null}

              {t.personas > 0 ? (
                <div className="mt-3 border-t border-slate-100 pt-3">
                  <ExtractoModal tramitadorId={t.id} tramitadorNombre={t.nombre} />
                </div>
              ) : null}
            </div>
          ))}
          {filas.length === 0 ? (
            <p className="py-6 text-center text-sm text-slate-400">Todavía no hay tramitadores cargados.</p>
          ) : null}
        </div>

        {isAdmin ? (
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
            <button type="submit" className={buttonClass("primary")}>
              Agregar tramitador
            </button>
          </form>
        ) : null}
      </div>
    </div>
  );
}
