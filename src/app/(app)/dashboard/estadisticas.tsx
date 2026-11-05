import { formatCOP } from "@/lib/format";
import Link from "next/link";
import { opcionesRango, type Estadisticas, type RangoEstadisticas } from "@/lib/estadisticas";

// Color por sede: se reconoce por el nombre para que cada sede tenga siempre el mismo color.
const COLORES_SEDE: { clave: string; barra: string; punto: string }[] = [
  { clave: "CALI", barra: "bg-indigo-600", punto: "bg-indigo-600" },
  { clave: "VALORAR", barra: "bg-teal-600", punto: "bg-teal-600" },
  { clave: "JAMUNDI", barra: "bg-amber-500", punto: "bg-amber-500" },
  { clave: "SANTANDER", barra: "bg-pink-600", punto: "bg-pink-600" },
];
const COLOR_DEFECTO = { barra: "bg-slate-500", punto: "bg-slate-500" };
const colorSede = (nombre: string) =>
  COLORES_SEDE.find((c) => nombre.toUpperCase().includes(c.clave)) ?? COLOR_DEFECTO;

const millones = (n: number) => `${(n / 1_000_000).toFixed(1).replace(".", ",")} M`;
const etiquetaPeriodo = (inicio: string) =>
  new Intl.DateTimeFormat("es-CO", { timeZone: "UTC", day: "numeric", month: "short" }).format(
    new Date(`${inicio}T00:00:00Z`),
  );

type SedeInfo = { id: string; name: string };

/**
 * Estadísticas de las últimas 8 semanas del admin. Todo con HTML/CSS (sin
 * librería de gráficos), igual que el resto del dashboard: barras ancladas a
 * la base, sin eje, con el valor sobre cada barra. Sirve para "todas las
 * sedes" (barras apiladas por sede) o para una sola (barras de un color).
 */
