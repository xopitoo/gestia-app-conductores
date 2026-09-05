import { CheckCircle2, XCircle } from "lucide-react";

/**
 * Estado de inscripción en el RUNT. Nunca solo color — siempre con ícono +
 * texto, para que no dependa de distinguir verde/rojo.
 */
export function RuntBadge({ runt }: { runt: boolean }) {
  if (runt) {
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-emerald-100 px-2 py-0.5 text-[11px] font-medium text-emerald-700">
        <CheckCircle2 className="h-3 w-3" aria-hidden="true" />
        RUNT
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1 rounded-full bg-red-100 px-2 py-0.5 text-[11px] font-medium text-red-700">
      <XCircle className="h-3 w-3" aria-hidden="true" />
      Sin RUNT
    </span>
  );
}
