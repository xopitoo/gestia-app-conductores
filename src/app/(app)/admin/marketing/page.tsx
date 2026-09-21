import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { Mail, MessageCircle, Smartphone } from "lucide-react";
import { getViewerContext, resolveSedeFilter } from "@/lib/viewer";
import { SedeSelect } from "@/components/sede-select";
import { formatDate } from "@/lib/format";
import { badgeClass, buttonClass } from "@/lib/ui";
import { calcularProximosCumpleanos, emailCumpleanosUrl, smsCumpleanosUrl, whatsappCumpleanosUrl } from "@/lib/cumpleanos";
import {
  calcularProximosVencimientosLicencia,
  emailLicenciaUrl,
  smsLicenciaUrl,
  whatsappLicenciaUrl,
} from "@/lib/licencias";

export const metadata: Metadata = { title: "Marketing | Gestia App Conductores" };

export default async function MarketingPage({
  searchParams,
}: {
  searchParams: Promise<{ sede?: string; q?: string }>;
}) {
  const { sede: sedeParam, q } = await searchParams;
  const ctx = await getViewerContext();
  const { supabase, profile, sedes } = ctx;
  if (profile.role !== "admin") redirect("/dashboard");
  const sedeFilter = resolveSedeFilter(ctx, sedeParam);
  const busqueda = (q ?? "").trim().replace(/,/g, "");

  let clientesQuery = supabase
    .from("clientes")
    .select(
      "id, sede_id, tipo_documento, numero_documento, nombre_completo, fecha_nacimiento, telefono_pais, telefono, correo_electronico, licencia_particular_vence, licencia_publico_vence",
    )
    .eq("active", true)
    .order("nombre_completo");
  if (sedeFilter) clientesQuery = clientesQuery.eq("sede_id", sedeFilter);
  if (busqueda) {
    clientesQuery = clientesQuery.or(`nombre_completo.ilike.%${busqueda}%,numero_documento.ilike.%${busqueda}%`);
  }
  const { data: clientes } = await clientesQuery;

  // Historial de trámites de licencia — de dónde sale "qué categoría hizo
  // con nosotros" y "cuándo renovó". Se ignoran las ventas anuladas (mismo
  // criterio que el estado de cuenta): una venta anulada nunca certificó
  // nada de verdad.
  const clienteIds = (clientes ?? []).map((c) => c.id);
  const { data: ventasConCategoria } = clienteIds.length
    ? await supabase
        .from("ventas")
        .select("cliente_id, categorias_licencia, created_at")
        .in("cliente_id", clienteIds)
        .not("categorias_licencia", "is", null)
        .neq("estado", "anulada")
        .order("created_at", { ascending: true })
    : { data: [] as { cliente_id: string; categorias_licencia: string[] | null; created_at: string }[] };

  const tramitesPorCliente = new Map<string, { categorias: Set<string>; ultimaFecha: string }>();
  for (const v of ventasConCategoria ?? []) {
    if (!v.categorias_licencia || v.categorias_licencia.length === 0) continue;
    const entry = tramitesPorCliente.get(v.cliente_id) ?? { categorias: new Set<string>(), ultimaFecha: v.created_at };
    for (const cat of v.categorias_licencia) entry.categorias.add(cat);
    entry.ultimaFecha = v.created_at; // recorrido en orden ascendente: la última sobrescribe
    tramitesPorCliente.set(v.cliente_id, entry);
  }

  const sedeValorarId = sedes.find((s) => s.name === "C.R.C. VALORAR")?.id;
  const sedeNombre = (id: string) => sedes.find((s) => s.id === id)?.name ?? "—";

  // Ventanas gigantes (todo un año para cumpleaños, 100 años para licencia)
  // para que estas funciones —pensadas para la campana, que solo mira lo
  // próximo— acá devuelvan a TODOS los clientes con fecha, sin importar
  // qué tan lejos o vencida esté.
  const cumpleanosPorId = new Map(calcularProximosCumpleanos(clientes ?? [], 366).map((c) => [c.id, c]));
  const vencimientos = calcularProximosVencimientosLicencia(
    (clientes ?? []).map((c) => ({ ...c, es_valorar: c.sede_id === sedeValorarId })),
    36600,
  );
  const particularPorId = new Map(vencimientos.filter((v) => v.categoria === "particular").map((v) => [v.id, v]));
  const publicoPorId = new Map(vencimientos.filter((v) => v.categoria === "publico").map((v) => [v.id, v]));

  const filas = (clientes ?? []).map((c) => {
    const tramite = tramitesPorCliente.get(c.id);
    const cumpleanos = cumpleanosPorId.get(c.id) ?? null;
    const particular = particularPorId.get(c.id) ?? null;
    const publico = publicoPorId.get(c.id) ?? null;
    const esValorar = c.sede_id === sedeValorarId;
    const tieneLicencia = !!(particular || publico);

    // El recordatorio que se manda es el más relevante: si tiene licencia
    // (vencida, por vencer o recién renovada) se le habla de eso primero;
    // si no, y tiene cumpleaños próximo, se le saluda; si no tiene ninguno
    // de los dos, no hay nada armado para mandarle todavía.
    const whatsappUrl = tieneLicencia
      ? whatsappLicenciaUrl(c.nombre_completo, c.telefono_pais, c.telefono, esValorar)
      : cumpleanos
        ? whatsappCumpleanosUrl(c.nombre_completo, c.telefono_pais, c.telefono)
        : null;
    const smsUrl = tieneLicencia
      ? smsLicenciaUrl(c.nombre_completo, c.telefono_pais, c.telefono, esValorar)
      : cumpleanos
        ? smsCumpleanosUrl(c.nombre_completo, c.telefono_pais, c.telefono)
        : null;
    const emailUrl = tieneLicencia
      ? emailLicenciaUrl(c.nombre_completo, c.correo_electronico, esValorar)
      : cumpleanos
        ? emailCumpleanosUrl(c.nombre_completo, c.correo_electronico)
        : null;

    return {
      cliente: c,
      sede: sedeNombre(c.sede_id),
      categorias: tramite ? [...tramite.categorias].sort() : [],
      ultimoTramite: tramite?.ultimaFecha ?? null,
      cumpleanos,
      particular,
      publico,
      whatsappUrl,
      smsUrl,
      emailUrl,
    };
  });

  // Primero los que tienen algo urgente (licencia vencida o por vencer) —
  // así la tabla sirve directo como lista de seguimiento del día, no solo
  // de consulta. Los que no tienen ninguna fecha de licencia quedan al final.
  filas.sort((a, b) => {
    const diasA = Math.min(a.particular?.diasParaVencer ?? Infinity, a.publico?.diasParaVencer ?? Infinity);
    const diasB = Math.min(b.particular?.diasParaVencer ?? Infinity, b.publico?.diasParaVencer ?? Infinity);
    return diasA - diasB;
  });

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold text-slate-900">Marketing</h1>
          <p className="mt-1 text-sm text-slate-500">
            Base de todos los clientes activos para hacerles seguimiento en el tiempo: cuándo renovaron, cuánto
            les falta para vencer la licencia, su cumpleaños y qué categoría hicieron con nosotros.
          </p>
        </div>
        <SedeSelect sedes={sedes} currentSedeId={sedeFilter} allowAll />
      </div>

      <form className="flex items-center gap-2">
        {sedeParam ? <input type="hidden" name="sede" value={sedeParam} /> : null}
        <input
          type="text"
          name="q"
          defaultValue={busqueda}
          placeholder="Buscar por nombre o documento..."
          className="w-full max-w-sm rounded-lg border border-slate-300 px-3.5 py-2 text-sm outline-none focus:border-indigo-600"
        />
        <button type="submit" className={buttonClass("secondary", "sm")}>
          Buscar
        </button>
      </form>

      <div className="rounded-2xl border border-slate-200 bg-white p-6">
        <div className="overflow-x-auto rounded-xl border border-slate-200">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 text-left text-xs font-medium text-slate-500">
              <tr>
                <th className="px-3 py-2">#</th>
                <th className="px-3 py-2">Cliente</th>
                <th className="px-3 py-2">Sede</th>
                <th className="px-3 py-2">Categorías</th>
                <th className="px-3 py-2">Última renovación</th>
                <th className="px-3 py-2">Cumpleaños</th>
                <th className="px-3 py-2">Vence particular</th>
                <th className="px-3 py-2">Vence público</th>
                <th className="px-3 py-2">Contactar</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filas.map((f, i) => (
                <tr key={f.cliente.id}>
                  <td className="px-3 py-2.5 text-slate-400">{i + 1}</td>
                  <td className="px-3 py-2.5">
                    <Link href={`/clientes/${f.cliente.id}`} className="font-medium text-indigo-700 hover:underline">
                      {f.cliente.nombre_completo}
                    </Link>
                    <p className="text-xs text-slate-400">
                      {f.cliente.tipo_documento} {f.cliente.numero_documento}
                    </p>
                  </td>
                  <td className="px-3 py-2.5 text-slate-600">{f.sede}</td>
                  <td className="px-3 py-2.5">
                    {f.categorias.length > 0 ? (
                      <div className="flex flex-wrap gap-1">
                        {f.categorias.map((cat) => (
                          <span key={cat} className={badgeClass("info")}>
                            {cat}
                          </span>
                        ))}
                      </div>
                    ) : (
                      <span className="text-slate-300">—</span>
                    )}
                  </td>
                  <td className="px-3 py-2.5 text-slate-600">
                    {f.ultimoTramite ? formatDate(f.ultimoTramite) : <span className="text-slate-300">—</span>}
                  </td>
                  <td className="px-3 py-2.5">
                    {f.cumpleanos ? (
                      <VencimientoCelda fecha={f.cumpleanos.fechaNacimiento} dias={f.cumpleanos.diasParaCumplir} />
                    ) : (
                      <span className="text-slate-300">—</span>
                    )}
                  </td>
                  <td className="px-3 py-2.5">
                    {f.particular ? (
                      <VencimientoCelda fecha={f.particular.fechaVencimiento} dias={f.particular.diasParaVencer} />
                    ) : (
                      <span className="text-slate-300">—</span>
                    )}
                  </td>
                  <td className="px-3 py-2.5">
                    {f.publico ? (
                      <VencimientoCelda fecha={f.publico.fechaVencimiento} dias={f.publico.diasParaVencer} />
                    ) : (
                      <span className="text-slate-300">—</span>
                    )}
                  </td>
                  <td className="px-3 py-2.5">
                    <div className="flex items-center gap-1">
                      <AccionContacto
                        href={f.whatsappUrl}
                        icon={<MessageCircle className="h-4 w-4" />}
                        title="WhatsApp"
                        tone="text-emerald-600 hover:bg-emerald-50"
                      />
                      <AccionContacto
                        href={f.smsUrl}
                        icon={<Smartphone className="h-4 w-4" />}
                        title="SMS"
                        tone="text-sky-600 hover:bg-sky-50"
                      />
                      <AccionContacto
                        href={f.emailUrl}
                        icon={<Mail className="h-4 w-4" />}
                        title="Correo"
                        tone="text-indigo-600 hover:bg-indigo-50"
                      />
                    </div>
                  </td>
                </tr>
              ))}
              {filas.length === 0 ? (
                <tr>
                  <td colSpan={9} className="px-4 py-6 text-center text-slate-400">
                    No hay clientes que coincidan.
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
        <p className="mt-3 text-xs text-slate-400">
          {filas.length} {filas.length === 1 ? "cliente" : "clientes"}
        </p>
      </div>
    </div>
  );
}

