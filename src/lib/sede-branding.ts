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
 * la organización. Las sedes CEAPP usan el mismo tratamiento visual con
 * su propio nombre y slogan; teléfono y web quedan sin dato hasta que se
 * confirmen los reales (nunca se inventa un contacto en un recibo real).
 */
const BRANDING_POR_SEDE: Record<string, SedeBranding> = {
  "C.R.C. VALORAR": {
    nombre: "Grupo Empresarial Salud & Movilidad",
    subtitulo: "Sede C.R.C. Valorar",
    slogan: "Nos alegra ser parte de tu camino.",
    telefono: "321 768 5212",
    web: "www.crcvalorarconductores.com",
  },
  "CEAPP CALI": {
    nombre: "Grupo Empresarial Salud & Movilidad",
    subtitulo: "Sede CEAPP Cali",
    slogan: "Formando conductores seguros y responsables.",
  },
  "CEAPP JAMUNDI": {
    nombre: "Grupo Empresarial Salud & Movilidad",
    subtitulo: "Sede CEAPP Jamundí",
    slogan: "Formando conductores seguros y responsables.",
  },
  "CEAPP SANTANDER": {
    nombre: "Grupo Empresarial Salud & Movilidad",
    subtitulo: "Sede CEAPP Santander de Quilichao",
    slogan: "Formando conductores seguros y responsables.",
  },
};

export function getSedeBranding(sedeNombre: string | null | undefined, orgNombre: string): SedeBranding {
  if (sedeNombre && BRANDING_POR_SEDE[sedeNombre]) {
    return BRANDING_POR_SEDE[sedeNombre];
  }
  return { nombre: orgNombre, subtitulo: sedeNombre ?? "" };
}
