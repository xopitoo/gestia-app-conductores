import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { ChevronLeft, ChevronRight, FileText } from "lucide-react";
import { getViewerContext, resolveSedeFilter } from "@/lib/viewer";
import { SedeSelect } from "@/components/sede-select";
import { formatDateTime } from "@/lib/format";
import { bogotaMonthRange } from "@/lib/bogota-date";

export const metadata: Metadata = { title: "Certificados RUNT | Gestia App Conductores" };

const MES_LABEL = [
  "enero", "febrero", "marzo", "abril", "mayo", "junio",
  "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre",
];

function mesAdyacente(yearMonth: string, delta: number) {
  const [y, m] = yearMonth.split("-").map(Number);
  const d = new Date(Date.UTC(y, m - 1 + delta, 1));
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
}

export default async function CertificadosPage({
  searchParams,
}: {
  searchParams: Promise<{ sede?: string; mes?: string }>;
}) {
  const { sede: sedeParam, mes } = await searchParams;
  const ctx = await getViewerContext();
  const { supabase, profile, sedes } = ctx;
  if (profile.role !== "admin") redirect("/dashboard");
  const sedeFilter = resolveSedeFilter(ctx, sedeParam);
  const { start, end, yearMonth } = bogotaMonthRange(mes);
  const [anio, mesNum] = yearMonth.split("-").map(Number);

  let query = supabase
    .from("ventas")
    .select("id, sede_id, cliente_id, concepto, certificado_at, certificado_by, certificado_path")
    .eq("certificado", true)
    .gte("certificado_at", start.toISOString())
    .lt("certificado_at", end.toISOString())
    .order("certificado_at", { ascending: false });
  if (sedeFilter) query = query.eq("sede_id", sedeFilter);
  const { data: certificadas } = await query;

  const clienteIds = [...new Set((certificadas ?? []).map((v) => v.cliente_id))];
  const uploaderIds = [
    ...new Set((certificadas ?? []).map((v) => v.certificado_by).filter((v): v is string => !!v)),
  ];
  const paths = (certificadas ?? []).map((v) => v.certificado_path).filter((p): p is string => !!p);

  const [{ data: clientesRows }, { data: perfilesRows }, { data: signedUrls }] = await Promise.all([
    clienteIds.length
      ? supabase.from("clientes").select("id, nombre_completo, numero_documento, tipo_documento").in("id", clienteIds)
      : Promise.resolve({ data: [] as { id: string; nombre_completo: string; numero_documento: string; tipo_documento: string }[] }),
    uploaderIds.length
      ? supabase.from("profiles").select("id, full_name").in("id", uploaderIds)
      : Promise.resolve({ data: [] as { id: string; full_name: string }[] }),
    paths.length
      ? supabase.storage.from("certificados-runt").createSignedUrls(paths, 60 * 10)
      : Promise.resolve({ data: [] as { path: string | null; signedUrl: string | null }[] }),
  ]);

  const clienteInfo = (id: string) => clientesRows?.find((c) => c.id === id);
  const nombreDe = (id: string | null) => (perfilesRows ?? []).find((p) => p.id === id)?.full_name ?? "—";
  const sedeName = (id: string) => sedes.find((s) => s.id === id)?.name ?? "—";
  const urlDe = (path: string | null) =>
    path ? ((signedUrls ?? []).find((s) => s.path === path)?.signedUrl ?? null) : null;

  const params = new URLSearchParams();
  if (sedeParam) params.set("sede", sedeParam);
  const conSede = (m: string) => `?${new URLSearchParams({ ...Object.fromEntries(params), mes: m }).toString()}`;

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-slate-900">Certificados RUNT</h1>
          <p className="mt-1 text-sm text-slate-500">
            Personas certificadas en el mes — para cruzar contra el reporte de la escuela.
          </p>
        </div>
        <SedeSelect sedes={sedes} currentSedeId={sedeFilter} allowAll />
      </div>

      <div className="flex items-center justify-between rounded-2xl border border-slate-200 bg-white p-5">
        <Link
          href={conSede(mesAdyacente(yearMonth, -1))}
          className="flex h-9 w-9 items-center justify-center rounded-lg text-slate-400 transition hover:bg-slate-100 hover:text-slate-700"
        >
          <ChevronLeft className="h-5 w-5" />
        </Link>
        <div className="text-center">
          <h2 className="text-xs font-semibold tracking-wide text-slate-500 uppercase capitalize">
            {MES_LABEL[mesNum - 1]} {anio}
          </h2>
          <p className="mt-1 text-3xl font-semibold text-indigo-600">{(certificadas ?? []).length}</p>
          <p className="text-xs text-slate-400">
            {(certificadas ?? []).length === 1 ? "certificado" : "certificados"} este mes
          </p>
        </div>
        <Link
          href={conSede(mesAdyacente(yearMonth, 1))}
          className="flex h-9 w-9 items-center justify-center rounded-lg text-slate-400 transition hover:bg-slate-100 hover:text-slate-700"
        >
          <ChevronRight className="h-5 w-5" />
        </Link>
      </div>

      <div className="overflow-x-auto rounded-2xl border border-slate-200 bg-white">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 text-left text-xs font-medium text-slate-500">
            <tr>
              <th className="px-4 py-3">Fecha</th>
              <th className="px-4 py-3">Cliente</th>
              <th className="px-4 py-3">Documento</th>
              <th className="px-4 py-3">Curso</th>
              {!sedeFilter ? <th className="px-4 py-3">Sede</th> : null}
              <th className="px-4 py-3">Subido por</th>
              <th className="px-4 py-3" />
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {(certificadas ?? []).map((v) => {
              const cliente = clienteInfo(v.cliente_id);
              const url = urlDe(v.certificado_path);
              return (
                <tr key={v.id}>
                  <td className="px-4 py-3 text-slate-500">
                    {v.certificado_at ? formatDateTime(v.certificado_at) : "—"}
                  </td>
                  <td className="px-4 py-3 font-medium text-slate-800">
                    <Link href={`/ventas/${v.id}`} className="text-indigo-700 hover:underline">
                      {cliente?.nombre_completo ?? "—"}
                    </Link>
                  </td>
                  <td className="px-4 py-3 text-slate-600">
                    {cliente ? `${cliente.tipo_documento} ${cliente.numero_documento}` : "—"}
                  </td>
                  <td className="px-4 py-3 text-slate-600">{v.concepto}</td>
                  {!sedeFilter ? (
                    <td className="px-4 py-3 text-slate-600">{sedeName(v.sede_id)}</td>
                  ) : null}
                  <td className="px-4 py-3 text-slate-600">{nombreDe(v.certificado_by)}</td>
                  <td className="px-4 py-3 text-right">
                    {url ? (
                      <a
                        href={url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1 text-xs font-medium text-indigo-700 hover:underline"
                      >
                        <FileText className="h-3.5 w-3.5" />
                        Ver
                      </a>
                    ) : null}
                  </td>
                </tr>
              );
            })}
            {(certificadas ?? []).length === 0 ? (
              <tr>
                <td colSpan={sedeFilter ? 6 : 7} className="px-4 py-8 text-center text-slate-400">
                  Sin certificados en este mes.
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>
    </div>
  );
}
