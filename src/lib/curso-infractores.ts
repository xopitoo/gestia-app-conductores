/** Lo que el SIMIT cobra de más cuando el saldo se paga por PSE ("Adicional pago PSE"). */
export const ADICIONAL_PSE = 45_000;

/** Valor de la multa 2026 por tipo de infracción (tabla publicada): sirve para reconocer el tipo a partir del valor escrito. */
export const MULTAS_2026: Record<string, number> = { A: 168_900, B: 337_400, C: 633_200, D: 1_266_100, E: 1_899_300 };

// El SIMIT muestra los valores un poco más altos que la tabla publicada (ej. tipo C: $675.305 en vez
// de $633.200), así que el tipo se reconoce con una tolerancia de ±5% sobre las dos escalas.
const ESCALA_SIMIT = 675_305 / 633_200;
const TOLERANCIA_TIPO = 0.05;

export function tipoInfraccionDe(multa: number): string | null {
  for (const [tipo, valor] of Object.entries(MULTAS_2026)) {
    for (const base of [valor, valor * ESCALA_SIMIT]) {
      if (Math.abs(multa - base) / base <= TOLERANCIA_TIPO) return tipo;
    }
  }
  return null;
}

/** Precio final del curso por tipo de infracción, con descuento del 50% o del 25% (ya incluye el margen, no lleva incremento %). */
export const CURSO_FIJO: Record<string, number> = { A: 28_000, B: 60_000, C: 102_000, D: 180_000 };

/** Con descuento del 25% el curso cuesta $50.000 más que con el del 50%. */
export const RECARGO_CURSO_25 = 50_000;

/** Precio fijo del curso para un tipo de infracción y un tramo de descuento (undefined si el tipo no tiene precio fijo). */
export function cursoFijoDe(tipo: string | null, tier: TierDescuento): number | undefined {
  const base = tipo ? CURSO_FIJO[tipo] : undefined;
  if (base === undefined || tier === "vencido") return undefined;
  return tier === "25" ? base + RECARGO_CURSO_25 : base;
}

export type TipoNotificacion = "fisico" | "foto";
export type TierDescuento = "50" | "25" | "vencido";

/**
 * Plazos fijados por ley para el descuento por curso de infractores (no son
 * configurables desde el admin, a diferencia de `porcentajeCurso`): 5/20
 * días hábiles desde la expedición del comparendo físico, o 11/26 días
 * desde la notificación de la foto-multa — ver /curso-infractores.
 */
const LIMITES: Record<TipoNotificacion, { limite50: number; limite25: number }> = {
  fisico: { limite50: 5, limite25: 20 },
  foto: { limite50: 11, limite25: 26 },
};

/** Días calendario completos transcurridos entre la fecha de notificación (YYYY-MM-DD) y hoy. */
export function diasTranscurridos(fechaNotificacion: string, hoy: Date = new Date()): number {
  const [anio, mes, dia] = fechaNotificacion.split("-").map(Number);
  if (!anio || !mes || !dia) return 0;
  const fecha = new Date(anio, mes - 1, dia);
  const hoySinHora = new Date(hoy.getFullYear(), hoy.getMonth(), hoy.getDate());
  const dias = Math.round((hoySinHora.getTime() - fecha.getTime()) / 86_400_000);
  return Math.max(0, dias);
}

export function tierDe(dias: number, tipo: TipoNotificacion): TierDescuento {
  const { limite50, limite25 } = LIMITES[tipo];
  if (dias <= limite50) return "50";
  if (dias <= limite25) return "25";
  return "vencido";
}

export type ResultadoCurso = {
  tier: TierDescuento;
  /** Fracción del valor original de la multa que se descuenta (0.5 o 0.25). */
  descuentoFraccion: number;
  /** Monto a pagar después del descuento (antes de separar curso/SIMIT). */
  montoConDescuento: number;
  /** Lo que cobra la organización por el curso, presencial. */
  valorCurso: number;
  /** Lo que el cliente paga directo en los puntos SIMIT. */
  saldoMulta: number;
};

export function calcularCursoInfractor({
  multa,
  dias,
  tipo,
  porcentajeCurso,
  valorCursoFijo,
}: {
  multa: number;
  dias: number;
  tipo: TipoNotificacion;
  /** Fracción decimal, ej. 0.25 = 25% del monto ya descontado. */
  porcentajeCurso: number;
  /** Si se pasa, con descuento (50% o 25%) el curso se cobra a este valor en vez del %; el saldo del SIMIT no cambia. */
  valorCursoFijo?: number;
}): ResultadoCurso {
  const tier = tierDe(dias, tipo);

  if (tier === "vencido" || !(multa > 0)) {
    return { tier, descuentoFraccion: 0, montoConDescuento: Math.round(multa), valorCurso: 0, saldoMulta: Math.round(multa) };
  }

  const descuentoFraccion = tier === "50" ? 0.5 : 0.25;
  const montoConDescuento = Math.round(multa * (1 - descuentoFraccion));
  const cursoPorcentaje = Math.round(montoConDescuento * porcentajeCurso);
  const saldoMulta = montoConDescuento - cursoPorcentaje;
  const valorCurso = valorCursoFijo ?? cursoPorcentaje;

  return { tier, descuentoFraccion, montoConDescuento, valorCurso, saldoMulta };
}
