export type SedeBranding = {
  nombre: string;
  subtitulo: string;
  slogan?: string;
  telefono?: string;
  web?: string;
};

/**
 * C.R.C. Valorar opera bajo su propia identidad corporativa aunque
 * comparta la misma cuenta de Gestia que las sedes CEAPP — en documentos
 * impresos (cierres de caja, recibos) muestra este nombre en vez del de
 * la organización. Las demás sedes siguen mostrando el nombre real de la
 * organización, sin slogan.
 */
const BRANDING_POR_SEDE: Record<string, SedeBranding> = {
  "C.R.C. VALORAR": {
    nombre: "Grupo Empresarial Salud & Movilidad",
    subtitulo: "Sede C.R.C. Valorar",
    slogan: "Nos alegra ser parte de tu camino.",
    telefono: "321 768 5212",
    web: "www.crcvalorarconductores.com",
  },
};

export function getSedeBranding(sedeNombre: string | null | undefined, orgNombre: string): SedeBranding {
  if (sedeNombre && BRANDING_POR_SEDE[sedeNombre]) {
    return BRANDING_POR_SEDE[sedeNombre];
  }
  return { nombre: orgNombre, subtitulo: sedeNombre ?? "" };
}
