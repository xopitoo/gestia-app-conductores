/** Lo que el SIMIT cobra de más cuando el saldo se paga por PSE ("Adicional pago PSE"). */
export const ADICIONAL_PSE = 45_000;

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
}: {
  multa: number;
  dias: number;
  tipo: TipoNotificacion;
  /** Fracción decimal, ej. 0.25 = 25% del monto ya descontado. */
  porcentajeCurso: number;
}): ResultadoCurso {
  const tier = tierDe(dias, tipo);

  if (tier === "vencido" || !(multa > 0)) {
    return { tier, descuentoFraccion: 0, montoConDescuento: Math.round(multa), valorCurso: 0, saldoMulta: Math.round(multa) };
  }

  const descuentoFraccion = tier === "50" ? 0.5 : 0.25;
  const montoConDescuento = Math.round(multa * (1 - descuentoFraccion));
  const valorCurso = Math.round(montoConDescuento * porcentajeCurso);
  const saldoMulta = montoConDescuento - valorCurso;

  return { tier, descuentoFraccion, montoConDescuento, valorCurso, saldoMulta };
}