function VencimientoCelda({ fecha, dias }: { fecha: string; dias: number }) {
  const tone = dias < 0 ? "text-red-600" : dias <= 30 ? "text-amber-600" : "text-slate-600";
  const texto =
    dias < 0
      ? `Venció hace ${Math.abs(dias)} ${Math.abs(dias) === 1 ? "día" : "días"}`
      : dias === 0
        ? "Hoy"
        : `En ${dias} ${dias === 1 ? "día" : "días"}`;
  return (
    <div>
      <p className={`text-xs font-semibold ${tone}`}>{texto}</p>
      <p className="text-xs text-slate-400">{formatDate(fecha)}</p>
    </div>
  );
}

function AccionContacto({
  href,
  icon,
  title,
  tone,
}: {
  href: string | null;
  icon: React.ReactNode;
  title: string;
  tone: string;
}) {
  if (!href) {
    return (
      <span
        className="flex h-7 w-7 items-center justify-center rounded-full text-slate-200"
        title={`Sin recordatorio para ${title}`}
      >
        {icon}
      </span>
    );
  }
  const external = href.startsWith("http");
  return (
    <a
      href={href}
      target={external ? "_blank" : undefined}
      rel={external ? "noopener noreferrer" : undefined}
      title={title}
      className={`flex h-7 w-7 items-center justify-center rounded-full transition ${tone}`}
    >
      {icon}
    </a>
  );
}
