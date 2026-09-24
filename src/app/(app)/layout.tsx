import { getViewerContext } from "@/lib/viewer";
import { calcularProximosCumpleanos } from "@/lib/cumpleanos";
import { calcularProximosVencimientosLicencia } from "@/lib/licencias";
import { Sidebar } from "./sidebar";
import { Topbar } from "./topbar";

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { supabase, email, profile, organization, sedes } = await getViewerContext();

  const initials = profile.full_name
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join("");

  // Badge de la campana: cuántas ventas de su alcance siguen con saldo
  // pendiente — un número real, no un contador de notificaciones inventado.
  let pendientesQuery = supabase.from("ventas").select("id", { count: "exact", head: true }).eq("estado", "abonada");
  if (profile.role === "recepcionista" && profile.sede_id) {
    pendientesQuery = pendientesQuery.eq("sede_id", profile.sede_id);
  }
  const { count: pendientesCount } = await pendientesQuery;

  // Cumpleaños de clientes (hoy o en la próxima semana) — la otra mitad de
  // la campana, pensada como base para cuando exista un módulo de
  // marketing que automatice el saludo/mensaje.
  let clientesQuery = supabase
    .from("clientes")
    .select("id, nombre_completo, fecha_nacimiento, telefono_pais, telefono, correo_electronico")
    .eq("active", true)
    .not("fecha_nacimiento", "is", null);
  if (profile.role === "recepcionista" && profile.sede_id) {
    clientesQuery = clientesQuery.eq("sede_id", profile.sede_id);
  }
  const { data: clientesConFecha } = await clientesQuery;
  const cumpleanos = calcularProximosCumpleanos(clientesConFecha ?? []);

  // Vencimientos de licencia (particular y/o público) — misma idea que los
  // cumpleaños: gente que se inscribió en una sede CEAPP o renovó en C.R.C.
  // Valorar, con la fecha ya calculada sola por actualizar_vencimiento_licencia.
  let clientesLicenciaQuery = supabase
    .from("clientes")
    .select(
      "id, nombre_completo, sede_id, licencia_particular_vence, licencia_publico_vence, telefono_pais, telefono, correo_electronico",
    )
    .eq("active", true)
    .or("licencia_particular_vence.not.is.null,licencia_publico_vence.not.is.null");
  if (profile.role === "recepcionista" && profile.sede_id) {
    clientesLicenciaQuery = clientesLicenciaQuery.eq("sede_id", profile.sede_id);
  }
  const { data: clientesConLicencia } = await clientesLicenciaQuery;
  const sedeValorarId = sedes.find((s) => s.name === "C.R.C. VALORAR")?.id;
  const vencimientosLicencia = calcularProximosVencimientosLicencia(
    (clientesConLicencia ?? []).map((c) => ({ ...c, es_valorar: c.sede_id === sedeValorarId })),
  );

  return (
    <div className="flex min-h-svh gap-3 bg-gradient-to-br from-indigo-100 via-slate-50 to-pink-100 p-0 sm:p-3 print:block print:bg-white print:p-0">
      <Sidebar role={profile.role as "admin" | "recepcionista"} orgName={organization.name} />

      <main className="flex-1 overflow-x-hidden bg-white/70 shadow-sm shadow-slate-200/70 sm:rounded-2xl print:overflow-visible print:rounded-none print:bg-white print:shadow-none">
        <div className="mx-auto max-w-6xl px-4 pt-16 pb-6 sm:px-6 sm:py-8 print:mx-0 print:max-w-none print:p-0">
          <Topbar
            fullName={profile.full_name}
            email={email}
            initials={initials}
            role={profile.role as "admin" | "recepcionista"}
            pendientesCount={pendientesCount ?? 0}
            cumpleanos={cumpleanos}
            vencimientosLicencia={vencimientosLicencia}
          />
          {children}
        </div>
      </main>
    </div>
  );
}
