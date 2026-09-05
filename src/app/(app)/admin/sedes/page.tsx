import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getViewerContext } from "@/lib/viewer";
import { ConfirmSubmitButton } from "@/components/confirm-submit-button";
import { crearSede, toggleSedeActive } from "./actions";

export const metadata: Metadata = { title: "Sedes | Gestia App Conductores" };

export default async function SedesPage() {
  const { profile, supabase } = await getViewerContext();
  if (profile.role !== "admin") redirect("/ventas");

  const { data: sedes } = await supabase
    .from("sedes")
    .select("id, name, address, active")
    .order("name");

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold text-slate-900">Sedes</h1>
        <p className="mt-1 text-sm text-slate-500">
          Sedes de tu organización. Cada usuario recepcionista pertenece a una sola sede.
        </p>
      </div>

      <div className="rounded-2xl border border-slate-200 bg-white p-6">
        <div className="overflow-x-auto rounded-xl border border-slate-200">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 text-left text-xs font-medium text-slate-500">
              <tr>
                <th className="px-4 py-2">Nombre</th>
                <th className="px-4 py-2">Dirección</th>
                <th className="px-4 py-2">Estado</th>
                <th className="px-4 py-2" />
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {(sedes ?? []).map((s) => (
                <tr key={s.id}>
                  <td className="px-4 py-2.5 font-medium text-slate-800">{s.name}</td>
                  <td className="px-4 py-2.5 text-slate-600">{s.address ?? "—"}</td>
                  <td className="px-4 py-2.5">
                    <span
                      className={`rounded-full px-2 py-0.5 text-[11px] font-medium ${
                        s.active ? "bg-emerald-100 text-emerald-700" : "bg-slate-100 text-slate-500"
                      }`}
                    >
                      {s.active ? "Activa" : "Inactiva"}
                    </span>
                  </td>
                  <td className="px-4 py-2.5 text-right">
                    <form action={toggleSedeActive}>
                      <input type="hidden" name="id" value={s.id} />
                      <input type="hidden" name="active" value={String(s.active)} />
                      <ConfirmSubmitButton
                        confirmMessage={s.active ? `¿Desactivar ${s.name}?` : `¿Reactivar ${s.name}?`}
                        className="text-xs font-medium text-indigo-700 hover:underline"
                      >
                        {s.active ? "Desactivar" : "Activar"}
                      </ConfirmSubmitButton>
                    </form>
                  </td>
                </tr>
              ))}
              {(sedes ?? []).length === 0 ? (
                <tr>
                  <td colSpan={4} className="px-4 py-6 text-center text-slate-400">
                    Todavía no hay sedes.
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>

        <form action={crearSede} className="mt-4 grid grid-cols-1 gap-2 sm:grid-cols-3">
          <input
            name="name"
            required
            placeholder="Nombre de la sede nueva"
            className="rounded-lg border border-slate-300 px-3.5 py-2 text-sm text-slate-900 outline-none focus:border-indigo-600 focus:ring-1 focus:ring-indigo-600"
          />
          <input
            name="address"
            placeholder="Dirección (opcional)"
            className="rounded-lg border border-slate-300 px-3.5 py-2 text-sm text-slate-900 outline-none focus:border-indigo-600 focus:ring-1 focus:ring-indigo-600"
          />
          <button
            type="submit"
            className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white shadow-sm shadow-indigo-600/20 transition hover:bg-indigo-700"
          >
            Agregar sede
          </button>
        </form>
      </div>
    </div>
  );
}
