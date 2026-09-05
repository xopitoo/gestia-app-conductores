import { formatCOP } from "@/lib/format";

// Formateado explícito en hora de Bogotá — `fecha` es un instante UTC de
// medianoche-Bogotá, y .getDay()/.getDate() leerían el huso horario local
// del servidor, no el de Colombia.
const diaLabel = (fecha: Date) =>
  new Intl.DateTimeFormat("es-CO", { timeZone: "America/Bogota", weekday: "short" }).format(fecha);
const diaNumero = (fecha: Date) =>
  new Intl.DateTimeFormat("es-CO", { timeZone: "America/Bogota", day: "numeric" }).format(fecha);

/**
 * Barras simples de recaudo diario (7 días). Un solo hue (marca), extremos
 * redondeados, ancladas a la base, con el valor directo sobre cada barra
 * (n=7 es poco denso, así que etiquetar todas es apropiado) y el nombre del
 * día debajo. Sin librería de gráficos — HTML/CSS puro.
 */
export function DailyChart({ dias }: { dias: { fecha: Date; total: number }[] }) {
  const max = Math.max(1, ...dias.map((d) => d.total));

  return (
    <div className="flex gap-3" style={{ height: 180 }}>
      {dias.map(({ fecha, total }, i) => {
        const alturaPct = Math.max(2, (total / max) * 100);
        const esHoy = i === dias.length - 1;
        return (
          <div key={fecha.toISOString()} className="flex flex-1 flex-col items-center gap-1.5">
            <span className="text-[11px] font-medium text-slate-600">
              {total > 0 ? formatCOP(total) : ""}
            </span>
            <div className="flex w-full min-h-0 flex-1 items-end">
              <div
                title={`${diaLabel(fecha)} ${diaNumero(fecha)}: ${formatCOP(total)}`}
                className={`w-full rounded-t-md ${esHoy ? "bg-indigo-600" : "bg-indigo-300"}`}
                style={{ height: `${alturaPct}%` }}
              />
            </div>
            <span className="text-[11px] text-slate-400 capitalize">{diaLabel(fecha)}</span>
          </div>
        );
      })}
    </div>
  );
}
