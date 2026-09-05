import type { Metadata } from "next";
import Link from "next/link";
import { Printer } from "lucide-react";
import { getViewerContext, resolveSedeId } from "@/lib/viewer";
import { SedeSelect } from "@/components/sede-select";
import { formatCOP, formatDateTime } from "@/lib/format";
import { bogotaTodayRange } from "@/lib/bogota-date";
import { AbrirCajaForm, CerrarCajaForm, RegistrarEgresoForm } from "./caja-forms";
import { METODO_PAGO_LABEL, type CajaMovimientoRow } from "@/lib/supabase/types";

export const metadata: Metadata = { title: "Caja | Gestia App Conductores" };

export default async function CajaPage({
  searchParams,
}: {
  searchParams: Promise<{ sede?: string; sesion?: string; abrir?: string; cerrar?: string }>;
}) {
  const { sede: sedeParam, sesion: sesionParam, abrir, cerrar } = await searchParams;
  const ctx = await getViewerContext();
  const { supabase, profile, sedes } = ctx;
  const sedeId = resolveSedeId(ctx, sedeParam);

  if (!sedeId) {
    return (
      <div className="rounded-2xl border border-slate-200 bg-white p-8 text-center text-slate-500">
        Todavía no hay sedes configuradas para esta organización.
      </div>
    );
  }

  const { data: sesionAbierta } = await supabase
    .from("caja_sesiones")
    .select("id, opened_by, opened_at, opening_balance, estado")
    .eq("sede_id", sedeId)
    .eq("estado", "abierta")
    .maybeSingle();

  const { start: inicioHoy, end: finHoy } = bogotaTodayRange();

  // El recepcionista solo ve las cajas de hoy (para eso está: abrir,
  // registrar movimientos, cerrar e imprimir). El admin sí puede repasar
  // el historial completo de una sede para auditorías.
  let historialQuery = supabase
    .from("caja_sesiones")
    .select("id, opened_at, closed_at, opening_balance, closing_balance, estado")
    .eq("sede_id", sedeId)
    .order("opened_at", { ascending: false });
  historialQuery =
    profile.role === "admin"
      ? historialQuery.limit(20)
      : historialQuery.gte("opened_at", inicioHoy.toISOString()).lt("opened_at", finHoy.toISOString());
  const { data: historial } = await historialQuery;

  const sesionIds = (historial ?? []).map((s) => s.id);
  const { data: movimientosSesiones } = sesionIds.length
    ? await supabase
        .from("caja_movimientos")
        .select("id, caja_sesion_id, tipo, concepto, monto, metodo_pago, venta_id, created_at")
        .in("caja_sesion_id", sesionIds)
    : { data: [] as CajaMovimientoRow[] };

  const totalsBySesion = new Map<string, { ingresos: number; egresos: number }>();
  for (const m of movimientosSesiones ?? []) {
    const t = totalsBySesion.get(m.caja_sesion_id) ?? { ingresos: 0, egresos: 0 };
    if (m.tipo === "ingreso") t.ingresos += m.monto;
    else t.egresos += m.monto;
    totalsBySesion.set(m.caja_sesion_id, t);
  }

  const esHoy = (iso: string) => {
    const t = new Date(iso);
    return t >= inicioHoy && t < finHoy;
  };
  const ingresosHoy = (movimientosSesiones ?? [])
    .filter((m) => m.tipo === "ingreso" && esHoy(m.created_at))
    .reduce((acc, m) => acc + m.monto, 0);
  const egresosHoy = (movimientosSesiones ?? [])
    .filter((m) => m.tipo === "egreso" && esHoy(m.created_at))
    .reduce((acc, m) => acc + m.monto, 0);

  const selectedSesionId = sesionParam ?? sesionAbierta?.id ?? null;
  const movimientosDetalle = (movimientosSesiones ?? [])
    .filter((m) => m.caja_sesion_id === selectedSesionId)
    .sort((a, b) => b.created_at.localeCompare(a.created_at));

  // Enriquecer solo los movimientos que se van a mostrar (la sesión
  // seleccionada) con el nombre del cliente, la categoría de los
  // productos y el referido — esos datos no viven en caja_movimientos.
  const ventaIdsDetalle = [
    ...new Set(movimientosDetalle.map((m) => m.venta_id).filter((id): id is string => !!id)),
  ];
  const [{ data: ventasDetalle }, { data: itemsDetalle }] = await Promise.all([
    ventaIdsDetalle.length
      ? supabase.from("ventas").select("id, cliente_id, referido_nombre").in("id", ventaIdsDetalle)
      : Promise.resolve({ data: [] }),
    ventaIdsDetalle.length
      ? supabase.from("venta_items").select("venta_id, producto_id").in("venta_id", ventaIdsDetalle)
      : Promise.resolve({ data: [] }),
  ]);
  const clienteIdsDetalle = [...new Set((ventasDetalle ?? []).map((v) => v.cliente_id))];
  const productoIdsDetalle = [
    ...new Set((itemsDetalle ?? []).map((i) => i.producto_id).filter((id): id is string => !!id)),
  ];
  const [{ data: clientesDetalle }, { data: productosDetalle }] = await Promise.all([
    clienteIdsDetalle.length
      ? supabase.from("clientes").select("id, nombre_completo").in("id", clienteIdsDetalle)
      : Promise.resolve({ data: [] }),
    productoIdsDetalle.length
      ? supabase.from("productos").select("id, categoria").in("id", productoIdsDetalle)
      : Promise.resolve({ data: [] }),
  ]);

  const CATEGORIA_LABEL: Record<string, string> = { individual: "Individual", multiple: "Múltiple" };
  function detalleDeVenta(ventaId: string | null) {
    if (!ventaId) return null;
    const venta = (ventasDetalle ?? []).find((v) => v.id === ventaId);
    if (!venta) return null;
    const clienteNombre =
      (clientesDetalle ?? []).find((c) => c.id === venta.cliente_id)?.nombre_completo ?? "—";
    const productoIds = (itemsDetalle ?? [])
      .filter((i) => i.venta_id === ventaId)
      .map((i) => i.producto_id);
    const categorias = [
      ...new Set(
        productoIds
          .map((pid) => (productosDetalle ?? []).find((p) => p.id === pid)?.categoria)
          .filter((c): c is NonNullable<typeof c> => !!c),
      ),
    ];
    return { clienteNombre, categorias, referido: venta.referido_nombre };
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold text-slate-900">Caja</h1>
        <SedeSelect sedes={sedes} currentSedeId={sedeId} />
      </div>

      {abrir && !sesionAbierta ? (
        <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">
          Abrí la caja para empezar a registrar ventas y clientes.
        </div>
      ) : null}

      {cerrar && sesionAbierta ? (
        <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">
          Tenés que cerrar la caja antes de salir.
        </div>
      ) : null}

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <div className="rounded-2xl border border-slate-200 bg-white p-5">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold text-slate-800">Estado de caja</h2>
            <span
              className={`rounded-full px-2 py-0.5 text-[11px] font-medium ${
                sesionAbierta
                  ? "bg-emerald-100 text-emerald-700"
                  : "bg-slate-100 text-slate-500"
              }`}
            >
              {sesionAbierta ? "Abierta" : "Cerrada"}
            </span>
          </div>
          {sesionAbierta ? (
            <p className="mt-3 text-xs text-slate-500">
              Abierta {formatDateTime(sesionAbierta.opened_at)}
            </p>
          ) : (
            <div className="mt-4">
              <AbrirCajaForm sedeId={sedeId} />
            </div>
          )}
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-5">
          <h2 className="text-sm font-semibold text-slate-800">Ingresos del día</h2>
          <p className="mt-2 text-2xl font-semibold text-emerald-600">
            {formatCOP(ingresosHoy)}
          </p>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-5">
          <h2 className="text-sm font-semibold text-slate-800">Egresos del día</h2>
          <p className="mt-2 text-2xl font-semibold text-red-600">
            {formatCOP(egresosHoy)}
          </p>
        </div>
      </div>

      {sesionAbierta ? (
        <div className="rounded-2xl border border-slate-200 bg-white p-5">
          <h2 className="mb-3 text-sm font-semibold text-slate-800">Registrar egreso</h2>
          <RegistrarEgresoForm sesionId={sesionAbierta.id} sedeId={sedeId} />
        </div>
      ) : null}

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <div className="rounded-2xl border border-slate-200 bg-white p-5">
          <h2 className="mb-3 text-sm font-semibold text-slate-800">Historial de cajas</h2>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="text-left text-xs font-medium text-slate-500">
                <tr>
                  <th className="py-2 pr-3">Apertura</th>
                  <th className="py-2 pr-3">Cierre</th>
                  <th className="py-2 pr-3">Estado</th>
                  <th className="py-2 pr-3">Ingresos</th>
                  <th className="py-2 pr-3">Egresos</th>
                  <th className="py-2 pr-3" />
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {(historial ?? []).map((s) => {
                  const totals = totalsBySesion.get(s.id) ?? { ingresos: 0, egresos: 0 };
                  return (
                    <tr
                      key={s.id}
                      className={`cursor-pointer ${selectedSesionId === s.id ? "bg-indigo-50" : ""}`}
                    >
                      <td className="py-2 pr-3">
                        <a href={`?sede=${sedeId}&sesion=${s.id}`} className="block">
                          {formatDateTime(s.opened_at)}
                        </a>
                      </td>
                      <td className="py-2 pr-3 text-slate-500">
                        {s.closed_at ? formatDateTime(s.closed_at) : "—"}
                      </td>
                      <td className="py-2 pr-3">
                        <span
                          className={`rounded-full px-2 py-0.5 text-[11px] font-medium ${
                            s.estado === "abierta"
                              ? "bg-emerald-100 text-emerald-700"
                              : "bg-slate-100 text-slate-500"
                          }`}
                        >
                          {s.estado === "abierta" ? "Abierta" : "Cerrada"}
                        </span>
                      </td>
                      <td className="py-2 pr-3 text-emerald-600">{formatCOP(totals.ingresos)}</td>
                      <td className="py-2 pr-3 text-red-600">{formatCOP(totals.egresos)}</td>
                      <td className="py-2 pr-3 text-right whitespace-nowrap">
                        {s.estado === "cerrada" ? (
                          <Link
                            href={`/caja/${s.id}/cierre`}
                            className="inline-flex items-center gap-1 text-xs font-medium text-indigo-700 hover:underline"
                          >
                            <Printer className="h-3.5 w-3.5" />
                            Imprimir
                          </Link>
                        ) : null}
                      </td>
                    </tr>
                  );
                })}
                {(historial ?? []).length === 0 ? (
                  <tr>
                    <td colSpan={6} className="py-6 text-center text-slate-400">
                      {profile.role === "admin"
                        ? "Sin cajas registradas todavía."
                        : "Todavía no se abrió una caja hoy."}
                    </td>
                  </tr>
                ) : null}
              </tbody>
            </table>
          </div>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-5">
          <h2 className="mb-3 text-sm font-semibold text-slate-800">Detalle de movimientos</h2>
          {selectedSesionId ? (
            <>
              {sesionAbierta?.id === selectedSesionId ? null : (
                <p className="mb-3 text-xs text-slate-400">Sesión cerrada</p>
              )}
              <ul className="flex flex-col divide-y divide-slate-100">
                {movimientosDetalle.map((m) => {
                  const detalle = detalleDeVenta(m.venta_id);
                  return (
                  <li key={m.id} className="flex items-start justify-between gap-3 py-2.5 text-sm">
                    <div className="min-w-0">
                      <p className="font-medium text-slate-800">
                        {detalle ? detalle.clienteNombre : m.concepto}
                      </p>
                      {detalle ? (
                        <p className="truncate text-xs text-slate-500">{m.concepto}</p>
                      ) : null}
                      <p className="mt-0.5 text-xs text-slate-400">
                        {formatDateTime(m.created_at)} ·{" "}
                        {m.metodo_pago ? (METODO_PAGO_LABEL[m.metodo_pago] ?? m.metodo_pago) : "—"}
                        {detalle && detalle.categorias.length > 0
                          ? ` · ${detalle.categorias.map((c) => CATEGORIA_LABEL[c] ?? c).join(", ")}`
                          : ""}
                      </p>
                      {detalle?.referido ? (
                        <p className="mt-0.5 text-xs text-indigo-600">Referido: {detalle.referido}</p>
                      ) : null}
                    </div>
                    <span
                      className={`shrink-0 ${m.tipo === "ingreso" ? "text-emerald-600" : "text-red-600"}`}
                    >
                      {m.tipo === "ingreso" ? "+" : "-"}
                      {formatCOP(m.monto)}
                    </span>
                  </li>
                  );
                })}
                {movimientosDetalle.length === 0 ? (
                  <li className="py-6 text-center text-slate-400">Sin movimientos.</li>
                ) : null}
              </ul>
              {sesionAbierta?.id === selectedSesionId ? (
                <div className="mt-4 border-t border-slate-200 pt-4">
                  <CerrarCajaForm sesionId={selectedSesionId} />
                </div>
              ) : null}
            </>
          ) : (
            <p className="py-6 text-center text-slate-400">
              Seleccioná una caja del historial para ver sus movimientos.
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
