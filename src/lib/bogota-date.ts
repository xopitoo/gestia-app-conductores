// Colombia no observa horario de verano: el offset de Bogotá es siempre
// UTC-5, todo el año. Los límites de "hoy" se calculan explícitamente en
// esa zona horaria — nunca con `new Date().getFullYear()/getDate()`, que
// depende del huso horario del servidor (en producción suele ser UTC) y
// puede correr el "día" varias horas respecto a Bogotá.
const BOGOTA_OFFSET = "-05:00";

/** Rango [inicio, fin) del día de "hoy" en hora de Bogotá, como instantes
 * UTC — comparables directo contra columnas timestamptz sin importar en
 * qué huso horario corre el servidor. */
export function bogotaTodayRange(reference: Date = new Date()): { start: Date; end: Date } {
  const ymd = new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Bogota",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(reference); // "YYYY-MM-DD"
  const start = new Date(`${ymd}T00:00:00${BOGOTA_OFFSET}`);
  const end = addDaysUTC(start, 1);
  return { start, end };
}

/** Suma/resta días operando en UTC — seguro para desplazar los instantes
 * que devuelve bogotaTodayRange (offset fijo, sin DST de por medio). */
export function addDaysUTC(date: Date, days: number): Date {
  const d = new Date(date);
  d.setUTCDate(d.getUTCDate() + days);
  return d;
}

/** Rango [inicio, fin) de un mes calendario en hora de Bogotá. `yearMonth`
 * en formato "YYYY-MM" (si no viene, o viene inválido, usa el mes actual en
 * Bogotá) — pensado para filtros de reportes tipo "?mes=2026-09". */
export function bogotaMonthRange(yearMonth?: string): { start: Date; end: Date; yearMonth: string } {
  const ym =
    yearMonth && /^\d{4}-\d{2}$/.test(yearMonth) ? yearMonth : bogotaTodayRange().start.toISOString().slice(0, 7);
  const start = new Date(`${ym}-01T00:00:00${BOGOTA_OFFSET}`);
  const end = new Date(start);
  end.setUTCMonth(end.getUTCMonth() + 1);
  return { start, end, yearMonth: ym };
}
