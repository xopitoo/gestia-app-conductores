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
 *
 * Si la financiadora trae `tablaFactores` (ej. Sistecrédito, cuyo costo real
 * no se ajusta a una tasa de interés limpia — ver nota en
 * cargar_factores_sistecredito.sql), se usa esa tabla en vez de la fórmula:
 * `tablaFactores[n-1]` es la cuota mensual como fracción del monto para un
 * plazo de `n` cuotas, tomada directamente del simulador público real. La
 * cuota es fija (sin desglose de seguro) y el plazo queda limitado a las
 * entradas que tenga la tabla (una posición null = esa cantidad de cuotas
 * no se ofrece, ej. Addi no ofrece 1 cuota).
 */
export function calcularAmortizacion({
  monto,
  plazo,
  tasaMensual,
  tasaSeguro,
  tablaFactores,
}: {
  monto: number;
  plazo: number;
  /** Fracción decimal, ej. 0.021176 = 2.1176% mensual. */
  tasaMensual: number;
  /** Fracción decimal sobre el monto original, ej. 0.002154 = 0.2154%. */
  tasaSeguro: number;
  /** Tabla de factores real (cuota/monto por cantidad de cuotas), si aplica. */
  tablaFactores?: (number | null)[] | null;
}): FilaAmortizacion[] {
  if (!(monto > 0) || !(plazo > 0)) return [];

  if (tablaFactores && tablaFactores.length > 0) {
    const factor = tablaFactores[plazo - 1];
    if (factor == null) return [];
    const cuota = Math.round(monto * factor);
    const filas: FilaAmortizacion[] = [];
    let saldo = monto;
    for (let mes = 1; mes <= plazo; mes++) {
      saldo = Math.max(0, saldo - cuota);
      filas.push({ mes, cuota, seguro: 0, total: cuota, saldoRestante: mes === plazo ? 0 : saldo });
    }
    return filas;
  }

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
