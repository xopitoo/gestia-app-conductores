import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { enviarCorreoCierreCaja } from "@/lib/caja-cierre-email";
import { bogotaTodayRange } from "@/lib/bogota-date";

export const dynamic = "force-dynamic";

/**
 * Cierre automático de cajas — lo dispara Vercel Cron (ver vercel.json,
 * corre 00:10 hora Bogotá) para las cajas que alguien se olvidó de cerrar
 * durante el día. Nunca toca una caja que ya esté cerrada, ni una recién
 * abierta hoy — solo las que siguen 'abierta' desde ANTES de que empezara
 * el día de hoy (ver bogotaTodayRange).
 *
 * El "saldo de cierre" acá es siempre calculado (apertura + ingresos en
 * efectivo − egresos en efectivo): no hay nadie presente a esa hora para
 * contar la plata física.
 */
export async function GET(request: Request) {
  const authHeader = request.headers.get("authorization");
  if (process.env.CRON_SECRET && authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  const supabase = createAdminClient();
  const { start: inicioHoy } = bogotaTodayRange();

  const { data: sesiones, error } = await supabase
    .from("caja_sesiones")
    .select("id, sede_id, opened_at, opening_balance")
    .eq("estado", "abierta")
    .lt("opened_at", inicioHoy.toISOString());

  if (error) {
    console.error("[cron cerrar-cajas] Error consultando sesiones abiertas:", error);
    return NextResponse.json({ error: "No se pudo consultar las cajas abiertas" }, { status: 500 });
  }

  const cerradas: string[] = [];

  for (const sesion of sesiones ?? []) {
    const { data: movimientos } = await supabase
      .from("caja_movimientos")
      .select("tipo, monto, metodo_pago")
      .eq("caja_sesion_id", sesion.id);

    const movs = movimientos ?? [];
    const ingresosEfectivo = movs
      .filter((m) => m.tipo === "ingreso" && m.metodo_pago === "efectivo")
      .reduce((acc, m) => acc + m.monto, 0);
    const egresosEfectivo = movs
      .filter((m) => m.tipo === "egreso" && m.metodo_pago === "efectivo")
      .reduce((acc, m) => acc + m.monto, 0);
    const closingBalance = sesion.opening_balance + ingresosEfectivo - egresosEfectivo;

    const closedAt = new Date().toISOString();
    const { error: updateError } = await supabase
      .from("caja_sesiones")
      .update({
        estado: "cerrada",
        closed_at: closedAt,
        closing_balance: closingBalance,
        closed_by: null,
      })
      .eq("id", sesion.id)
      .eq("estado", "abierta"); // por si justo se cerró a mano entre el select y acá

    if (updateError) {
      console.error(`[cron cerrar-cajas] No se pudo cerrar la sesión ${sesion.id}:`, updateError);
      continue;
    }

    cerradas.push(sesion.id);

    try {
      const { data: sede } = await supabase.from("sedes").select("name").eq("id", sesion.sede_id).single();
      await enviarCorreoCierreCaja(supabase, {
        sesionId: sesion.id,
        sedeNombre: sede?.name ?? "—",
        openedAt: sesion.opened_at,
        closedAt,
        openingBalance: sesion.opening_balance,
        tipo: "automatico",
      });
    } catch (err) {
      console.error(`[cron cerrar-cajas] No se pudo enviar el correo de la sesión ${sesion.id}:`, err);
    }
  }

  return NextResponse.json({ cerradas: cerradas.length, ids: cerradas });
}
