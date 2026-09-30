import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { getViewerContext, resolveSedeFilter } from "@/lib/viewer";
import { SedeSelect } from "@/components/sede-select";
import { Pagination } from "@/components/pagination";
import { formatCOP, formatDateTime } from "@/lib/format";
import { addDaysUTC, bogotaTodayRange } from "@/lib/bogota-date";
import { METODO_PAGO_LABEL, type MetodoPago } from "@/lib/supabase/types";
import { badgeClass, buttonClass, linkClass } from "@/lib/ui";

export const metadata: Metadata = { title: "Actividad | Gestia App Conductores" };

const PAGE_SIZE = 30;

type TipoEvento = "ingreso" | "egreso" | "correccion";

const TIPO_LABEL: Record<TipoEvento, { label: string; tone: "success" | "danger" | "info" }> = {
  ingreso: { label: "Pago registrado", tone: "success" },
  egreso: { label: "Egreso", tone: "danger" },
  correccion: { label: "Forma de pago corregida", tone: "info" },
};

type Evento = {
  id: string;
  fecha: string;
  tipo: TipoEvento;
  usuarioNombre: string;
  sedeNombre: string;
  clienteNombre: string | null;
  clienteDocumento: string | null;
  tramitadorNombre: string | null;
  concepto: string;
  metodoPago: string | null;
  monto: number | null;
  ventaId: string | null;
};

