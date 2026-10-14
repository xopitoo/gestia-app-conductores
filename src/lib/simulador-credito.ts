export type FilaAmortizacion = {
  mes: number;
  cuota: number;
  seguro: number;
  total: number;
  saldoRestante: number;
};

/**
 * Amortización francesa (cuota fija de capital+interés) + seguro deudor
 * prorrateado linealmente desde el monto original hasta $0 en la última
 * cuota — exactamente como lo calcula el simulador real de Brilla
 * (confirmado probando dos plazos distintos contra su propio simulador el
 * 2026-10-13: la cuota de capital+interés da igual con la fórmula estándar
 * de anualidad, y el seguro decrece de forma lineal, no proporcional al
 * saldo real).
 */
export function calcularAmortizacion({
  monto,
  plazo,
  tasaMensual,
  tasaSeguro,
}: {
  monto: number;
  plazo: number;
  /** Fracción decimal, ej. 0.021176 = 2.1176% mensual. */
  tasaMensual: number;
  /** Fracción decimal sobre el monto original, ej. 0.002154 = 0.2154%. */
  tasaSeguro: number;
}): FilaAmortizacion[] {
  if (!(monto > 0) || !(plazo > 0)) return [];

  const cuota =
    tasaMensual === 0 ? monto / plazo : (monto * tasaMensual) / (1 - Math.pow(1 + tasaMensual, -plazo));
  const seguroInicial = monto * tasaSeguro;

  let saldo = monto;
  const filas: FilaAmortizacion[] = [];
  for (let mes = 1; mes <= plazo; mes++) {
    const seguro = seguroInicial * ((plazo - mes + 1) / plazo);
    saldo = saldo * (1 + tasaMensual) - cuota;
    filas.push({
      mes,
      cuota: Math.round(cuota),
      seguro: Math.round(seguro),
      total: Math.round(cuota + seguro),
      saldoRestante: Math.max(0, Math.round(saldo)),
    });
  }
  return filas;
}
