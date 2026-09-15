/**
 * Clases de Tailwind compartidas para botones, badges y demás — antes cada
 * página armaba su propio string de clases a mano, lo que fue generando
 * variantes ligeramente distintas del mismo botón/estado en pantallas
 * distintas. Son funciones (no componentes) para poder usarse tanto en
 * <button> como en <Link> y en ConfirmSubmitButton por igual, sin forzar
 * un tag específico.
 */

export type ButtonVariant = "primary" | "secondary" | "success" | "dark" | "destructive" | "ghost";
export type ButtonSize = "sm" | "md";

const BUTTON_BASE =
  "inline-flex items-center justify-center gap-1.5 rounded-xl font-semibold transition disabled:cursor-not-allowed disabled:opacity-60";

const BUTTON_SIZE: Record<ButtonSize, string> = {
  sm: "px-3 py-1.5 text-xs",
  md: "px-4 py-2.5 text-sm",
};

const BUTTON_VARIANT: Record<ButtonVariant, string> = {
  primary: "bg-indigo-600 text-white shadow-sm shadow-indigo-600/20 hover:bg-indigo-700",
  // Verde: acciones que "abren"/afirman algo (ej. abrir caja) — reservado a ese significado.
  success: "bg-emerald-600 text-white shadow-sm shadow-emerald-600/20 hover:bg-emerald-700",
  // Oscuro: acciones finales/de cierre (ej. cerrar caja) — distinto de "primary" para no competir con él.
  dark: "bg-slate-800 text-white hover:bg-slate-900",
  secondary: "border border-slate-300 bg-white text-slate-700 hover:bg-slate-50",
  destructive: "border border-red-200 bg-red-50 text-red-700 hover:bg-red-100",
  ghost: "text-slate-500 hover:bg-slate-100 hover:text-slate-700",
};

export function buttonClass(variant: ButtonVariant = "primary", size: ButtonSize = "md") {
  return `${BUTTON_BASE} ${BUTTON_SIZE[size]} ${BUTTON_VARIANT[variant]}`;
}

export type LinkTone = "primary" | "destructive" | "neutral" | "success";

const LINK_TONE: Record<LinkTone, string> = {
  primary: "text-indigo-700 hover:underline",
  destructive: "text-red-600 hover:underline",
  neutral: "text-slate-400 hover:text-slate-700",
  success: "text-emerald-700 hover:text-emerald-900 hover:underline",
};

/** Botón/link de acción liviana (ej. "Editar", "Desactivar", "Cancelar"). */
export function linkClass(tone: LinkTone = "primary") {
  return `text-xs font-medium transition ${LINK_TONE[tone]}`;
}

const ICON_BUTTON_SIZE: Record<"sm" | "md", string> = {
  sm: "h-8 w-8",
  md: "h-9 w-9",
};

/** Botón cuadrado de solo ícono (ej. quitar fila, colapsar sidebar). */
export function iconButtonClass(size: "sm" | "md" = "sm") {
  return `flex ${ICON_BUTTON_SIZE[size]} shrink-0 items-center justify-center rounded-lg text-slate-400 transition hover:bg-slate-100 hover:text-slate-700`;
}

export type BadgeTone = "success" | "warning" | "neutral" | "danger" | "info";

const BADGE_TONE: Record<BadgeTone, string> = {
  success: "bg-emerald-100 text-emerald-700",
  warning: "bg-amber-100 text-amber-700",
  neutral: "bg-slate-100 text-slate-500",
  danger: "bg-red-100 text-red-700",
  info: "bg-indigo-100 text-indigo-700",
};

export function badgeClass(tone: BadgeTone, size: "sm" | "md" = "sm") {
  const sizeClass = size === "sm" ? "px-2 py-0.5 text-[11px]" : "px-3 py-1 text-xs";
  return `rounded-full ${sizeClass} font-medium ${BADGE_TONE[tone]}`;
}

/**
 * Estado de una venta → texto + tono de badge. Antes cada pantalla (lista de
 * ventas, detalle, modal de personas de un tramitador) redefinía este mismo
 * mapa a mano — centralizado acá para que no se desincronicen.
 */
export const ESTADO_VENTA_LABEL: Record<string, { label: string; tone: BadgeTone }> = {
  pagada: { label: "Pagada", tone: "success" },
  abonada: { label: "Abonada", tone: "warning" },
  anulada: { label: "Anulada", tone: "neutral" },
};

export const ESTADO_COTIZACION_LABEL: Record<string, { label: string; tone: BadgeTone }> = {
  pendiente: { label: "Pendiente", tone: "info" },
  convertida: { label: "Convertida", tone: "success" },
  rechazada: { label: "Rechazada", tone: "neutral" },
};
