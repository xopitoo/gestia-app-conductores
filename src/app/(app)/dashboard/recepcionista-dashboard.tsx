import Link from "next/link";
import { ArrowDownRight, ArrowUpRight, Handshake, Lock, LockOpen, ShoppingBag, UserPlus } from "lucide-react";
import { formatCOP, formatDate, formatTime } from "@/lib/format";
import { VentasHoyMotivador } from "./ventas-hoy-motivador";

export type FilaVentaHoy = {
  id: string;
  createdAt: string;
  clienteNombre: string;
  /** Si la venta tiene tramitador, lo que "debe" es deuda de él, no del cliente. */
  tramitadorNombre: string | null;
  metodos: string;
  abonado: number;
  debe: number;
};

export type FilaEgresoHoy = {
  id: string;
  createdAt: string;
  concepto: string;
  monto: number;
  metodo: string | null;
};

export type TramitadorSaldoFila = {
  id: string;
  nombre: string;
  saldoAFavor: number;
};

function iniciales(nombre: string) {
  return nombre
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase())
    .join("");
}

/**
 * Dashboard del recepcionista: sin gráficas ni rankings (eso es solo para
 * admin) — una lista de las ventas de hoy en su sede, con lo abonado y lo
 * que todavía deben, más los egresos del día si hubo alguno.
 */
