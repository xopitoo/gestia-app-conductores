import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { ProvisionForm } from "./provision-form";

export const metadata: Metadata = { title: "Nueva organización | Plataforma" };

export default function NuevaOrganizacionPage() {
  return (
    <div className="flex flex-col gap-6">
      <div>
        <Link
          href="/platform"
          className="mb-3 inline-flex items-center gap-1.5 text-sm font-medium text-slate-500 hover:text-slate-700"
        >
          <ArrowLeft className="h-4 w-4" />
          Organizaciones
        </Link>
        <h1 className="text-2xl font-semibold text-slate-900">Nueva organización</h1>
        <p className="mt-1 text-sm text-slate-500">
          Provisioná una escuela de conducción nueva: su organización, primera sede y cuenta admin.
        </p>
      </div>

      <div className="max-w-2xl rounded-2xl border border-slate-200 bg-white p-6">
        <ProvisionForm />
      </div>
    </div>
  );
}
