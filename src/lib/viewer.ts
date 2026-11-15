import { cache } from "react";
import { redirect } from "next/navigation";
import { cookies } from "next/headers";
import { createClient } from "@/lib/supabase/server";
import type { OrganizationRow, ProfileRow, SedeRow } from "@/lib/supabase/types";

export type ViewerContext = {
  supabase: Awaited<ReturnType<typeof createClient>>;
  userId: string;
  /** Del usuario de auth, no de profiles (esa tabla no guarda email). */
  email: string | null;
  profile: ProfileRow;
  organization: OrganizationRow;
  /** Sedes activas de la organización. Para 'recepcionista' siempre trae solo la propia. */
  sedes: SedeRow[];
  /** Última sede que el admin eligió en el selector (cookie); se usa cuando la URL no trae ?sede=. */
  sedePreferida?: string;
};

/**
 * Gate + contexto compartido del área operativa (`(app)/*`): valida sesión,
 * rol (nunca platform_owner acá), cuenta activa y organización activa; trae
 * las sedes visibles. `cache()` evita repetir las queries cuando el layout
 * y la página piden el contexto en el mismo request.
 */
export const getViewerContext = cache(async (): Promise<ViewerContext> => {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("id, organization_id, sede_id, role, full_name, active, created_at")
    .eq("id", user.id)
    .single();

  if (!profile) {
    redirect("/login");
  }

  if (profile.role === "platform_owner") {
    redirect("/platform");
  }

  if (!profile.active) {
    await supabase.auth.signOut();
    redirect("/login?error=cuenta-desactivada");
  }

  if (!profile.organization_id) {
    await supabase.auth.signOut();
    redirect("/login");
  }

  // La org y las sedes no dependen una de otra: se piden en paralelo (cada
  // navegación pasa por acá, y cada ida y vuelta a la base suma).
  const sedesQuery = supabase
    .from("sedes")
    .select("id, organization_id, name, address, active, created_at, updated_at")
    .eq("organization_id", profile.organization_id)
    .eq("active", true)
    .order("name");

  const [{ data: organization }, { data: sedes }] = await Promise.all([
    supabase
      .from("organizations")
      .select("id, name, slug, active, created_at, updated_at")
      .eq("id", profile.organization_id)
      .single(),
    profile.role === "recepcionista" && profile.sede_id ? sedesQuery.eq("id", profile.sede_id) : sedesQuery,
  ]);

  if (!organization || !organization.active) {
    await supabase.auth.signOut();
    redirect("/login?error=organizacion-inactiva");
  }

  if (profile.role === "recepcionista" && !profile.sede_id) {
    redirect("/elegir-sede");
  }

  return {
    supabase,
    userId: user.id,
    email: user.email ?? null,
    profile: profile as ProfileRow,
    organization: organization as OrganizationRow,
    sedes: sedes ?? [],
    sedePreferida: (await cookies()).get("gestia_sede")?.value,
  };
});

/** Resuelve la sede sobre la que opera la página actual (siempre una sede
 * concreta — para páginas como Caja, donde no existe un "todas las sedes"). */
export function resolveSedeId(
  ctx: Pick<ViewerContext, "profile" | "sedes" | "sedePreferida">,
  requestedSedeId?: string,
): string | null {
  if (ctx.profile.role === "recepcionista") {
    return ctx.profile.sede_id;
  }
  requestedSedeId = requestedSedeId || ctx.sedePreferida;
  if (requestedSedeId && ctx.sedes.some((s) => s.id === requestedSedeId)) {
    return requestedSedeId;
  }
  return ctx.sedes[0]?.id ?? null;
}

/** Resuelve el filtro de sede para páginas agregadas (Ventas): null =
 * "todas las sedes" de la organización, solo posible para un admin. */
export function resolveSedeFilter(
  ctx: Pick<ViewerContext, "profile" | "sedes" | "sedePreferida">,
  requestedSedeId?: string,
): string | null {
  if (ctx.profile.role === "recepcionista") {
    return ctx.profile.sede_id;
  }
  requestedSedeId = requestedSedeId || ctx.sedePreferida;
  if (!requestedSedeId || requestedSedeId === "all") {
    return null;
  }
  return ctx.sedes.some((s) => s.id === requestedSedeId) ? requestedSedeId : null;
}

/**
 * Un recepcionista tiene que abrir la caja de su sede antes de poder hacer
 * cualquier otra cosa (registrar ventas, cargar clientes) — llamar esto al
 * principio de esas páginas. Un admin nunca queda bloqueado por esto: no
 * opera una caja física propia. La página `/caja` en sí NUNCA llama a esto
 * (sería un loop de redirect infinito).
 */
export async function requireOpenCaja(ctx: ViewerContext) {
  if (ctx.profile.role !== "recepcionista" || !ctx.profile.sede_id) return;

  const { data } = await ctx.supabase
    .from("caja_sesiones")
    .select("id")
    .eq("sede_id", ctx.profile.sede_id)
    .eq("estado", "abierta")
    .maybeSingle();

  if (!data) {
    redirect("/caja?abrir=1");
  }
}
