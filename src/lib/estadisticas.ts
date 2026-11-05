import type { createClient } from "@/lib/supabase/server";
import { bogotaTodayRange } from "@/lib/bogota-date";

type Supabase = Awaited<ReturnType<typeof createClient>>;

const OFFSET_BOGOTA_MS = 5 * 3600 * 1000;
const DIA_MS = 86_400_000;

/** Rango que elige el admin: días corridos terminando hoy, o un mes calendario (YYYY-MM). */
export type RangoEstadisticas = {
  clave: string;
  label: string;
  titulo: string;
  /** Inicio (00:00 Bogotá) del primer y del último día incluidos. */
  inicio: Date;
  fin: Date;
};

const nombreMes = (anio: number, mes: number, opts: Intl.DateTimeFormatOptions) =>
  new Intl.DateTimeFormat("es-CO", { timeZone: "UTC", ...opts }).format(new Date(Date.UTC(anio, mes, 1)));

/** 15 días, el mes en curso con los 3 anteriores, 2 y 3 meses (en ese orden de botones). */
export function opcionesRango(): RangoEstadisticas[] {
  const { start: hoy } = bogotaTodayRange();
  const local = new Date(hoy.getTime() - OFFSET_BOGOTA_MS);
  const anio = local.getUTCFullYear();
  const mes = local.getUTCMonth();
  const dias = (n: number, clave: string, label: string): RangoEstadisticas => ({
    clave,
    label,
    titulo: `últimos ${n} días`,
    inicio: new Date(hoy.getTime() - (n - 1) * DIA_MS),
    fin: hoy,
  });
  const meses: RangoEstadisticas[] = [];
  for (let k = 0; k < 4; k++) {
    const d = new Date(Date.UTC(anio, mes - k, 1));
    const a = d.getUTCFullYear();
    const m = d.getUTCMonth();
    const finMes = Date.UTC(a, m + 1, 0, 5);
    meses.push({
      clave: `${a}-${String(m + 1).padStart(2, "0")}`,
      label: k === 0 ? "Este mes" : nombreMes(a, m, { month: "short" }).replace(".", ""),
      titulo: `${nombreMes(a, m, { month: "long", year: "numeric" })}${k === 0 ? " (en curso)" : ""}`,
      inicio: new Date(Date.UTC(a, m, 1, 5)),
      fin: new Date(Math.min(finMes, hoy.getTime())),
    });
  }
  return [dias(15, "15d", "15 días"), ...meses, dias(60, "2m", "2 meses"), dias(90, "3m", "3 meses")];
}

/** El rango pedido en la URL; si no existe, el mes en curso. */
export const rangoDe = (clave?: string): RangoEstadisticas => {
  const todas = opcionesRango();
  return todas.find((r) => r.clave === clave) ?? todas[1];
};

export type PeriodoStats = {
  /** Día (rangos de hasta 31 días) o lunes de la semana (rangos más largos), YYYY-MM-DD en hora de Bogotá. */
  inicio: string;
  porSede: Record<string, number>;
  total: number;
};

export type Estadisticas = {
  granularidad: "dia" | "semana";
  periodos: PeriodoStats[];
  ventas: number;
  ordenes: number;
  ticketPromedio: number;
  pctTramitador: number;
  /** Cursos reales vendidos = PIN registrados en el rango (solo CEAPP). */
  cursos: number;
  top: { nombre: string; cantidad: number }[];
  /** Órdenes por hora del día (0-23, hora de Bogotá). */
  horas: number[];
  /** Órdenes por día de la semana, lunes = 0 … domingo = 6. */
  dias: number[];
};

/** Hora de Bogotá de un instante UTC, leída con los getters UTC de un Date corrido -5h. */
function bogota(iso: string) {
  return new Date(new Date(iso).getTime() - OFFSET_BOGOTA_MS);
}

function lunesDe(d: Date): string {
  const copia = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
  copia.setUTCDate(copia.getUTCDate() - ((copia.getUTCDay() + 6) % 7));
  return copia.toISOString().slice(0, 10);
}

/**
 * Estadísticas de un rango de días (hora de Bogotá). Se
 * excluyen las ventas anuladas y la cartera migrada del sistema viejo
 * ("migracion historica"), que no es actividad real de Gestia. Hasta 30 días
 * se agrupa por día; más largo, por semana (lunes a domingo). Se recorre en
 * páginas de 1000 porque PostgREST corta cada consulta ahí.
 */
