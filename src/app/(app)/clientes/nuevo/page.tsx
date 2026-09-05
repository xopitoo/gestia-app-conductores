import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { getViewerContext, requireOpenCaja } from "@/lib/viewer";
import { crearCliente } from "../actions";
import { ClienteForm } from "../cliente-form";

export const metadata: Metadata = { title: "Nuevo cliente | Gestia App Conductores" };

export default async function NuevoClientePage() {
  const ctx = await getViewerContext();
  await requireOpenCaja(ctx);
  const { profile, sedes } = ctx;

  return (
    <div className="flex flex-col gap-6">
      <div>
        <Link
          href="/clientes"
          className="mb-3 inline-flex items-center gap-1.5 text-sm font-medium text-slate-500 hover:text-slate-700"
        >
          <ArrowLeft className="h-4 w-4" />
          Clientes
        </Link>
        <h1 className="text-2xl font-semibold text-slate-900">Nuevo cliente</h1>
        <p className="mt-1 text-sm text-slate-500">
          Completá los datos del cliente. Los biométricos se podrán registrar más adelante.
        </p>
      </div>

      <div className="max-w-2xl rounded-2xl border border-slate-200 bg-white p-6">
        <ClienteForm
          action={crearCliente}
          sedes={sedes}
          showSedeSelect={profile.role === "admin"}
          submitLabel="Crear cliente"
        />
      </div>
    </div>
  );
}
