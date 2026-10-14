import type { Metadata } from "next";
import { getViewerContext } from "@/lib/viewer";
import { CotizadorRapido } from "./cotizador-rapido";
import { SoatTabla } from "./soat-tabla";

export const metadata: Metadata = { title: "Precios SOAT | Gestia App Conductores" };

export default async function SoatPage() {
  const { supabase, profile } = await getViewerContext();
  const esAdmin = profile.role === "admin";

  const { data: tarifasRaw } = await supabase.from("soat_tarifas").select("*").order("orden");
  const tarifas = tarifasRaw ?? [];
  const anio = tarifas[0]?.anio;

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold text-slate-900">Precios SOAT{anio ? ` ${anio}` : ""}</h1>
        <p className="mt-1 text-sm text-slate-500">
          Tarifario oficial por tipo y rango de vehículo, para cotizarle al cliente sin salir de Gestia.
        </p>
      </div>

      {tarifas.length === 0 ? (
        <div className="rounded-2xl border border-slate-200 bg-white p-8 text-center text-sm text-slate-400">
          Todavía no hay tarifas de SOAT cargadas.
        </div>
      ) : (
        <>
          <CotizadorRapido tarifas={tarifas} />
          <details className="group rounded-2xl [&_summary::-webkit-details-marker]:hidden">
            <summary className="cursor-pointer list-none text-sm font-medium text-slate-500 hover:text-slate-700">
              Ver tabla completa
            </summary>
            <div className="mt-3">
              <SoatTabla tarifas={tarifas} esAdmin={esAdmin} />
            </div>
          </details>
        </>
      )}
    </div>
  );
}
