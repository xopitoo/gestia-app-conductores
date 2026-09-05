import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { getViewerContext, resolveSedeFilter } from "@/lib/viewer";
import { SedeSelect } from "@/components/sede-select";
import { formatCOP, formatDateTime } from "@/lib/format";
import { DescuentoForm } from "./descuento-form";

export const metadata: Metadata = { title: "Clientes en mora | Gestia App Conductores" };

type Fila = {
  ventaId: string;
  sedeId: string;
  concepto: string;
  monto: number;
  descuento: number;
  pagado: number;
  saldo: number;
  createdAt: string;
};

export default async function MoraPage({
  searchParams,
}: {
  searchParams: Promise<{ sede?: string }>;
}) {
  const { sede: sedeParam } = await searchParams;
  const ctx = await getViewerContext();
  const { supabase, profile, sedes } = ctx;
  if (profile.role !== "admin") redirect("/dashboard");
  const sedeFilter = resolveSedeFilter(ctx, sedeParam);

  let query = supabase
    .from("ventas")
    .select("id, sede_id, cliente_id, concepto, monto, descuento, created_at")
    .eq("estado", "abonada")
    .order("created_at", { ascending: true });
  if (sedeFilter) query = query.eq("sede_id", sedeFilter);
  const { data: ventas } = await query;

  const ventaIds = (ventas ?? []).map((v) => v.id);
  const clienteIds = [...new Set((ventas ?? []).map((v) => v.cliente_id))];

  const [{ data: pagosRows }, { data: clientesRows }] = await Promise.all([
    ventaIds.length
      ? supabase.from("venta_pagos").select("venta_id, monto").in("venta_id", ventaIds)
      : Promise.resolve({ data: [] as { venta_id: string; monto: number }[] }),
    clienteIds.length
      ? supabase
          .from("clientes")
          .select("id, nombre_completo, numero_documento, tipo_documento, telefono, telefono_pais")
          .in("id", clienteIds)
      : Promise.resolve({ data: [] as { id: string; nombre_completo: string; numero_documento: string; tipo_documento: string; telefono: string | null; telefono_pais: string }[] }),
  ]);

  const pagadoDeVenta = (id: string) =>
    (pagosRows ?? []).filter((p) => p.venta_id === id).reduce((acc, p) => acc + p.monto, 0);
  const sedeName = (id: string) => sedes.find((s) => s.id === id)?.name ?? "—";
  const clienteInfo = (id: string) => clientesRows?.find((c) => c.id === id);

  const porCliente = new Map<string, { clienteId: string; filas: Fila[]; totalSaldo: number }>();
  for (const v of ventas ?? []) {
    const pagado = pagadoDeVenta(v.id);
    const saldo = v.monto - v.descuento - pagado;
    if (saldo <= 0) continue;
    const entry = porCliente.get(v.cliente_id) ?? { clienteId: v.cliente_id, filas: [], totalSaldo: 0 };
    entry.filas.push({
      ventaId: v.id,
      sedeId: v.sede_id,
      concepto: v.concepto,
      monto: v.monto,
      descuento: v.descuento,
      pagado,
      saldo,
      createdAt: v.created_at,
    });
    entry.totalSaldo += saldo;
    porCliente.set(v.cliente_id, entry);
  }

  const filasClientes = [...porCliente.values()].sort((a, b) => b.totalSaldo - a.totalSaldo);
  const totalGeneral = filasClientes.reduce((acc, c) => acc + c.totalSaldo, 0);

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-slate-900">Clientes en mora</h1>
          <p className="mt-1 text-sm text-slate-500">
            Clientes con saldo pendiente en alguna orden. Podés aplicar un descuento para saldar o
            reducir la deuda.
          </p>
        </div>
        <SedeSelect sedes={sedes} currentSedeId={sedeFilter} allowAll />
      </div>

      <div className="rounded-2xl border border-slate-200 bg-white p-5">
        <h2 className="text-xs font-semibold tracking-wide text-slate-500 uppercase">
          Total pendiente por cobrar
        </h2>
        <p className="mt-2 text-2xl font-semibold text-amber-600">{formatCOP(totalGeneral)}</p>
        <p className="mt-1 text-xs text-slate-400">
          {filasClientes.length} {filasClientes.length === 1 ? "cliente" : "clientes"} con saldo pendiente
        </p>
      </div>

      {filasClientes.length === 0 ? (
        <div className="rounded-2xl border border-slate-200 bg-white p-8 text-center text-sm text-slate-400">
          No hay clientes en mora en este momento.
        </div>
      ) : (
        <div className="flex flex-col gap-4">
          {filasClientes.map((c) => {
            const cliente = clienteInfo(c.clienteId);
            return (
              <div key={c.clienteId} className="rounded-2xl border border-slate-200 bg-white p-5">
                <div className="flex items-center justify-between gap-3">
                  <div className="min-w-0">
                    <h3 className="truncate font-semibold text-slate-900">
                      {cliente?.nombre_completo ?? "Cliente"}
                    </h3>
                    <p className="text-xs text-slate-500">
                      {cliente?.tipo_documento} {cliente?.numero_documento}
                      {cliente?.telefono ? ` · ${cliente.telefono_pais} ${cliente.telefono}` : ""}
                    </p>
                  </div>
                  <span className="shrink-0 text-lg font-semibold text-amber-600">
                    {formatCOP(c.totalSaldo)}
                  </span>
                </div>

                <ul className="mt-4 flex flex-col divide-y divide-slate-100">
                  {c.filas.map((f) => (
                    <li
                      key={f.ventaId}
                      className="flex flex-col gap-3 py-3 sm:flex-row sm:items-start sm:justify-between"
                    >
                      <div className="min-w-0">
                        <Link
                          href={`/ventas/${f.ventaId}`}
                          className="text-sm font-medium text-indigo-700 hover:underline"
                        >
                          {f.concepto}
                        </Link>
                        <p className="text-xs text-slate-400">
                          {sedeName(f.sedeId)} · {formatDateTime(f.createdAt)}
                        </p>
                        <p className="mt-1 text-xs text-slate-500">
                          Pagado {formatCOP(f.pagado)} de {formatCOP(f.monto - f.descuento)}
                          {f.descuento > 0 ? ` (descuento actual: ${formatCOP(f.descuento)})` : ""}
                        </p>
                      </div>
                      <div className="shrink-0">
                        <DescuentoForm
                          ventaId={f.ventaId}
                          montoBruto={f.monto}
                          pagado={f.pagado}
                          descuentoActual={f.descuento}
                        />
                      </div>
                    </li>
                  ))}
                </ul>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
