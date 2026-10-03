import { sendEmail } from "./email";
import { formatCOP, formatDateTime, formatDate, formatTime } from "./format";
import { getCierreCajaData } from "./caja-cierre-data";
import { METODO_PAGO_LABEL } from "./supabase/types";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "./supabase/types";

const DESTINATARIO = "ceappconductores@gmail.com";

function hora(iso: string) {
  return formatDateTime(iso).split(", ")[1] ?? formatDateTime(iso);
}

const THEAD_STYLE = "padding:6px 8px;color:#64748b;font-weight:600;border-bottom:1px solid #cbd5e1;";
const TD_STYLE = "padding:5px 8px;border-bottom:1px solid #f1f5f9;color:#334155;";

const th = `style="${THEAD_STYLE}text-align:left;"`;
const thR = `style="${THEAD_STYLE}text-align:right;"`;
/** Celda de datos — `extra` se concatena al final del style (ej. color del monto). */
function td(extra = "") {
  return `style="${TD_STYLE}${extra}"`;
}
function tdR(extra = "") {
  return `style="${TD_STYLE}text-align:right;${extra}"`;
}

/**
 * Arma y manda el correo "CIERRE CAJA" — con el mismo detalle que la
 * página imprimible (caja/[id]/cierre), no solo un resumen: ventas una
 * por una, formas de pago, ventas pendientes y egresos. Misma fuente de
 * datos que esa página (getCierreCajaData), para que nunca se
 * desincronicen entre sí. La llaman tanto el cierre manual (cerrarCaja,
 * caja/actions.ts) como el cron de cierre automático
 * (api/cron/cerrar-cajas) — basta con el id de la sesión, ya cerrada.
 */
