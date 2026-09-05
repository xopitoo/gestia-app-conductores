import { formatCOP } from "@/lib/format";

const MES_LABEL = [
  "Ene", "Feb", "Mar", "Abr", "May", "Jun", "Jul", "Ago", "Sep", "Oct", "Nov", "Dic",
];

/**
 * Comparación año actual vs año anterior, mes a mes — 12 pares de barras.
 * Dos series con roles fijos (año actual = énfasis, año anterior =
 * referencia), no una paleta categórica abierta, así que alcanza con dos
 * colores fijos + leyenda (no hace falta el validador de la skill de
 * dataviz, que es para paletas categóricas de N series).
 */
export function MonthlyYearChart({
  actual,
  anterior,
  anioActual,
  anioAnterior,
}: {
  actual: number[]; // 12 valores, uno por mes
  anterior: number[];
  anioActual: number;
  anioAnterior: number;
}) {
  const max = Math.max(1, ...actual, ...anterior);

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center gap-4 text-xs text-slate-500">
        <span className="flex items-center gap-1.5">
          <span className="h-2.5 w-2.5 rounded-full bg-indigo-600" />
          {anioActual}
        </span>
        <span className="flex items-center gap-1.5">
          <span className="h-2.5 w-2.5 rounded-full bg-slate-300" />
          {anioAnterior}
        </span>
      </div>

      <div className="flex gap-2" style={{ height: 180 }}>
        {MES_LABEL.map((mes, i) => (
          <div key={mes} className="flex flex-1 flex-col items-center gap-1">
            <div className="flex w-full min-h-0 flex-1 items-end gap-0.5">
              <div
                title={`${mes} ${anioAnterior}: ${formatCOP(anterior[i])}`}
                className="w-1/2 rounded-t-sm bg-slate-300"
                style={{ height: `${Math.max(2, (anterior[i] / max) * 100)}%` }}
              />
              <div
                title={`${mes} ${anioActual}: ${formatCOP(actual[i])}`}
                className="w-1/2 rounded-t-sm bg-indigo-600"
                style={{ height: `${Math.max(2, (actual[i] / max) * 100)}%` }}
              />
            </div>
            <span className="text-[10px] text-slate-400">{mes}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
