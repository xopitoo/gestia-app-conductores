"use client";

import { useEffect, useState } from "react";
import { X } from "lucide-react";
import Link from "next/link";
import { formatCOP, formatDateTime } from "@/lib/format";

const ESTADO_LABEL: Record<string, { label: string; className: string }> = {
  pagada: { label: "Pagada", className: "bg-emerald-100 text-emerald-700" },
  abonada: { label: "Abonada", className: "bg-amber-100 text-amber-700" },
};

export type PersonaDelTramitador = {
  ventaId: string;
  createdAt: string;
  clienteNombre: string;
  estado: string;
  pagado: number;
  total: number;
  precioTramitador: number;
};

/**
 * Ventana flotante en vez de una tabla inline — con un tramitador de
 * cientos de personas, un <details> expandido en la propia página vuelve
 * la lista de tramitadores kilométrica. Acá el scroll queda contenido
 * dentro del modal.
 */
export function PersonasModal({
  tramitadorNombre,
  personas,
}: {
  tramitadorNombre: string;
  personas: PersonaDelTramitador[];
}) {
  const [abierto, setAbierto] = useState(false);

  useEffect(() => {
    if (!abierto) return;
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") setAbierto(false);
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [abierto]);

  if (personas.length === 0) return null;

  return (
    <>
      <button
        type="button"
        onClick={() => setAbierto(true)}
        className="text-xs font-medium text-indigo-700 hover:underline"
      >
        Ver {personas.length} {personas.length === 1 ? "persona" : "personas"}
      </button>

      {abierto ? (
        <div
          role="dialog"
          aria-modal="true"
          aria-label={`Personas de ${tramitadorNombre}`}
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
          onClick={() => setAbierto(false)}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="flex max-h-[80vh] w-full max-w-3xl flex-col rounded-2xl bg-white shadow-xl"
          >
            <div className="flex items-center justify-between border-b border-slate-200 px-5 py-4">
              <div>
                <h2 className="font-semibold text-slate-900">{tramitadorNombre}</h2>
                <p className="text-xs text-slate-500">
                  {personas.length} {personas.length === 1 ? "persona" : "personas"}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setAbierto(false)}
                className="flex h-8 w-8 items-center justify-center rounded-lg text-slate-400 hover:bg-slate-100 hover:text-slate-700"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="overflow-y-auto px-5 py-3">
              <table className="w-full text-xs">
                <thead>
                  <tr className="sticky top-0 border-b border-slate-200 bg-white text-left text-slate-500">
                    <th className="py-1.5 pr-2 font-medium">Fecha</th>
                    <th className="py-1.5 pr-2 font-medium">Cliente</th>
                    <th className="py-1.5 pr-2 font-medium">Estado</th>
                    <th className="py-1.5 pr-2 text-right font-medium">Pagado</th>
                    <th className="py-1.5 pr-2 text-right font-medium">Total</th>
                    <th className="py-1.5 pl-2 text-right font-medium">Precio especial</th>
                  </tr>
                </thead>
                <tbody>
                  {personas.map((p) => {
                    const estado = ESTADO_LABEL[p.estado] ?? ESTADO_LABEL.pagada;
                    return (
                      <tr key={p.ventaId} className="border-b border-slate-100">
                        <td className="py-1.5 pr-2 whitespace-nowrap text-slate-500">
                          {formatDateTime(p.createdAt)}
                        </td>
                        <td className="py-1.5 pr-2">
                          <Link
                            href={`/ventas/${p.ventaId}`}
                            className="font-medium text-indigo-700 hover:underline"
                          >
                            {p.clienteNombre}
                          </Link>
                        </td>
                        <td className="py-1.5 pr-2">
                          <span className={`rounded-full px-2 py-0.5 text-[11px] font-medium ${estado.className}`}>
                            {estado.label}
                          </span>
                        </td>
                        <td className="py-1.5 pr-2 text-right text-slate-700">{formatCOP(p.pagado)}</td>
                        <td className="py-1.5 pr-2 text-right text-slate-700">{formatCOP(p.total)}</td>
                        <td className="py-1.5 pl-2 text-right font-medium text-slate-900">
                          {formatCOP(p.precioTramitador)}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}
