import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getViewerContext } from "@/lib/viewer";
import { PinForm } from "./pin-form";

export const metadata: Metadata = { title: "Seguridad | Gestia App Conductores" };

export default async function SeguridadPage() {
  const { profile, organization, supabase } = await getViewerContext();
  if (profile.role !== "admin") redirect("/ventas");

  // pin_hash no viaja en el contexto compartido (getViewerContext) porque
  // ese mismo objeto lo arma también para recepcionistas — se consulta
  // acá, aparte, solo en esta página admin-only, y solo para saber SI hay
  // uno configurado (nunca se muestra el valor).
  const { data: org } = await supabase
    .from("organizations")
    .select("pin_hash")
    .eq("id", organization.id)
    .single();

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold text-slate-900">Seguridad</h1>
        <p className="mt-1 text-sm text-slate-500">
          PIN de autorización para ventas con menos del 50% de pago inicial. Se lo dictás por
          teléfono a un recepcionista cuando haga falta — nunca se muestra en pantalla.
        </p>
      </div>

      <div className="rounded-2xl border border-slate-200 bg-white p-6">
        <p className="mb-4 text-sm text-slate-600">
          {org?.pin_hash
            ? "Ya hay un PIN configurado. Guardar uno nuevo reemplaza el anterior."
            : "Todavía no hay un PIN configurado — hasta que lo definas, ninguna venta con menos del 50% de pago inicial se puede registrar."}
        </p>
        <PinForm />
      </div>
    </div>
  );
}
