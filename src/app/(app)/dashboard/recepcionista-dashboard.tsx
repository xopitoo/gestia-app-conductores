import Link from "next/link";
import { Lock, LockOpen, ShoppingBag, UserPlus } from "lucide-react";
import { formatCOP, formatDate, formatTime } from "@/lib/format";

export type FilaVentaHoy = {
  id: string;
  createdAt: string;
  clienteNombre: string;
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

/**
 * Dashboard del recepcionista: sin gráficas ni rankings (eso es solo para
 * admin) — una lista de las ventas de hoy en su sede, con lo abonado y lo
 * que todavía deben, más los egresos del día si hubo alguno.
 */
export function RecepcionistaDashboard({
  ventas,
  egresos,
  cajaAbierta,
}: {
  ventas: FilaVentaHoy[];
  egresos: FilaEgresoHoy[];
  cajaAbierta: boolean;
}) {
  const hoy = new Date().toISOString();

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold text-slate-900">Dashboard</h1>
        <p className="mt-1 text-sm text-slate-500">Ventas de hoy, {formatDate(hoy)}</p>
      </div>

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

      <div className="overflow-x-auto rounded-2xl border border-slate-200 bg-white">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 text-left text-xs font-medium text-slate-500">
            <tr>
              <th className="px-4 py-3">Factura</th>
              <th className="px-4 py-3">Fecha</th>
              <th className="px-4 py-3">Hora</th>
              <th className="px-4 py-3 text-right">Abonado</th>
              <th className="px-4 py-3 text-right">Debe</th>
              <th className="px-4 py-3">Cliente</th>
              <th className="px-4 py-3">Método</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {ventas.map((v) => (
              <tr key={v.id}>
                <td className="px-4 py-3 font-mono text-xs">
                  <Link href={`/ventas/${v.id}`} className="text-indigo-700 hover:underline">
                    #{v.id.slice(0, 8).toUpperCase()}
                  </Link>
                </td>
                <td className="px-4 py-3 text-slate-500">{formatDate(v.createdAt)}</td>
                <td className="px-4 py-3 text-slate-500">{formatTime(v.createdAt)}</td>
                <td className="px-4 py-3 text-right font-medium text-emerald-600">
                  {formatCOP(v.abonado)}
                </td>
                <td
                  className={`px-4 py-3 text-right font-medium ${
                    v.debe > 0 ? "text-amber-700" : "text-slate-400"
                  }`}
                >
                  {v.debe > 0 ? formatCOP(v.debe) : "—"}
                </td>
                <td className="px-4 py-3 font-medium text-slate-800">{v.clienteNombre}</td>
                <td className="px-4 py-3 text-slate-600">{v.metodos || "—"}</td>
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
        <div className="rounded-2xl border border-slate-200 bg-white p-5">
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
    </div>
  );
}
