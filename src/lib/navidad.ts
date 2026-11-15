/** Temporada navideña: desde el 14 de noviembre hasta el 31 de diciembre
 * (hora de Bogotá). El resto del año se ve la skin normal. Para probarla
 * fuera de temporada: FORZAR_NAVIDAD=1 en .env.local. */
export function esNavidad(ahora: Date = new Date()): boolean {
  if (process.env.FORZAR_NAVIDAD === "1") return true;
  const [mes, dia] = new Intl.DateTimeFormat("en-CA", { timeZone: "America/Bogota", month: "2-digit", day: "2-digit" })
    .format(ahora)
    .split("-")
    .map(Number);
  return mes === 12 || (mes === 11 && dia >= 14);
}
