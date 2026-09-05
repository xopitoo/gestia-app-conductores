import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getViewerContext } from "@/lib/viewer";
import { ConfirmSubmitButton } from "@/components/confirm-submit-button";
import { formatCOP } from "@/lib/format";
import { crearProducto, toggleProductoActive } from "./actions";

export const metadata: Metadata = { title: "Productos | Gestia App Conductores" };

export default async function ProductosPage() {
  const { profile, supabase } = await getViewerContext();
  if (profile.role !== "admin") redirect("/ventas");

  const { data: productos } = await supabase
    .from("productos")
    .select("id, nombre, descripcion, precio, categoria, active")
    .order("nombre");

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold text-slate-900">Productos</h1>
        <p className="mt-1 text-sm text-slate-500">
          Catálogo compartido por todas las sedes de tu organización — se usa al registrar una venta.
        </p>
      </div>

      <div className="rounded-2xl border border-slate-200 bg-white p-6">
        <div className="overflow-x-auto rounded-xl border border-slate-200">
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
              {(productos ?? []).map((p) => (
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
              {(productos ?? []).length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-4 py-6 text-center text-slate-400">
                    Todavía no hay productos cargados.
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>

        <form action={crearProducto} className="mt-4 grid grid-cols-1 gap-2 sm:grid-cols-5">
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
