import type { SoatTarifaRow } from "@/lib/supabase/types";

export type AnioSoat = "0-9" | "10+";

/**
 * Las categorías vienen de la BD como "Autos Familiares 0 - 9 años" / "...
 * 10 años o más" — se separa acá la "familia" (tipo de vehículo, lo primero
 * que elige el recepcionista) de la antigüedad (lo segundo, solo si esa
 * familia la distingue), para los selectores guiados de /soat y del
 * formulario de venta sin tocar el esquema.
 */
export function familiaDeSoat(categoria: string): { familia: string; anio: AnioSoat | null } {
  const m0a9 = /\s*0\s*-\s*9\s*años$/i;
  const m10 = /\s*10\s*años?\s*o\s*m[aá]s$/i;
  if (m0a9.test(categoria)) return { familia: categoria.replace(m0a9, "").trim(), anio: "0-9" };
  if (m10.test(categoria)) return { familia: categoria.replace(m10, "").trim(), anio: "10+" };
  return { familia: categoria, anio: null };
}

export type FamiliaSoat = { nombre: string; filas: SoatTarifaRow[]; tieneAnio: boolean };

export function agruparSoatPorFamilia(tarifas: SoatTarifaRow[]): FamiliaSoat[] {
  const orden: string[] = [];
  const porFamilia = new Map<string, SoatTarifaRow[]>();
  for (const t of tarifas) {
    const { familia } = familiaDeSoat(t.categoria);
    if (!porFamilia.has(familia)) {
      porFamilia.set(familia, []);
      orden.push(familia);
    }
    porFamilia.get(familia)!.push(t);
  }
  return orden.map((nombre) => {
    const filas = porFamilia.get(nombre)!;
    const tieneAnio = filas.some((t) => familiaDeSoat(t.categoria).anio !== null);
    return { nombre, filas, tieneAnio };
  });
}
