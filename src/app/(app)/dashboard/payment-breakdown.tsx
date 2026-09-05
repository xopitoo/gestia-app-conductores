import { formatCOP } from "@/lib/format";
import { METODO_PAGO_LABEL, type MetodoPago } from "@/lib/supabase/types";

/**
 * Ranking horizontal por forma de pago — la magnitud la da el largo de la
 * barra, la identidad la da la etiqueta (no el color), así que alcanza un
 * solo hue (no hace falta una paleta categórica validada para esto).
 */
export function PaymentBreakdown({ totales }: { totales: Partial<Record<MetodoPago, number>> }) {
  const filas = Object.entries(totales)
    .filter(([, monto]) => (monto ?? 0) > 0)
    .sort((a, b) => (b[1] ?? 0) - (a[1] ?? 0)) as [MetodoPago, number][];

  const max = Math.max(1, ...filas.map(([, m]) => m));

  if (filas.length === 0) {
    return <p className="py-6 text-center text-sm text-slate-400">Sin pagos este mes.</p>;
  }

  return (
    <ul className="flex flex-col gap-2.5">
      {filas.map(([metodo, monto]) => (
        <li key={metodo} className="flex flex-col gap-1">
          <div className="flex items-center justify-between text-xs">
            <span className="font-medium text-slate-700">{METODO_PAGO_LABEL[metodo]}</span>
            <span className="text-slate-500">{formatCOP(monto)}</span>
          </div>
          <div className="h-2 w-full overflow-hidden rounded-full bg-slate-100">
            <div
              className="h-full rounded-full bg-indigo-600"
              style={{ width: `${Math.max(3, (monto / max) * 100)}%` }}
            />
          </div>
        </li>
      ))}
    </ul>
  );
}
