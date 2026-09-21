import Link from "next/link";
import { formatCOP } from "@/lib/format";

export type CarteraPorSede = {
  sedeId: string;
  sedeNombre: string;
  monto: number;
  alumnos: number;
};

/**
 * Barras horizontales — una por sede de escuela — para comparar de un
 * vistazo dónde está concentrada la cartera pendiente. Sin librería de
 * gráficos, mismo criterio que el resto del dashboard (DailyChart,
 * MonthlyYearChart): HTML/CSS puro, un solo hue (ámbar = plata pendiente).
 */
export function CarteraPorSedeChart({ sedes }: { sedes: CarteraPorSede[] }) {
  const max = Math.max(1, ...sedes.map((s) => s.monto));

  if (sedes.every((s) => s.monto === 0)) {
    return (
      <p className="py-6 text-center text-sm text-slate-400">
        Sin cartera pendiente en las sedes de escuela.
      </p>
    );
  }

  return (
    <div className="flex flex-col gap-3.5">
      {sedes.map((s) => {
        const anchoPct = Math.max(2, (s.monto / max) * 100);
        return (
          <Link
            key={s.sedeId}
            href={`/admin/mora?sede=${s.sedeId}`}
            className="flex flex-col gap-1 rounded-lg -m-1 p-1 transition hover:bg-slate-50"
            title="Ver quién debe en esta sede"
          >
            <div className="flex items-baseline justify-between gap-2 text-xs">
              <span className="font-medium text-indigo-700 hover:underline">{s.sedeNombre}</span>
              <span className="shrink-0 text-slate-500">
                {formatCOP(s.monto)} · {s.alumnos} {s.alumnos === 1 ? "alumno" : "alumnos"}
              </span>
            </div>
            <div className="h-3 w-full overflow-hidden rounded-full bg-slate-100">
              <div
                title={`${s.sedeNombre}: ${formatCOP(s.monto)}`}
                className="h-full rounded-full bg-amber-500"
                style={{ width: `${anchoPct}%` }}
              />
            </div>
          </Link>
        );
      })}
    </div>
  );
}
