import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getViewerContext } from "@/lib/viewer";
import { ConfirmSubmitButton } from "@/components/confirm-submit-button";
import { formatCOP } from "@/lib/format";
import { crearProducto, toggleProductoActive } from "./actions";

export const metadata: Metadata = { title: "Productos | Gestia App Conductores" };

export default async function ProductosPage() {
  const { profile, supabase, sedes } = await getViewerContext();
  if (profile.role !== "admin") redirect("/ventas");

  const { data: productos } = await supabase
    .from("productos")
    .select("id, sede_id, nombre, descripcion, precio, categoria, active")
    .order("nombre");

  const grupos = [
    ...sedes.map((s) => ({
      key: s.id,
      nombre: s.name,
      items: (productos ?? []).filter((p) => p.sede_id === s.id),
    })),
    {
      key: "todas",
      nombre: "Todas las sedes",
      items: (productos ?? []).filter((p) => p.sede_id === null),
    },
  ].filter((g) => g.items.length > 0);

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold text-slate-900">Productos</h1>
        <p className="mt-1 text-sm text-slate-500">
          Un producto sin sede asignada aparece en todas; si le asignás una sede puntual, solo se puede
          vender ahí — útil para catálogos que no tienen nada que ver entre sí.
        </p>
      </div>

      <div className="rounded-2xl border border-slate-200 bg-white p-6">
        <div className="flex flex-col gap-3">
          {grupos.map((g, idx) => (
            <details
              key={g.key}
              open={idx === 0}
              className="group rounded-xl border border-slate-200 [&_summary::-webkit-details-marker]:hidden"
            >
              <summary className="flex cursor-pointer list-none items-center justify-between gap-3 px-4 py-3">
                <span className="font-semibold text-slate-800">{g.nombre}</span>
                <span className="flex items-center gap-2">
                  <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[11px] font-medium text-slate-500">
                    {g.items.length} {g.items.length === 1 ? "producto" : "productos"}
                  </span>
                  <svg
                    className="h-4 w-4 shrink-0 text-slate-400 transition-transform group-open:rotate-180"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                  >
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                  </svg>
                </span>
              </summary>
              <div className="overflow-x-auto border-t border-slate-200">
                <table className="w-full text-sm">
                  <thead className="bg-slate-50 text-left text-xs font-medium text-slate-500">
                    <tr>
                      <th className="px-4 py-2">Nombre</th>
                      <th className="px-4 py-2">Descripción</th>
                      <th className="px-4 py-2">Categoría</th>
                      <th className="px-4 py-2">Precio</th>
                      <th className="px-4 py-2">Estado</th>
                      <th className="px-4 py-2" />
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {g.items.map((p) => (
                      <tr key={p.id}>
                        <td className="px-4 py-2.5 font-medium text-slate-800">{p.nombre}</td>
                        <td className="px-4 py-2.5 text-slate-600">{p.descripcion ?? "—"}</td>
                        <td className="px-4 py-2.5 text-slate-600 capitalize">{p.categoria ?? "—"}</td>
                        <td className="px-4 py-2.5 text-slate-600">{formatCOP(p.precio)}</td>
                        <td className="px-4 py-2.5">
                          <span
                            className={`rounded-full px-2 py-0.5 text-[11px] font-medium ${
                              p.active ? "bg-emerald-100 text-emerald-700" : "bg-slate-100 text-slate-500"
                            }`}
                          >
                            {p.active ? "Activo" : "Inactivo"}
                          </span>
                        </td>
                        <td className="px-4 py-2.5 text-right">
                          <form action={toggleProductoActive}>
                            <input type="hidden" name="id" value={p.id} />
                            <input type="hidden" name="active" value={String(p.active)} />
                            <ConfirmSubmitButton
                              confirmMessage={p.active ? `¿Desactivar ${p.nombre}?` : `¿Reactivar ${p.nombre}?`}
                              className="text-xs font-medium text-indigo-700 hover:underline"
                            >
                              {p.active ? "Desactivar" : "Activar"}
                            </ConfirmSubmitButton>
                          </form>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </details>
          ))}
          {grupos.length === 0 ? (
            <p className="py-6 text-center text-sm text-slate-400">Todavía no hay productos cargados.</p>
          ) : null}
        </div>

        <form action={crearProducto} className="mt-6 grid grid-cols-1 gap-2 border-t border-slate-200 pt-4 sm:grid-cols-6">
          <input
            name="nombre"
            required
            placeholder="Nombre del producto"
            className="rounded-lg border border-slate-300 px-3.5 py-2 text-sm text-slate-900 outline-none focus:border-indigo-600 focus:ring-1 focus:ring-indigo-600"
          />
          <input
            name="descripcion"
            placeholder="Descripción (opcional)"
            className="rounded-lg border border-slate-300 px-3.5 py-2 text-sm text-slate-900 outline-none focus:border-indigo-600 focus:ring-1 focus:ring-indigo-600"
          />
          <select
            name="categoria"
            defaultValue=""
            className="rounded-lg border border-slate-300 bg-white px-3.5 py-2 text-sm text-slate-700 outline-none focus:border-indigo-600"
          >
            <option value="">Sin categoría</option>
            <option value="individual">Individual</option>
            <option value="multiple">Múltiple</option>
          </select>
          <select
            name="sede_id"
            defaultValue=""
            className="rounded-lg border border-slate-300 bg-white px-3.5 py-2 text-sm text-slate-700 outline-none focus:border-indigo-600"
          >
            <option value="">Todas las sedes</option>
            {sedes.map((s) => (
              <option key={s.id} value={s.id}>
                Solo {s.name}
              </option>
            ))}
          </select>
          <input
            name="precio"
            type="number"
            min={0}
            step="1"
            required
            placeholder="Precio"
            className="rounded-lg border border-slate-300 px-3.5 py-2 text-sm text-slate-900 outline-none focus:border-indigo-600 focus:ring-1 focus:ring-indigo-600"
          />
          <button
            type="submit"
            className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white shadow-sm shadow-indigo-600/20 transition hover:bg-indigo-700"
          >
            Agregar producto
          </button>
        </form>
      </div>
    </div>
  );
}
