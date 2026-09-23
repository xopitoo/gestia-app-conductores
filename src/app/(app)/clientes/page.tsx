import type { Metadata } from "next";
import Link from "next/link";
import { Fingerprint, Search, UserPlus } from "lucide-react";
import { getViewerContext, requireOpenCaja } from "@/lib/viewer";
import { ConfirmSubmitButton } from "@/components/confirm-submit-button";
import { Pagination } from "@/components/pagination";
import { toggleClienteActive } from "./actions";
import { RuntBadge } from "./runt-badge";
import { badgeClass, buttonClass, linkClass } from "@/lib/ui";

export const metadata: Metadata = { title: "Clientes | Gestia App Conductores" };

const PAGE_SIZE = 15;

const TIPO_LABEL: Record<string, string> = {
  CC: "Cédula de ciudadanía",
  TI: "Tarjeta de identidad",
  CE: "Cédula de extranjería",
  PPT: "Permiso por Protección Temporal",
  PASAPORTE: "Pasaporte",
  NIT: "NIT",
};

export default async function ClientesPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; page?: string }>;
}) {
  const { q, page: pageParam } = await searchParams;
  const ctx = await getViewerContext();
  await requireOpenCaja(ctx);
  const { supabase, profile, sedes } = ctx;

  const page = Math.max(1, Number(pageParam) || 1);
  const from = (page - 1) * PAGE_SIZE;
  const to = from + PAGE_SIZE - 1;

  let query = supabase
    .from("clientes")
    .select(
      "id, sede_id, tipo_documento, numero_documento, nombre_completo, telefono_pais, telefono, correo_electronico, fingerprints_enrolled, runt, active",
      { count: "exact" },
    )
    .order("created_at", { ascending: false })
    .range(from, to);

  if (q) {
    query = query.or(`nombre_completo.ilike.%${q}%,numero_documento.ilike.%${q}%`);
  }

  const { data: clientes, count } = await query;
  const totalPages = Math.max(1, Math.ceil((count ?? 0) / PAGE_SIZE));
  const sedeName = (id: string) => sedes.find((s) => s.id === id)?.name ?? "—";

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold text-slate-900">Clientes</h1>
        <Link
          href="/clientes/nuevo"
          className={buttonClass("primary")}
        >
          <UserPlus className="h-4 w-4" />
          Crear nuevo cliente
        </Link>
      </div>

      <form className="flex max-w-md items-center gap-2">
        <div className="relative flex-1">
          <Search className="pointer-events-none absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <input
            name="q"
            defaultValue={q}
            placeholder="Buscar por documento o nombre..."
            className="w-full rounded-lg border border-slate-300 py-2.5 pr-3 pl-9 text-sm text-slate-900 outline-none transition focus:border-indigo-600 focus:ring-1 focus:ring-indigo-600"
          />
        </div>
      </form>

      <div className="overflow-x-auto rounded-2xl border border-slate-200 bg-white">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 text-left text-xs font-medium text-slate-500">
            <tr>
              <th className="px-4 py-3">Tipo de documento</th>
              <th className="px-4 py-3">Número</th>
              <th className="px-4 py-3">Nombre completo</th>
              <th className="px-4 py-3">Contacto</th>
              {profile.role === "admin" ? <th className="px-4 py-3">Sede</th> : null}
              <th className="px-4 py-3">Huellas</th>
              <th className="px-4 py-3">RUNT</th>
              <th className="px-4 py-3">Estado</th>
              <th className="px-4 py-3" />
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {(clientes ?? []).map((cliente) => (
              <tr key={cliente.id}>
                <td className="px-4 py-3 text-slate-600">
                  {TIPO_LABEL[cliente.tipo_documento] ?? cliente.tipo_documento}
                </td>
                <td className="px-4 py-3 font-medium text-slate-800">
                  {cliente.numero_documento}
                </td>
                <td className="px-4 py-3">
                  <Link
                    href={`/clientes/${cliente.id}`}
                    className="font-medium text-indigo-700 hover:underline"
                  >
                    {cliente.nombre_completo}
                  </Link>
                </td>
                <td className="px-4 py-3 text-slate-600">
                  <p>{cliente.telefono_pais} {cliente.telefono}</p>
                  {cliente.correo_electronico ? (
                    <p className="text-xs text-slate-400">{cliente.correo_electronico}</p>
                  ) : null}
                </td>
                {profile.role === "admin" ? (
                  <td className="px-4 py-3 text-slate-600">{sedeName(cliente.sede_id)}</td>
                ) : null}
                <td className="px-4 py-3">
                  <span className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-2 py-0.5 text-[11px] font-medium text-slate-600">
                    <Fingerprint className="h-3 w-3" />
                    {cliente.fingerprints_enrolled}/2
                  </span>
                </td>
                <td className="px-4 py-3">
                  <RuntBadge runt={cliente.runt} />
                </td>
                <td className="px-4 py-3">
                  <span className={badgeClass(cliente.active ? "success" : "neutral")}>
                    {cliente.active ? "Activo" : "Inactivo"}
                  </span>
                </td>
                <td className="px-4 py-3 text-right whitespace-nowrap">
                  <Link
                    href={`/ventas/nueva?sede=${cliente.sede_id}&cliente=${cliente.id}`}
                    className={`mr-3 ${linkClass("primary")}`}
                  >
                    Crear venta
                  </Link>
                  {profile.role === "admin" ? (
                    <>
                      <Link
                        href={`/clientes/${cliente.id}`}
                        className={`mr-3 ${linkClass("primary")}`}
                      >
                        Editar
                      </Link>
                      <form action={toggleClienteActive} className="inline">
                        <input type="hidden" name="id" value={cliente.id} />
                        <input type="hidden" name="active" value={String(cliente.active)} />
                        <ConfirmSubmitButton
                          confirmMessage={
                            cliente.active
                              ? `¿Desactivar a ${cliente.nombre_completo}?`
                              : `¿Reactivar a ${cliente.nombre_completo}?`
                          }
                          className={linkClass(cliente.active ? "destructive" : "success")}
                        >
                          {cliente.active ? "Desactivar" : "Activar"}
                        </ConfirmSubmitButton>
                      </form>
                    </>
                  ) : null}
                </td>
              </tr>
            ))}
            {(clientes ?? []).length === 0 ? (
              <tr>
                <td colSpan={profile.role === "admin" ? 9 : 8} className="px-4 py-8 text-center text-slate-400">
                  {q ? "No hay clientes que coincidan con la búsqueda." : "Todavía no hay clientes cargados."}
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>

      <Pagination page={page} totalPages={totalPages} basePath="/clientes" searchParams={{ q }} />
    </div>
  );
}
