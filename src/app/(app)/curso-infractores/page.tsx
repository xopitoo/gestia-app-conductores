import type { Metadata } from "next";
import { ChevronDown } from "lucide-react";
import { getViewerContext } from "@/lib/viewer";
import { Calculadora } from "./calculadora";
import { editarPorcentajeCurso } from "./actions";
import { buttonClass } from "@/lib/ui";

export const metadata: Metadata = { title: "Curso de infractores | Gestia App Conductores" };

export default async function CursoInfractoresPage() {
  const { supabase, profile } = await getViewerContext();
  const esAdmin = profile.role === "admin";

  const { data: config } = await supabase
    .from("curso_infractores_config")
    .select("*")
    .eq("organization_id", profile.organization_id!)
    .maybeSingle();

  const porcentajeCurso = config?.porcentaje_curso ?? 0.25;

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold text-slate-900">Curso de infractores</h1>
        <p className="mt-1 text-sm text-slate-500">
          Calculá cuánto le corresponde pagar al cliente por el curso y cuánto le queda de saldo en el SIMIT, según
          la fecha del comparendo o la foto-multa.
        </p>
      </div>

      <div className="rounded-2xl border border-slate-200 bg-white p-5 sm:p-6">
        <Calculadora porcentajeCurso={porcentajeCurso} />
      </div>

      {esAdmin ? (
        <details className="group rounded-2xl border border-slate-200 bg-white [&_summary::-webkit-details-marker]:hidden">
          <summary className="flex cursor-pointer list-none items-center justify-between gap-3 px-5 py-4">
            <span className="font-semibold text-slate-800">Configurar % del curso (admin)</span>
            <ChevronDown className="h-4 w-4 shrink-0 text-slate-400 transition-transform group-open:rotate-180" />
          </summary>
          <form
            action={editarPorcentajeCurso}
            className="flex flex-col gap-2 border-t border-slate-200 p-4 sm:flex-row sm:items-end sm:gap-3"
          >
            <label className="flex flex-col gap-1 text-xs text-slate-500">
              % del monto con descuento que se cobra por el curso
              <input
                name="porcentaje_curso_pct"
                type="number"
                min={0}
                max={100}
                step="0.01"
                defaultValue={(porcentajeCurso * 100).toFixed(2)}
                required
                className="w-48 rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900 outline-none focus:border-indigo-600 focus:ring-1 focus:ring-indigo-600"
              />
            </label>
            <button type="submit" className={buttonClass("primary", "sm")}>
              Guardar
            </button>
          </form>
        </details>
      ) : null}
    </div>
  );
}
