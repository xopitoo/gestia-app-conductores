export function formatCOP(amount: number) {
  return new Intl.NumberFormat("es-CO", {
    style: "currency",
    currency: "COP",
    maximumFractionDigits: 0,
  }).format(amount);
}

// timeZone explícito a propósito: en producción el servidor corre en UTC
// (Vercel), así que sin esto Intl.DateTimeFormat usa el huso del server, no
// el de Bogotá — toda hora mostrada aparecía 5 horas adelantada. Colombia
// no tiene horario de verano, el offset es siempre -05:00 (ver
// bogota-date.ts, que ya tenía este mismo cuidado para los RANGOS de
// fecha; acá es lo mismo pero para lo que se le muestra al usuario).
const BOGOTA_TZ = "America/Bogota";

export function formatDateTime(iso: string) {
  return new Intl.DateTimeFormat("es-CO", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: BOGOTA_TZ,
  }).format(new Date(iso));
}

export function formatDate(iso: string) {
  return new Intl.DateTimeFormat("es-CO", {
    dateStyle: "medium",
    timeZone: BOGOTA_TZ,
  }).format(new Date(iso));
}

export function formatTime(iso: string) {
  return new Intl.DateTimeFormat("es-CO", {
    timeStyle: "short",
    timeZone: BOGOTA_TZ,
  }).format(new Date(iso));
}
