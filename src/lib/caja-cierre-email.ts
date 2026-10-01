import { sendEmail } from "./email";
import { formatCOP, formatDateTime, formatDate, formatTime } from "./format";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "./supabase/types";

const DESTINATARIO = "ceappconductores@gmail.com";

/**
 * Arma y manda el correo "CIERRE CAJA" — lo llaman tanto el cierre manual
 * (cerrarCaja, ventas/caja/actions.ts) como el cron de cierre automático
 * (api/cron/cerrar-cajas), para no duplicar el cálculo de totales ni el
 * formato del correo entre los dos caminos.
 */
export async function enviarCorreoCierreCaja(
  supabase: SupabaseClient<Database>,
  params: {
    sesionId: string;
    sedeNombre: string;
    openedAt: string;
    closedAt: string;
    openingBalance: number;
    /** Saldo contado a mano — solo en un cierre manual. En uno automático no hay nadie contando. */
    closingBalanceContado?: number;
    tipo: "manual" | "automatico";
    /** Nombre de quien cerró — solo aplica a "manual". */
    closedByNombre?: string;
  },
) {
  const { data: movimientos } = await supabase
    .from("caja_movimientos")
    .select("tipo, monto, metodo_pago")
    .eq("caja_sesion_id", params.sesionId);

  const movs = movimientos ?? [];
  const sumaDe = (tipo: "ingreso" | "egreso", soloEfectivo: boolean) =>
    movs
      .filter((m) => m.tipo === tipo && (!soloEfectivo || m.metodo_pago === "efectivo"))
      .reduce((acc, m) => acc + m.monto, 0);

  const ingresosEfectivo = sumaDe("ingreso", true);
  const egresosEfectivo = sumaDe("egreso", true);
  const ingresosTotal = sumaDe("ingreso", false);
  const egresosTotal = sumaDe("egreso", false);
  const saldoEsperado = params.openingBalance + ingresosEfectivo - egresosEfectivo;

  const subject = `CIERRE CAJA ${formatDate(params.closedAt)} ${formatTime(params.closedAt)} ${params.sedeNombre}`;

  const filaExtra =
    params.tipo === "manual" && params.closingBalanceContado != null
      ? `
        <tr><td style="padding:4px 12px 4px 0;">Saldo contado</td><td style="padding:4px 0;text-align:right;">${formatCOP(params.closingBalanceContado)}</td></tr>
        <tr><td style="padding:4px 12px 4px 0;">Diferencia (contado − esperado)</td><td style="padding:4px 0;text-align:right;${params.closingBalanceContado - saldoEsperado !== 0 ? "color:#b91c1c;font-weight:600;" : ""}">${formatCOP(params.closingBalanceContado - saldoEsperado)}</td></tr>
      `
      : "";

  const html = `
    <div style="font-family:sans-serif;color:#1e293b;max-width:480px;">
      <h2 style="margin:0 0 4px;">Cierre de caja — ${params.sedeNombre}</h2>
      <p style="margin:0 0 16px;color:#64748b;font-size:14px;">
        ${
          params.tipo === "manual"
            ? `Cerrado manualmente por ${params.closedByNombre ?? "—"}.`
            : "Cerrado automáticamente por el sistema — no se había cerrado a tiempo durante el día."
        }
      </p>
      <table style="width:100%;border-collapse:collapse;font-size:14px;">
        <tr><td style="padding:4px 12px 4px 0;color:#64748b;">Apertura</td><td style="padding:4px 0;text-align:right;">${formatDateTime(params.openedAt)}</td></tr>
        <tr><td style="padding:4px 12px 4px 0;color:#64748b;">Cierre</td><td style="padding:4px 0;text-align:right;">${formatDateTime(params.closedAt)}</td></tr>
        <tr><td colspan="2" style="padding:8px 0 4px;border-top:1px solid #e2e8f0;"></td></tr>
        <tr><td style="padding:4px 12px 4px 0;">Saldo de apertura</td><td style="padding:4px 0;text-align:right;">${formatCOP(params.openingBalance)}</td></tr>
        <tr><td style="padding:4px 12px 4px 0;">Ingresos en efectivo</td><td style="padding:4px 0;text-align:right;">${formatCOP(ingresosEfectivo)}</td></tr>
        <tr><td style="padding:4px 12px 4px 0;">Egresos en efectivo</td><td style="padding:4px 0;text-align:right;">-${formatCOP(egresosEfectivo)}</td></tr>
        <tr><td style="padding:4px 12px 4px 0;font-weight:600;">Saldo esperado (según el sistema)</td><td style="padding:4px 0;text-align:right;font-weight:600;">${formatCOP(saldoEsperado)}</td></tr>
        ${filaExtra}
        <tr><td colspan="2" style="padding:8px 0 4px;border-top:1px solid #e2e8f0;"></td></tr>
        <tr><td style="padding:4px 12px 4px 0;color:#64748b;">Ingresos totales (todos los métodos)</td><td style="padding:4px 0;text-align:right;color:#64748b;">${formatCOP(ingresosTotal)}</td></tr>
        <tr><td style="padding:4px 12px 4px 0;color:#64748b;">Egresos totales (todos los métodos)</td><td style="padding:4px 0;text-align:right;color:#64748b;">${formatCOP(egresosTotal)}</td></tr>
      </table>
    </div>
  `;

  await sendEmail({ to: DESTINATARIO, subject, html });
}
