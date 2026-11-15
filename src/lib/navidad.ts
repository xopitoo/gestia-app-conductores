/** Diciembre (hora de Bogotá) = temporada navideña. El resto del año se ve la
 * skin normal. Para probarla fuera de diciembre: FORZAR_NAVIDAD=1 en .env.local. */
export function esNavidad(ahora: Date = new Date()): boolean {
  if (process.env.FORZAR_NAVIDAD === "1") return true;
  const mes = new Intl.DateTimeFormat("en-CA", { timeZone: "America/Bogota", month: "2-digit" }).format(ahora);
  return mes === "12";
}
