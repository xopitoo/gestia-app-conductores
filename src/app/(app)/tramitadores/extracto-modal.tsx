"use client";

import { useState, useTransition } from "react";
import { X } from "lucide-react";
import Link from "next/link";
import { formatCOP, formatDateTime } from "@/lib/format";
import { iconButtonClass, linkClass } from "@/lib/ui";
import { obtenerExtractoTramitador } from "./actions";
import type { MovimientoExtracto } from "@/lib/tramitador-saldo";

/**
 * Extracto tipo bancario: una fila por cada venta suya (aporta crédito si
 * quedó pagada, deuda si quedó pendiente — mismo cálculo que
 * tramitadores_saldo en schema.sql) y una por cada pago que ya se le hizo,
 * con saldo acumulado corrido — para responder "¿de dónde salió este
 * número?" sin tener que hacer la cuenta a mano.
 *
 * Se pide bajo demanda (al abrir), no viene precargado por props como
 * PersonasModal — así la página no dispara un RPC por cada tramitador
 * listado, solo por el que realmente se abre.
 */
export function ExtractoModal({ tramitadorId, tramitadorNombre }: { tramitadorId: string; tramitadorNombre: string }) {
  const [abierto, setAbierto] = useState(false);
  const [movimientos, setMovimientos] = useState<MovimientoExtracto[] | null>(null);
  const [pending, startTransition] = useTransition();

  function abrir() {
    setAbierto(true);
    if (movimientos === null) {
      startTransition(async () => {
        const data = await obtenerExtractoTramitador(tramitadorId);
        setMovimientos(data);
      });
    }
  }

  return (
    <>
      <button type="button" onClick={abrir} className={linkClass("primary")}>
        Ver extracto
      </button>

      {abierto ? (
        <div
          role="dialog"
          aria-modal="true"
          aria-label={`Extracto de ${tramitadorNombre}`}
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
          onClick={() => setAbierto(false)}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="flex max-h-[80vh] w-full max-w-4xl flex-col rounded-2xl bg-white shadow-xl"
          >
            <div className="flex items-center justify-between border-b border-slate-200 px-5 py-4">
              <div>
                <h2 className="font-semibold text-slate-900">Extracto — {tramitadorNombre}</h2>
                <p className="text-xs text-slate-500">
                  Cada venta suya y cada pago que ya se le hizo, en orden, con el saldo acumulado.
                </p>
              </div>
              <button type="button" onClick={() => setAbierto(false)} className={iconButtonClass("sm")}>
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="overflow-y-auto px-5 py-3">
              {pending || movimientos === null ? (
                <p className="py-8 text-center text-sm text-slate-400">Cargando...</p>
              ) : movimientos.length === 0 ? (
                <p className="py-8 text-center text-sm text-slate-400">Todavía no hay movimientos.</p>
              ) : (
                <table className="w-full text-xs">
                  <thead>
                    <tr className="sticky top-0 border-b border-slate-200 bg-white text-left text-slate-500">
                      <th className="py-1.5 pr-2 font-medium">Fecha</th>
                      <th className="py-1.5 pr-2 font-medium">Movimiento</th>
                      <th className="py-1.5 pr-2 text-right font-medium">Aporte</th>
                      <th className="py-1.5 pl-2 text-right font-medium">Saldo acumulado</th>
                    </tr>
                  </thead>
                  <tbody>
                    {movimientos.map((m) => (
                      <tr key={`${m.tipo}-${m.referenciaId}`} className="border-b border-slate-100">
                        <td className="py-1.5 pr-2 whitespace-nowrap text-slate-500">{formatDateTime(m.fecha)}</td>
                        <td className="py-1.5 pr-2">
                          {m.tipo === "venta" ? (
                            <>
                              <Link href={`/ventas/${m.referenciaId}`} className="font-medium text-indigo-700 hover:underline">
                                {m.descripcion}
                              </Link>
                              <p className="text-[11px] text-slate-400">
                                Pagado {formatCOP(m.pagado ?? 0)} de {formatCOP(m.total ?? 0)}
                              </p>
                            </>
                          ) : (
                            <p className="font-medium text-slate-700">{m.descripcion}</p>
                          )}
                        </td>
                        <td
                          className={`py-1.5 pr-2 text-right font-medium ${
                            m.monto > 0 ? "text-emerald-600" : m.monto < 0 ? "text-red-600" : "text-slate-400"
                          }`}
                        >
                          {m.monto > 0 ? "+" : ""}
                          {formatCOP(m.monto)}
                        </td>
                        <td className="py-1.5 pl-2 text-right font-semibold text-slate-900">
                          {formatCOP(m.saldoAcumulado)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}