export async function getEstadisticas(supabase: Supabase, sedeId: string | null, rango: RangoEstadisticas): Promise<Estadisticas> {
  const inicioDia = rango.inicio;
  const finDia = rango.fin;
  const granularidad = (finDia.getTime() - inicioDia.getTime()) / DIA_MS < 31 ? "dia" : "semana";
  const desde = inicioDia.toISOString();
  const hasta = new Date(finDia.getTime() + DIA_MS).toISOString();
  const clavePeriodo = (local: Date) => (granularidad === "dia" ? local.toISOString().slice(0, 10) : lunesDe(local));

  const ventas: {
    id: string;
    sede_id: string;
    created_at: string;
    monto: number;
    descuento: number;
    incremento: number;
    tramitador_id: string | null;
  }[] = [];
  for (let from = 0; ; from += 1000) {
    let q = supabase
      .from("ventas")
      .select("id, sede_id, created_at, monto, descuento, incremento, tramitador_id")
      .gte("created_at", desde)
      .lt("created_at", hasta)
      .neq("estado", "anulada")
      .not("concepto", "ilike", "%migracion historica%")
      .order("created_at")
      .range(from, from + 999);
    if (sedeId) q = q.eq("sede_id", sedeId);
    const { data } = await q;
    ventas.push(...(data ?? []));
    if ((data?.length ?? 0) < 1000) break;
  }

  // Cursos reales: un PIN registrado = un curso vendido (ventas vivas del rango).
  let cursos = 0;
  {
    const idsVivas = new Set(ventas.map((v) => v.id));
    for (let from = 0; ; from += 1000) {
      let q = supabase
        .from("venta_pines")
        .select("venta_id")
        .gte("created_at", desde)
        .lt("created_at", hasta)
        .order("created_at")
        .range(from, from + 999);
      if (sedeId) q = q.eq("sede_id", sedeId);
      const { data } = await q;
      cursos += (data ?? []).filter((p) => idsVivas.has(p.venta_id)).length;
      if ((data?.length ?? 0) < 1000) break;
    }
  }

  const ids = new Set(ventas.map((v) => v.id));
  const conteoProductos = new Map<string, { nombre: string; cantidad: number }>();
  for (let from = 0; ; from += 1000) {
    let q = supabase
      .from("venta_items")
      .select("venta_id, nombre")
      .gte("created_at", desde)
      .lt("created_at", hasta)
      .not("nombre", "ilike", "%migracion historica%")
      .order("created_at")
      .range(from, from + 999);
    if (sedeId) q = q.eq("sede_id", sedeId);
    const { data } = await q;
    for (const i of data ?? []) {
      if (!ids.has(i.venta_id)) continue;
      const nombre = i.nombre.replace(/\s*\(tramitador\)\s*$/i, "").trim();
      const clave = nombre.toUpperCase();
      const previo = conteoProductos.get(clave);
      if (previo) previo.cantidad += 1;
      else conteoProductos.set(clave, { nombre, cantidad: 1 });
    }
    if ((data?.length ?? 0) < 1000) break;
  }

  const periodos: PeriodoStats[] = [];
  const indicePeriodo = new Map<string, number>();
  for (let t = inicioDia.getTime(); t <= finDia.getTime(); t += DIA_MS) {
    const clave = clavePeriodo(bogota(new Date(t).toISOString()));
    if (!indicePeriodo.has(clave)) {
      indicePeriodo.set(clave, periodos.length);
      periodos.push({ inicio: clave, porSede: {}, total: 0 });
    }
  }
  const horas = Array<number>(24).fill(0);
  const dias = Array<number>(7).fill(0);
  let total = 0;
  let conTramitador = 0;

  for (const v of ventas) {
    const local = bogota(v.created_at);
    const neto = v.monto - v.descuento + v.incremento;
    const i = indicePeriodo.get(clavePeriodo(local));
    if (i !== undefined) {
      periodos[i].porSede[v.sede_id] = (periodos[i].porSede[v.sede_id] ?? 0) + neto;
      periodos[i].total += neto;
    }
    horas[local.getUTCHours()] += 1;
    dias[(local.getUTCDay() + 6) % 7] += 1;
    total += neto;
    if (v.tramitador_id) conTramitador += 1;
  }

  return {
    granularidad,
    periodos,
    ventas: total,
    ordenes: ventas.length,
    ticketPromedio: ventas.length ? Math.round(total / ventas.length) : 0,
    cursos,
    pctTramitador: ventas.length ? Math.round((100 * conTramitador) / ventas.length) : 0,
    top: [...conteoProductos.values()].sort((a, b) => b.cantidad - a.cantidad).slice(0, 8),
    horas,
    dias,
  };
}
