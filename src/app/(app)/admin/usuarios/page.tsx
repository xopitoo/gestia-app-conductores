import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getViewerContext } from "@/lib/viewer";
import { ConfirmSubmitButton } from "@/components/confirm-submit-button";
import { toggleUsuarioActive } from "./actions";
import { UsuarioForm } from "./usuario-form";
import { CambiarSedeSelect } from "./cambiar-sede-select";

export const metadata: Metadata = { title: "Usuarios | Gestia App Conductores" };

export default async function UsuariosPage() {
  const { profile, supabase, sedes } = await getViewerContext();
  if (profile.role !== "admin") redirect("/ventas");

  const { data: usuarios } = await supabase
    .from("profiles")
    .select("id, full_name, role, sede_id, active, created_at")
    .eq("organization_id", profile.organization_id!)
    .order("full_name");

  const roleLabel = (r: string) => (r === "admin" ? "Administrador" : "Recepcionista");

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold text-slate-900">Usuarios</h1>
        <p className="mt-1 text-sm text-slate-500">
          Cuentas de tu organización. Un recepcionista solo ve la sede que le asignes acá.
        </p>
      </div>

      <div className="rounded-2xl border border-slate-200 bg-white p-6">
        <div className="overflow-x-auto rounded-xl border border-slate-200">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 text-left text-xs font-medium text-slate-500">
              <tr>
                <th className="px-4 py-2">Nombre</th>
                <th className="px-4 py-2">Rol</th>
                <th className="px-4 py-2">Sede</th>
                <th className="px-4 py-2">Estado</th>
                <th className="px-4 py-2" />
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {(usuarios ?? []).map((u) => (
                <tr key={u.id}>
                  <td className="px-4 py-2.5 font-medium text-slate-800">{u.full_name}</td>
                  <td className="px-4 py-2.5 text-slate-600">{roleLabel(u.role)}</td>
                  <td className="px-4 py-2.5 text-slate-600">
                    {u.role === "admin" ? (
                      "Todas"
                    ) : (
                      <CambiarSedeSelect usuarioId={u.id} sedeActual={u.sede_id} sedes={sedes} />
                    )}
                  </td>
                  <td className="px-4 py-2.5">
                    <span
                      className={`rounded-full px-2 py-0.5 text-[11px] font-medium ${
                        u.active ? "bg-emerald-100 text-emerald-700" : "bg-slate-100 text-slate-500"
                      }`}
                    >
                      {u.active ? "Activo" : "Inactivo"}
                    </span>
                  </td>
                  <td className="px-4 py-2.5 text-right">
                    {u.id === profile.id ? null : (
                      <form action={toggleUsuarioActive}>
                        <input type="hidden" name="id" value={u.id} />
                        <input type="hidden" name="active" value={String(u.active)} />
                        <ConfirmSubmitButton
                          confirmMessage={u.active ? `¿Desactivar a ${u.full_name}?` : `¿Reactivar a ${u.full_name}?`}
                          className="text-xs font-medium text-indigo-700 hover:underline"
                        >
                          {u.active ? "Desactivar" : "Activar"}
                        </ConfirmSubmitButton>
                      </form>
                    )}
                  </td>
                </tr>
              ))}
              {(usuarios ?? []).length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-4 py-6 text-center text-slate-400">
                    Todavía no hay usuarios.
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>

        <UsuarioForm sedes={sedes} />
      </div>
    </div>
  );
}
