import type { Metadata } from "next";
import { ChevronDown, Plus } from "lucide-react";
import { getViewerContext } from "@/lib/viewer";
import { Calculadora } from "./calculadora";
import { EditarFinanciadoraForm } from "./editar-financiadora-form";
import { crearFinanciadora } from "./actions";
import { buttonClass } from "@/lib/ui";

export const metadata: Metadata = { title: "Simulador de crédito | Gestia App Conductores" };

export default async function SimuladorCreditoPage() {
  const { supabase, profile } = await getViewerContext();
  const esAdmin = profile.role === "admin";

  const { data: financiadorasRaw } = await supabase.from("financiadoras").select("*").order("nombre");
  const todas = financiadorasRaw ?? [];
  const activas = todas.filter((f) => f.active);

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold text-slate-900">Simulador de crédito</h1>
        <p className="mt-1 text-sm text-slate-500">
          Mostrale al cliente la cuota estimada antes de que decida financiar con Brilla, Addi o
          Sistecrédito.
        </p>
      </div>

      <div className="rounded-2xl border border-slate-200 bg-white p-5 sm:p-6">
        <Calculadora financiadoras={activas} />
      </div>

      {esAdmin ? (
        <details className="group rounded-2xl border border-slate-200 bg-white [&_summary::-webkit-details-marker]:hidden">
          <summary className="flex cursor-pointer list-none items-center justify-between gap-3 px-5 py-4">
            <span className="font-semibold text-slate-800">Configurar tasas (admin)</span>
            <ChevronDown className="h-4 w-4 shrink-0 text-slate-400 transition-transform group-open:rotate-180" />
          </summary>
          <div className="overflow-x-auto border-t border-slate-200">
            <table className="w-full text-sm">
              <thead className="bg-slate-50 text-left text-xs font-medium text-slate-500">
                <tr>
                  <th className="px-4 py-2">Financiadora</th>
                  <th className="px-4 py-2">% mensual</th>
                  <th className="px-4 py-2">% seguro deudor</th>
                  <th className="px-4 py-2">Plazo máx.</th>
                  <th className="px-4 py-2">Estado</th>
                  <th className="px-4 py-2" />
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {todas.map((f) => (
                  <EditarFinanciadoraForm key={f.id} financiadora={f} />
                ))}
                {todas.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="px-4 py-6 text-center text-sm text-slate-400">
                      Todavía no hay financiadoras cargadas.
                    </td>
                  </tr>
                ) : null}
              </tbody>
            </table>
          </div>

          <form
            action={crearFinanciadora}
            className="grid grid-cols-1 gap-2 border-t border-slate-200 p-4 sm:grid-cols-5"
          >
            <input
              name="nombre"
              required
              placeholder="Nombre (ej. Addi)"
              className="rounded-lg border border-slate-300 px-3.5 py-2 text-sm text-slate-900 outline-none focus:border-indigo-600 focus:ring-1 focus:ring-indigo-600"
            />
            <input
              name="tasa_mensual_pct"
              type="number"
              min={0}
              step="0.0001"
              placeholder="% mensual"
              className="rounded-lg border border-slate-300 px-3.5 py-2 text-sm text-slate-900 outline-none focus:border-indigo-600 focus:ring-1 focus:ring-indigo-600"
            />
            <input
              name="tasa_seguro_pct"
              type="number"
              min={0}
              step="0.0001"
              placeholder="% seguro deudor"
              className="rounded-lg border border-slate-300 px-3.5 py-2 text-sm text-slate-900 outline-none focus:border-indigo-600 focus:ring-1 focus:ring-indigo-600"
            />
            <input
              name="plazo_max"
              type="number"
              min={1}
              defaultValue={36}
              placeholder="Plazo máx."
              className="rounded-lg border border-slate-300 px-3.5 py-2 text-sm text-slate-900 outline-none focus:border-indigo-600 focus:ring-1 focus:ring-indigo-600"
            />
            <button type="submit" className={buttonClass("primary")}>
              <Plus className="h-4 w-4" />
              Agregar financiadora
            </button>
          </form>
        </details>
      ) : null}
    </div>
  );
}