export function EstadisticasAdmin({
  stats,
  sedes,
  sedeId,
  rango,
}: {
  stats: Estadisticas;
  sedes: SedeInfo[];
  sedeId: string | null;
  rango: RangoEstadisticas;
}) {
  const sedesEnGrafica = sedeId ? sedes.filter((s) => s.id === sedeId) : sedes;
  const maxSemana = Math.max(1, ...stats.periodos.map((s) => s.total));
  const porDia = stats.granularidad === "dia";
  const muchas = stats.periodos.length > 12;
  const maxHora = Math.max(1, ...stats.horas);
  const maxDia = Math.max(1, ...stats.dias);
  const maxTop = Math.max(1, ...stats.top.map((t) => t.cantidad));
  const horasMostradas = stats.horas.map((n, h) => ({ h, n })).filter(({ h }) => h >= 6 && h <= 21);
  const DIAS = ["Lun", "Mar", "Mié", "Jue", "Vie", "Sáb", "Dom"];

  return (
    <section className="flex flex-col gap-4" aria-label="Estadísticas">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold text-slate-900">Estadísticas — <span className="capitalize">{rango.titulo}</span></h2>
          <p className="text-xs text-slate-500">Ventas reales de Gestia, sin anuladas ni la cartera migrada.</p>
        </div>
        <nav aria-label="Rango de fechas" className="flex flex-wrap gap-1.5">
          {opcionesRango().map((r) => (
            <Link
              key={r.clave}
              href={`?${new URLSearchParams({ ...(sedeId ? { sede: sedeId } : { sede: "all" }), rango: r.clave }).toString()}`}
              scroll={false}
              aria-current={r.clave === rango.clave ? "true" : undefined}
              className={`rounded-full border px-3 py-1.5 text-xs font-medium capitalize transition ${
                r.clave === rango.clave
                  ? "border-slate-900 bg-slate-900 text-white"
                  : "border-slate-300 bg-white text-slate-600 hover:bg-slate-100"
              }`}
            >
              {r.label}
            </Link>
          ))}
        </nav>
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-5">
        <Dato label="Ventas" value={formatCOP(stats.ventas)} />
        <Dato label="Órdenes" value={String(stats.ordenes)} />
        <Dato label="Ticket promedio" value={formatCOP(stats.ticketPromedio)} />
        <Dato label="Por tramitador" value={`${stats.pctTramitador}%`} />
        <Dato label="Cursos vendidos (PIN)" value={String(stats.cursos)} />
      </div>

      <div className="rounded-2xl border border-slate-200 bg-white p-4 sm:p-5">
        <h3 className="text-sm font-semibold text-slate-800">{porDia ? "Ventas por día" : "Ventas por semana"}</h3>
        {!sedeId ? (
          <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-slate-500">
            {sedesEnGrafica.map((s) => (
              <span key={s.id} className="inline-flex items-center gap-1.5">
                <span className={`h-2.5 w-2.5 rounded-sm ${colorSede(s.name).punto}`} />
                {s.name}
              </span>
            ))}
          </div>
        ) : null}
        <div className={`mt-3 flex ${muchas ? "gap-0.5" : "gap-1.5 sm:gap-3"}`} style={{ height: 220 }}>
          {stats.periodos.map((sem, idx) => (
            <div key={sem.inicio} className="flex min-w-0 flex-1 flex-col items-center gap-1.5">
              <span className="h-3 text-[10px] font-medium text-slate-600 sm:text-[11px]">
                {!muchas && sem.total > 0 ? millones(sem.total) : ""}
              </span>
              <div className="flex min-h-0 w-full flex-1 flex-col-reverse overflow-hidden rounded-t-md">
                {sedesEnGrafica.map((s) => {
                  const valor = sem.porSede[s.id] ?? 0;
                  if (valor <= 0) return null;
                  return (
                    <div
                      key={s.id}
                      title={`${s.name}: ${formatCOP(valor)}`}
                      className={`w-full border-t border-white/70 ${colorSede(s.name).barra}`}
                      style={{ height: `${(valor / maxSemana) * 100}%` }}
                    />
                  );
                })}
              </div>
              <span className="h-3 whitespace-nowrap text-[10px] text-slate-400 capitalize sm:text-[11px]">
                {!muchas || idx % Math.ceil(stats.periodos.length / 6) === 0 ? etiquetaPeriodo(sem.inicio) : ""}
              </span>
            </div>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <div className="rounded-2xl border border-slate-200 bg-white p-4 sm:p-5">
          <h3 className="mb-3 text-sm font-semibold text-slate-800">Lo que más se vende</h3>
          {stats.top.length === 0 ? (
            <p className="py-6 text-center text-sm text-slate-400">Sin ventas en el período.</p>
          ) : (
            <ul className="flex flex-col gap-2.5">
              {stats.top.map((t) => (
                <li key={t.nombre} className="flex flex-col gap-1">
                  <div className="flex items-center justify-between gap-3 text-xs">
                    <span className="min-w-0 truncate font-medium text-slate-700">{t.nombre}</span>
                    <span className="shrink-0 text-slate-500">{t.cantidad}</span>
                  </div>
                  <div className="h-2 w-full overflow-hidden rounded-full bg-slate-100">
                    <div className="h-full rounded-full bg-teal-600" style={{ width: `${Math.max(3, (t.cantidad / maxTop) * 100)}%` }} />
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className="flex flex-col gap-4">
          <div className="rounded-2xl border border-slate-200 bg-white p-4 sm:p-5">
            <h3 className="text-sm font-semibold text-slate-800">A qué hora se vende</h3>
            <p className="mb-3 text-xs text-slate-400">Órdenes por hora del día.</p>
            <Columnas
              datos={horasMostradas.map(({ h, n }) => ({ etiqueta: h % 2 === 0 ? String(h) : "", valor: n }))}
              max={maxHora}
              alto={110}
            />
          </div>
          <div className="rounded-2xl border border-slate-200 bg-white p-4 sm:p-5">
            <h3 className="text-sm font-semibold text-slate-800">Qué día se vende</h3>
            <p className="mb-3 text-xs text-slate-400">Órdenes por día de la semana.</p>
            <Columnas datos={stats.dias.map((n, i) => ({ etiqueta: DIAS[i], valor: n }))} max={maxDia} alto={110} />
          </div>
        </div>
      </div>
    </section>
  );
}

function Dato({ label, value }: { label: string; value: string }) {
  return (
    <div className="min-w-0 rounded-xl border border-slate-200 bg-white p-3.5">
      <p className="text-xs text-slate-500">{label}</p>
      <p className="mt-1 truncate text-lg font-semibold text-slate-900 tabular-nums sm:text-xl">{value}</p>
    </div>
  );
}

/** Columnas simples con la más alta resaltada — para horas y días. */
function Columnas({ datos, max, alto }: { datos: { etiqueta: string; valor: number }[]; max: number; alto: number }) {
  return (
    <div className="flex items-end gap-1" style={{ height: alto + 18 }}>
      {datos.map((d, i) => (
        <div key={i} className="flex min-w-0 flex-1 flex-col items-center gap-1">
          <div className="flex w-full items-end" style={{ height: alto }}>
            <div
              title={`${d.valor}`}
              className={`w-full rounded-t-sm ${d.valor === max && d.valor > 0 ? "bg-indigo-600" : "bg-slate-200"}`}
              style={{ height: `${d.valor > 0 ? Math.max(3, (d.valor / max) * 100) : 0}%` }}
            />
          </div>
          <span className="h-3 text-[10px] text-slate-400">{d.etiqueta}</span>
        </div>
      ))}
    </div>
  );
}
