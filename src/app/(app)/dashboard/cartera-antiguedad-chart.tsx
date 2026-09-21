import { formatCOP } from "@/lib/format";

export type CarteraAntiguedadBucket = {
  bucket: string;
  monto: number;
  ordenes: number;
};

// Verde→ámbar→naranja→rojo: la urgencia sube con los días vencidos — el
// color nunca es la única señal, cada barra ya trae el rango de días como
// etiqueta debajo y el monto/cantidad en el title.
const BUCKET_COLOR: Record<string, string> = {
  "0-15 días": "bg-emerald-400",
  "16-30 días": "bg-amber-400",
  "31-60 días": "bg-orange-500",
  "61+ días": "bg-red-600",
};

/**
 * Barras verticales por antigüedad de la deuda (0-15 / 16-30 / 31-60 /
 * 61+ días desde que se registró la venta) — mismo criterio visual que
 * DailyChart, pero con un color por barra en vez de uno solo, para que la
 * urgencia se note sin tener que leer el eje.
 */
export function CarteraAntiguedadChart({ buckets }: { buckets: CarteraAntiguedadBucket[] }) {
  const max = Math.max(1, ...buckets.map((b) => b.monto));

  return (
    <div className="flex gap-3" style={{ height: 180 }}>
      {buckets.map((b) => {
        const alturaPct = Math.max(2, (b.monto / max) * 100);
        return (
          <div key={b.bucket} className="flex flex-1 flex-col items-center gap-1.5">
            <span className="text-center text-[11px] font-medium text-slate-600">
              {b.monto > 0 ? formatCOP(b.monto) : ""}
            </span>
            <div className="flex w-full min-h-0 flex-1 items-end">
              <div
                title={`${b.bucket}: ${formatCOP(b.monto)} — ${b.ordenes} ${b.ordenes === 1 ? "orden" : "órdenes"}`}
                className={`w-full rounded-t-md ${BUCKET_COLOR[b.bucket] ?? "bg-slate-300"}`}
                style={{ height: `${alturaPct}%` }}
              />
            </div>
            <span className="text-center text-[11px] text-slate-400">{b.bucket}</span>
          </div>
        );
      })}
    </div>
  );
}