export function RecepcionistaDashboard({
  ventas,
  egresos,
  cajaAbierta,
  tramitadores,
}: {
  ventas: FilaVentaHoy[];
  egresos: FilaEgresoHoy[];
  cajaAbierta: boolean;
  /** Solo informativo — nunca vacía en sedes sin tramitadores (ej. las escuelas). */
  tramitadores: TramitadorSaldoFila[];
}) {
  const hoy = new Date().toISOString();
  const nosDeben = tramitadores.filter((t) => t.saldoAFavor < 0);
  const lesDebemos = tramitadores.filter((t) => t.saldoAFavor > 0);

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold text-slate-900">Dashboard</h1>
        <p className="mt-1 text-sm text-slate-500">Ventas de hoy, {formatDate(hoy)}</p>
      </div>

      <VentasHoyMotivador cantidad={ventas.length} />

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <Link
          href="/ventas/nueva"
          className="flex items-center justify-center gap-2 rounded-xl bg-indigo-600 px-4 py-3.5 text-sm font-semibold text-white shadow-sm shadow-indigo-600/20 transition hover:bg-indigo-700"
        >
          <ShoppingBag className="h-4.5 w-4.5" aria-hidden="true" />
          Nueva venta
        </Link>
        <Link
          href="/clientes/nuevo"
          className="flex items-center justify-center gap-2 rounded-xl border border-slate-300 bg-white px-4 py-3.5 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
        >
          <UserPlus className="h-4.5 w-4.5" aria-hidden="true" />
          Nuevo cliente
        </Link>
        {cajaAbierta ? (
          <Link
            href="/caja"
            className="flex items-center justify-center gap-2 rounded-xl border border-amber-300 bg-amber-50 px-4 py-3.5 text-sm font-semibold text-amber-800 transition hover:bg-amber-100"
          >
            <Lock className="h-4.5 w-4.5" aria-hidden="true" />
            Cerrar caja
          </Link>
        ) : (
          <Link
            href="/caja?abrir=1"
            className="flex items-center justify-center gap-2 rounded-xl border border-emerald-300 bg-emerald-50 px-4 py-3.5 text-sm font-semibold text-emerald-800 transition hover:bg-emerald-100"
          >
            <LockOpen className="h-4.5 w-4.5" aria-hidden="true" />
            Abrir caja
          </Link>
        )}
      </div>

      <div className="overflow-x-auto rounded-2xl bg-white shadow-sm shadow-slate-200/70">
        <table className="w-full text-sm">
          <thead className="text-left text-xs font-medium text-slate-500">
            <tr>
              <th className="px-4 py-3.5">Factura</th>
              <th className="px-4 py-3.5">Fecha</th>
              <th className="px-4 py-3.5">Hora</th>
              <th className="px-4 py-3.5 text-right">Abonado</th>
              <th className="px-4 py-3.5 text-right">Debe</th>
              <th className="px-4 py-3.5">Cliente</th>
              <th className="px-4 py-3.5">Método</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {ventas.map((v) => (
              <tr key={v.id} className="transition hover:bg-indigo-50/40">
                <td className="px-4 py-3.5 font-mono text-xs">
                  <Link href={`/ventas/${v.id}`} className="text-indigo-700 hover:underline">
                    #{v.id.slice(0, 8).toUpperCase()}
                  </Link>
                </td>
                <td className="px-4 py-3.5 text-slate-500">{formatDate(v.createdAt)}</td>
                <td className="px-4 py-3.5 text-slate-500">{formatTime(v.createdAt)}</td>
                <td className="px-4 py-3.5 text-right font-medium text-emerald-600">
                  {formatCOP(v.abonado)}
                </td>
                <td
                  className={`px-4 py-3.5 text-right font-medium ${
                    v.debe > 0 ? "text-amber-700" : "text-slate-400"
                  }`}
                >
                  {v.debe > 0 ? formatCOP(v.debe) : "—"}
                </td>
                <td className="px-4 py-3.5">
                  <div className="flex items-center gap-2.5">
                    <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-indigo-100 text-[11px] font-bold text-indigo-700">
                      {iniciales(v.clienteNombre) || "?"}
                    </span>
                    <div>
                      <span className="font-medium text-slate-800">{v.clienteNombre}</span>
                      {v.tramitadorNombre ? (
                        <p className="flex items-center gap-1 text-[11px] font-medium text-violet-600">
                          <Handshake className="h-3 w-3 shrink-0" aria-hidden="true" />
                          {v.tramitadorNombre}
                        </p>
                      ) : null}
                    </div>
                  </div>
                </td>
                <td className="px-4 py-3.5">
                  {v.metodos ? (
                    <span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-medium text-slate-600">
                      {v.metodos}
                    </span>
                  ) : (
                    <span className="text-slate-400">—</span>
                  )}
                </td>
              </tr>
            ))}
            {ventas.length === 0 ? (
              <tr>
                <td colSpan={7} className="px-4 py-8 text-center text-slate-400">
                  Todavía no hay ventas registradas hoy.
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>

      {egresos.length > 0 ? (
        <div className="rounded-2xl bg-white p-5 shadow-sm shadow-slate-200/70">
          <h2 className="mb-3 text-sm font-semibold text-slate-800">Egresos de hoy</h2>
          <ul className="flex flex-col divide-y divide-slate-100">
            {egresos.map((e) => (
              <li key={e.id} className="flex items-center justify-between py-2 text-sm">
                <div>
                  <p className="text-slate-700">{e.concepto}</p>
                  <p className="text-xs text-slate-400">
                    {formatTime(e.createdAt)}
                    {e.metodo ? ` · ${e.metodo}` : ""}
                  </p>
                </div>
                <span className="font-medium text-red-600">−{formatCOP(e.monto)}</span>
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      {tramitadores.length > 0 ? (
        <div className="rounded-2xl bg-gradient-to-br from-white via-white to-indigo-50/40 p-5 shadow-sm shadow-slate-200/70">
          <h2 className="mb-4 text-sm font-semibold text-slate-800">Valores pendientes</h2>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            {nosDeben.length > 0 ? (
              <div className="rounded-xl bg-red-50/70 p-3.5">
                <div className="mb-2.5 flex items-center gap-1.5">
                  <span className="flex h-6 w-6 items-center justify-center rounded-full bg-red-100">
                    <ArrowDownRight className="h-3.5 w-3.5 text-red-600" aria-hidden="true" />
                  </span>
                  <p className="text-xs font-semibold text-red-700">Nos deben</p>
                </div>
                <ul className="flex flex-col gap-1.5">
                  {nosDeben.map((t) => (
                    <li key={t.id} className="flex items-center justify-between gap-2">
                      <span className="truncate text-sm text-slate-700">{t.nombre}</span>
                      <span className="shrink-0 rounded-full bg-red-100 px-2.5 py-1 text-xs font-bold text-red-700">
                        {formatCOP(-t.saldoAFavor)}
                      </span>
                    </li>
                  ))}
                </ul>
              </div>
            ) : null}
            {lesDebemos.length > 0 ? (
              <div className="rounded-xl bg-emerald-50/70 p-3.5">
                <div className="mb-2.5 flex items-center gap-1.5">
                  <span className="flex h-6 w-6 items-center justify-center rounded-full bg-emerald-100">
                    <ArrowUpRight className="h-3.5 w-3.5 text-emerald-600" aria-hidden="true" />
                  </span>
                  <p className="text-xs font-semibold text-emerald-700">Les debemos</p>
                </div>
                <ul className="flex flex-col gap-1.5">
                  {lesDebemos.map((t) => (
                    <li key={t.id} className="flex items-center justify-between gap-2">
                      <span className="truncate text-sm text-slate-700">{t.nombre}</span>
                      <span className="shrink-0 rounded-full bg-emerald-100 px-2.5 py-1 text-xs font-bold text-emerald-700">
                        {formatCOP(t.saldoAFavor)}
                      </span>
                    </li>
                  ))}
                </ul>
              </div>
            ) : null}
          </div>
        </div>
      ) : null}
    </div>
  );
}