export async function enviarCorreoCierreCaja(supabase: SupabaseClient<Database>, sesionId: string) {
  const cierre = await getCierreCajaData(supabase, sesionId);
  if (!cierre || !cierre.sesion.closed_at) return;
  const closedAt = cierre.sesion.closed_at;

  const {
    sesion,
    sedeNombre,
    abiertoPorNombre,
    cerradoPorNombre,
    ingresos,
    egresos,
    totalIngresos,
    totalEgresos,
    ingresosEfectivo,
    egresosEfectivo,
    saldoTeoricoEfectivo,
    diferencia,
    totalesPorMetodo,
    ventasPendientes,
    totalPendiente,
    totalVentasHoy,
  } = cierre;

  const esAutomatico = !sesion.closed_by;
  const subject = `CIERRE CAJA ${formatDate(closedAt)} ${formatTime(closedAt)} ${sedeNombre}`;

  const filasFormasDePago = totalesPorMetodo
    .map(
      ({ metodo, monto }) => `
      <td style="padding:6px 10px;background:#f8fafc;border:1px solid #e2e8f0;border-radius:6px;">
        <p style="margin:0;font-size:10px;font-weight:600;color:#64748b;text-transform:uppercase;">${METODO_PAGO_LABEL[metodo] ?? metodo}</p>
        <p style="margin:0;font-size:13px;font-weight:700;color:#0f172a;">${formatCOP(monto)}</p>
      </td>
    `,
    )
    .join('<td style="width:6px;"></td>');

  const filasIngresos = ingresos.length
    ? ingresos
        .map(
          (m) => `
      <tr>
        <td ${td()}>${hora(m.created_at)}</td>
        <td ${td()}><em>${m.clienteNombre ?? m.concepto}</em></td>
        <td ${td()}>${m.clienteNombre ? (m.esAbono ? "Abono" : "Pago inicial") : "—"}</td>
        <td ${td()}>${m.referido ?? "—"}</td>
        <td ${td()}>${m.metodo_pago ? (METODO_PAGO_LABEL[m.metodo_pago] ?? m.metodo_pago) : "—"}</td>
        <td ${tdR("color:#059669;")}>${formatCOP(m.monto)}</td>
      </tr>
    `,
        )
        .join("")
    : `<tr><td colspan="6" style="padding:10px;text-align:center;color:#94a3b8;">Sin ingresos en esta caja.</td></tr>`;

  const filasPendientes = ventasPendientes
    .map(
      (v) => `
      <tr>
        <td ${td()}>${hora(v.created_at)}</td>
        <td ${td()}><em>${v.clienteNombre}</em></td>
        <td ${td()}>${v.referido}</td>
        <td ${tdR()}>${formatCOP(v.total)}</td>
        <td ${tdR()}>${formatCOP(v.pagado)}</td>
        <td ${tdR("color:#b45309;font-weight:600;")}>${formatCOP(v.pendiente)}</td>
      </tr>
    `,
    )
    .join("");

  const filasEgresos = egresos
    .map(
      (m) => `
      <tr>
        <td ${td()}>${hora(m.created_at)}</td>
        <td ${td()}>${m.concepto}</td>
        <td ${td()}>${m.metodo_pago ? (METODO_PAGO_LABEL[m.metodo_pago] ?? m.metodo_pago) : "—"}</td>
        <td ${tdR("color:#dc2626;")}>−${formatCOP(m.monto)}</td>
      </tr>
    `,
    )
    .join("");

  const html = `
    <div style="font-family:Arial,Helvetica,sans-serif;color:#1e293b;max-width:640px;">
      <div style="border-bottom:2px solid #0f172a;padding-bottom:10px;margin-bottom:12px;">
        <h1 style="margin:0;font-size:19px;">${sedeNombre}</h1>
        <p style="margin:2px 0 0;font-size:11px;font-weight:700;color:#4338ca;text-transform:uppercase;letter-spacing:0.03em;">Cierre de caja</p>
        <p style="margin:2px 0 0;font-size:11px;color:#94a3b8;">
          ${esAutomatico ? "Cerrado automáticamente por el sistema — no se había cerrado a tiempo durante el día." : `Cerrado manualmente por ${cerradoPorNombre}.`}
        </p>
      </div>

      <p style="margin:0 0 14px;font-size:20px;">
        <strong>${totalVentasHoy}</strong> ${totalVentasHoy === 1 ? "venta hoy" : "ventas hoy"}
      </p>

      <table style="width:100%;border-collapse:collapse;font-size:12px;margin-bottom:14px;">
        <tr>
          <td style="width:50%;vertical-align:top;padding:0;">
            <p style="margin:0;color:#94a3b8;font-size:10px;text-transform:uppercase;">Apertura</p>
            <p style="margin:0;font-weight:600;">${formatDateTime(sesion.opened_at)}</p>
            <p style="margin:0;color:#64748b;">${abiertoPorNombre}</p>
          </td>
          <td style="width:50%;vertical-align:top;padding:0;">
            <p style="margin:0;color:#94a3b8;font-size:10px;text-transform:uppercase;">Cierre</p>
            <p style="margin:0;font-weight:600;">${formatDateTime(closedAt)}</p>
            <p style="margin:0;color:#64748b;">${esAutomatico ? "Automático" : cerradoPorNombre}</p>
          </td>
        </tr>
      </table>

      <p style="margin:0 0 6px;font-size:11px;font-weight:700;color:#64748b;text-transform:uppercase;">Resumen de efectivo</p>
      <table style="width:100%;border-collapse:collapse;font-size:12px;background:#f8fafc;border:1px solid #e2e8f0;border-radius:8px;margin-bottom:16px;">
        <tr>
          <td style="padding:8px 10px;"><p style="margin:0;color:#94a3b8;font-size:10px;">Base inicial</p><p style="margin:0;font-weight:700;">${formatCOP(sesion.opening_balance)}</p></td>
          <td style="padding:8px 10px;"><p style="margin:0;color:#94a3b8;font-size:10px;">Ingresos</p><p style="margin:0;font-weight:700;color:#059669;">${formatCOP(ingresosEfectivo)}</p></td>
          <td style="padding:8px 10px;"><p style="margin:0;color:#94a3b8;font-size:10px;">Egresos</p><p style="margin:0;font-weight:700;color:#dc2626;">${formatCOP(egresosEfectivo)}</p></td>
        </tr>
        <tr>
          <td style="padding:0 10px 8px;"><p style="margin:0;color:#94a3b8;font-size:10px;">Teórico</p><p style="margin:0;font-weight:700;">${formatCOP(saldoTeoricoEfectivo)}</p></td>
          <td style="padding:0 10px 8px;"><p style="margin:0;color:#94a3b8;font-size:10px;">Contado</p><p style="margin:0;font-weight:700;">${sesion.closing_balance != null ? formatCOP(sesion.closing_balance) : "—"}</p></td>
          <td style="padding:0 10px 8px;"><p style="margin:0;color:#94a3b8;font-size:10px;">Diferencia</p><p style="margin:0;font-weight:700;color:${diferencia == null ? "#94a3b8" : diferencia === 0 ? "#059669" : "#b45309"};">${diferencia != null ? formatCOP(diferencia) : "—"}</p></td>
        </tr>
      </table>

      <p style="margin:0 0 6px;font-size:11px;font-weight:700;color:#64748b;text-transform:uppercase;">Formas de pago</p>
      <table style="border-collapse:separate;border-spacing:0;margin-bottom:16px;"><tr>${filasFormasDePago || '<td style="color:#94a3b8;font-size:12px;">Sin ingresos.</td>'}</tr></table>

      <p style="margin:0 0 6px;font-size:11px;font-weight:700;color:#64748b;text-transform:uppercase;">Ingresos del período (${ingresos.length})</p>
      <table style="width:100%;border-collapse:collapse;font-size:12px;margin-bottom:16px;">
        <thead><tr>
          <th ${th}>Hora</th><th ${th}>Cliente</th><th ${th}>Tipo</th><th ${th}>Referido</th><th ${th}>Método</th><th ${thR}>Monto</th>
        </tr></thead>
        <tbody>${filasIngresos}</tbody>
        <tfoot><tr>
          <td colspan="5" style="padding:6px 8px;text-align:right;font-weight:700;border-top:2px solid #0f172a;">Total ingresos</td>
          <td style="padding:6px 8px;text-align:right;font-weight:700;border-top:2px solid #0f172a;">${formatCOP(totalIngresos)}</td>
        </tr></tfoot>
      </table>

      ${
        ventasPendientes.length
          ? `
      <p style="margin:0 0 6px;font-size:11px;font-weight:700;color:#b45309;text-transform:uppercase;">Ventas pendientes de esta sesión</p>
      <table style="width:100%;border-collapse:collapse;font-size:12px;margin-bottom:16px;">
        <thead><tr>
          <th ${th}>Hora</th><th ${th}>Cliente</th><th ${th}>Referido</th><th ${thR}>Total</th><th ${thR}>Abonado</th><th ${thR}>Pendiente</th>
        </tr></thead>
        <tbody>${filasPendientes}</tbody>
        <tfoot><tr>
          <td colspan="5" style="padding:6px 8px;text-align:right;font-weight:700;border-top:2px solid #0f172a;">Total pendiente</td>
          <td style="padding:6px 8px;text-align:right;font-weight:700;color:#b45309;border-top:2px solid #0f172a;">${formatCOP(totalPendiente)}</td>
        </tr></tfoot>
      </table>
      `
          : ""
      }

      ${
        egresos.length
          ? `
      <p style="margin:0 0 6px;font-size:11px;font-weight:700;color:#64748b;text-transform:uppercase;">Egresos del período</p>
      <table style="width:100%;border-collapse:collapse;font-size:12px;margin-bottom:16px;">
        <thead><tr>
          <th ${th}>Hora</th><th ${th}>Concepto</th><th ${th}>Método</th><th ${thR}>Monto</th>
        </tr></thead>
        <tbody>${filasEgresos}</tbody>
        <tfoot><tr>
          <td colspan="3" style="padding:6px 8px;text-align:right;font-weight:700;border-top:2px solid #0f172a;">Total egresos</td>
          <td style="padding:6px 8px;text-align:right;font-weight:700;border-top:2px solid #0f172a;">−${formatCOP(totalEgresos)}</td>
        </tr></tfoot>
      </table>
      `
          : ""
      }
    </div>
  `;

  await sendEmail({ to: DESTINATARIO, subject, html });
}