export default async function ActividadPage({
  searchParams,
}: {
  searchParams: Promise<{
    sede?: string;
    usuario?: string;
    tipo?: string;
    q?: string;
    desde?: string;
    hasta?: string;
    page?: string;
  }>;
}) {
  const params = await searchParams;
  const ctx = await getViewerContext();
  const { supabase, profile, sedes } = ctx;
  if (profile.role !== "admin") redirect("/ventas");

  const sedeFilter = resolveSedeFilter(ctx, params.sede);

  // Por defecto, los últimos 7 días (incluyendo hoy) — un rango de
  // auditoría típico. `hasta` es exclusivo, como en /ventas.
  const { start: hoyInicio, end: hoyFin } = bogotaTodayRange();
  const desde = params.desde || addDaysUTC(hoyInicio, -6).toISOString().slice(0, 10);
  const hasta = params.hasta || hoyFin.toISOString().slice(0, 10);

  const { data: usuariosOrg } = await supabase
    .from("profiles")
    .select("id, full_name")
    .eq("organization_id", profile.organization_id!)
    .order("full_name");

  const tipoParam = params.tipo ?? "";
  const incluirMovimientos = tipoParam === "" || tipoParam === "ingreso" || tipoParam === "egreso";
  const incluirCorrecciones = tipoParam === "" || tipoParam === "correccion";

  let movimientos: {
    id: string;
    tipo: "ingreso" | "egreso";
    concepto: string;
    monto: number;
    metodo_pago: string | null;
    venta_id: string | null;
    tramitador_id: string | null;
    sede_id: string;
    created_by: string;
    created_at: string;
  }[] = [];
  if (incluirMovimientos) {
    let q = supabase
      .from("caja_movimientos")
      .select("id, tipo, concepto, monto, metodo_pago, venta_id, tramitador_id, sede_id, created_by, created_at")
      .gte("created_at", desde)
      .lt("created_at", hasta)
      .order("created_at", { ascending: false })
      .limit(500);
    if (sedeFilter) q = q.eq("sede_id", sedeFilter);
    if (params.usuario) q = q.eq("created_by", params.usuario);
    if (tipoParam === "ingreso" || tipoParam === "egreso") q = q.eq("tipo", tipoParam);
    const { data } = await q;
    movimientos = data ?? [];
  }

  let correcciones: {
    id: string;
    venta_id: string;
    sede_id: string;
    monto: number;
    metodo_pago: string;
    metodo_pago_editado_por: string;
    metodo_pago_editado_at: string;
  }[] = [];
  if (incluirCorrecciones) {
    let q = supabase
      .from("venta_pagos")
      .select("id, venta_id, sede_id, monto, metodo_pago, metodo_pago_editado_por, metodo_pago_editado_at")
      .not("metodo_pago_editado_por", "is", null)
      .gte("metodo_pago_editado_at", desde)
      .lt("metodo_pago_editado_at", hasta)
      .order("metodo_pago_editado_at", { ascending: false })
      .limit(500);
    if (sedeFilter) q = q.eq("sede_id", sedeFilter);
    if (params.usuario) q = q.eq("metodo_pago_editado_por", params.usuario);
    const { data } = await q;
    correcciones = (data ?? []) as typeof correcciones;
  }

  const ventaIds = [
    ...new Set(
      [...movimientos.map((m) => m.venta_id), ...correcciones.map((c) => c.venta_id)].filter(
        (id): id is string => !!id,
      ),
    ),
  ];
  const tramitadorIds = [
    ...new Set(movimientos.map((m) => m.tramitador_id).filter((id): id is string => !!id)),
  ];
  const usuarioIds = [
    ...new Set([...movimientos.map((m) => m.created_by), ...correcciones.map((c) => c.metodo_pago_editado_por)]),
  ];

  const [{ data: ventasRows }, { data: tramitadoresRows }, { data: usuariosRows }] = await Promise.all([
    ventaIds.length
      ? supabase.from("ventas").select("id, cliente_id, concepto").in("id", ventaIds)
      : Promise.resolve({ data: [] as { id: string; cliente_id: string; concepto: string }[] }),
    tramitadorIds.length
      ? supabase.from("tramitadores").select("id, nombre").in("id", tramitadorIds)
      : Promise.resolve({ data: [] as { id: string; nombre: string }[] }),
    usuarioIds.length
      ? supabase.from("profiles").select("id, full_name").in("id", usuarioIds)
      : Promise.resolve({ data: [] as { id: string; full_name: string }[] }),
  ]);

  const clienteIds = [...new Set((ventasRows ?? []).map((v) => v.cliente_id))];
  const { data: clientesRows } = clienteIds.length
    ? await supabase.from("clientes").select("id, nombre_completo, numero_documento").in("id", clienteIds)
    : { data: [] as { id: string; nombre_completo: string; numero_documento: string }[] };

  const ventaInfo = (id: string | null) => (id ? (ventasRows ?? []).find((v) => v.id === id) : undefined);
  const clienteInfo = (id: string) => (clientesRows ?? []).find((c) => c.id === id);
  const tramitadorNombre = (id: string | null) =>
    id ? ((tramitadoresRows ?? []).find((t) => t.id === id)?.nombre ?? null) : null;
  const usuarioNombre = (id: string) => (usuariosRows ?? []).find((u) => u.id === id)?.full_name ?? "—";
  const sedeName = (id: string) => sedes.find((s) => s.id === id)?.name ?? "—";

  const eventos: Evento[] = [];

  for (const m of movimientos) {
    const venta = ventaInfo(m.venta_id);
    const cliente = venta ? clienteInfo(venta.cliente_id) : undefined;
    eventos.push({
      id: `mov-${m.id}`,
      fecha: m.created_at,
      tipo: m.tipo,
      usuarioNombre: usuarioNombre(m.created_by),
      sedeNombre: sedeName(m.sede_id),
      clienteNombre: cliente?.nombre_completo ?? null,
      clienteDocumento: cliente?.numero_documento ?? null,
      tramitadorNombre: tramitadorNombre(m.tramitador_id),
      concepto: m.concepto,
      metodoPago: m.metodo_pago,
      monto: m.monto,
      ventaId: m.venta_id,
    });
  }

  for (const c of correcciones) {
    const venta = ventaInfo(c.venta_id);
    const cliente = venta ? clienteInfo(venta.cliente_id) : undefined;
    eventos.push({
      id: `corr-${c.id}`,
      fecha: c.metodo_pago_editado_at,
      tipo: "correccion",
      usuarioNombre: usuarioNombre(c.metodo_pago_editado_por),
      sedeNombre: sedeName(c.sede_id),
      clienteNombre: cliente?.nombre_completo ?? null,
      clienteDocumento: cliente?.numero_documento ?? null,
      tramitadorNombre: null,
      concepto: venta?.concepto ?? "Corrección de forma de pago",
      metodoPago: c.metodo_pago,
      monto: c.monto,
      ventaId: c.venta_id,
    });
  }

  eventos.sort((a, b) => b.fecha.localeCompare(a.fecha));

  let filtrados = eventos;
  if (params.q) {
    const term = params.q.trim().toLowerCase();
    filtrados = filtrados.filter(
      (e) =>
        e.clienteNombre?.toLowerCase().includes(term) ||
        e.clienteDocumento?.toLowerCase().includes(term) ||
        e.tramitadorNombre?.toLowerCase().includes(term) ||
        e.concepto.toLowerCase().includes(term),
    );
  }

  const page = Math.max(1, Number(params.page) || 1);
  const totalPages = Math.max(1, Math.ceil(filtrados.length / PAGE_SIZE));
  const paginaEventos = filtrados.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold text-slate-900">Actividad</h1>
        <p className="mt-1 text-sm text-slate-500">
          Quién registró o corrigió cada pago, en qué sede y cuándo — pagos de ventas, abonos, abonos de
          tramitador, comisiones y egresos de caja, más las correcciones de forma de pago.
        </p>
      </div>

      <form className="flex flex-wrap items-center gap-2">
        <SedeSelect sedes={sedes} currentSedeId={sedeFilter} allowAll />
        <select
          name="usuario"
          defaultValue={params.usuario ?? ""}
          className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-700 outline-none focus:border-indigo-600"
        >
          <option value="">Todos los usuarios</option>
          {(usuariosOrg ?? []).map((u) => (
            <option key={u.id} value={u.id}>
              {u.full_name}
            </option>
          ))}
        </select>
        <select
          name="tipo"
          defaultValue={params.tipo ?? ""}
          className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-700 outline-none focus:border-indigo-600"
        >
          <option value="">Todo tipo de evento</option>
          <option value="ingreso">Pagos registrados</option>
          <option value="egreso">Egresos</option>
          <option value="correccion">Correcciones de forma de pago</option>
        </select>
        <input
          name="q"
          defaultValue={params.q}
          placeholder="Buscar cliente, documento o tramitador..."
          className="rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900 outline-none focus:border-indigo-600 focus:ring-1 focus:ring-indigo-600"
        />
        <input
          type="date"
          name="desde"
          defaultValue={desde}
          className="rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-700 outline-none focus:border-indigo-600"
        />
        <input
          type="date"
          name="hasta"
          defaultValue={hasta}
          className="rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-700 outline-none focus:border-indigo-600"
        />
        <button type="submit" className={buttonClass("secondary")}>
          Filtrar
        </button>
      </form>

      <div className="overflow-x-auto rounded-2xl border border-slate-200 bg-white">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 text-left text-xs font-medium text-slate-500">
            <tr>
              <th className="px-4 py-3">Fecha</th>
              <th className="px-4 py-3">Usuario</th>
              <th className="px-4 py-3">Sede</th>
              <th className="px-4 py-3">Tipo</th>
              <th className="px-4 py-3">Cliente / Tramitador</th>
              <th className="px-4 py-3">Concepto</th>
              <th className="px-4 py-3">Método</th>
              <th className="px-4 py-3 text-right">Monto</th>
              <th className="px-4 py-3" />
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {paginaEventos.map((e) => {
              const tipoInfo = TIPO_LABEL[e.tipo];
              return (
                <tr key={e.id}>
                  <td className="px-4 py-3 whitespace-nowrap text-slate-500">{formatDateTime(e.fecha)}</td>
                  <td className="px-4 py-3 text-slate-700">{e.usuarioNombre}</td>
                  <td className="px-4 py-3 text-slate-500">{e.sedeNombre}</td>
                  <td className="px-4 py-3">
                    <span className={badgeClass(tipoInfo.tone)}>{tipoInfo.label}</span>
                  </td>
                  <td className="px-4 py-3 font-medium text-slate-800">
                    {e.clienteNombre ?? e.tramitadorNombre ?? "—"}
                  </td>
                  <td className="px-4 py-3 text-slate-600">{e.concepto}</td>
                  <td className="px-4 py-3 text-slate-600">
                    {e.metodoPago ? (METODO_PAGO_LABEL[e.metodoPago as MetodoPago] ?? e.metodoPago) : "—"}
                  </td>
                  <td
                    className={`px-4 py-3 text-right whitespace-nowrap ${
                      e.tipo === "ingreso"
                        ? "text-emerald-600"
                        : e.tipo === "egreso"
                          ? "text-red-600"
                          : "text-slate-500"
                    }`}
                  >
                    {e.monto != null
                      ? `${e.tipo === "ingreso" ? "+" : e.tipo === "egreso" ? "-" : ""}${formatCOP(e.monto)}`
                      : "—"}
                  </td>
                  <td className="px-4 py-3 text-right whitespace-nowrap">
                    {e.ventaId ? (
                      <Link href={`/ventas/${e.ventaId}`} className={linkClass("primary")}>
                        Ver venta
                      </Link>
                    ) : null}
                  </td>
                </tr>
              );
            })}
            {paginaEventos.length === 0 ? (
              <tr>
                <td colSpan={9} className="px-4 py-8 text-center text-slate-400">
                  Sin actividad en este período con esos filtros.
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>

      <Pagination
        page={page}
        totalPages={totalPages}
        basePath="/admin/actividad"
        searchParams={{
          sede: params.sede,
          usuario: params.usuario,
          tipo: params.tipo,
          q: params.q,
          desde: params.desde,
          hasta: params.hasta,
        }}
      />
    </div>
  );
}
