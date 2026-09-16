import {
  ArrowLeftRight,
  Banknote,
  CircleDollarSign,
  CreditCard,
  RefreshCw,
  Smartphone,
  Wallet,
  type LucideIcon,
} from "lucide-react";
import type { MetodoPago } from "./supabase/types";

export type MetodoPagoStyle = {
  icon: LucideIcon;
  bg: string;
  border: string;
  text: string;
  iconBg: string;
};

/**
 * Color + ícono por método de pago — antes el cierre de caja mostraba
 * todos los métodos como texto plano en una lista, difícil de
 * diferenciar de un vistazo (ej. cuánto fue en efectivo vs. Nequi).
 * Cada método tiene su propio color para que el ojo lo agrupe rápido,
 * pero el ícono + la etiqueta de texto siguen ahí siempre — el color
 * nunca es la única señal.
 */
export const METODO_PAGO_STYLE: Record<MetodoPago, MetodoPagoStyle> = {
  efectivo: {
    icon: Banknote,
    bg: "bg-emerald-50",
    border: "border-emerald-200",
    text: "text-emerald-700",
    iconBg: "bg-emerald-100",
  },
  transferencia: {
    icon: ArrowLeftRight,
    bg: "bg-sky-50",
    border: "border-sky-200",
    text: "text-sky-700",
    iconBg: "bg-sky-100",
  },
  nequi: {
    icon: Smartphone,
    bg: "bg-fuchsia-50",
    border: "border-fuchsia-200",
    text: "text-fuchsia-700",
    iconBg: "bg-fuchsia-100",
  },
  tarjeta: {
    icon: CreditCard,
    bg: "bg-indigo-50",
    border: "border-indigo-200",
    text: "text-indigo-700",
    iconBg: "bg-indigo-100",
  },
  addi: {
    icon: CreditCard,
    bg: "bg-orange-50",
    border: "border-orange-200",
    text: "text-orange-700",
    iconBg: "bg-orange-100",
  },
  credito: {
    icon: Wallet,
    bg: "bg-amber-50",
    border: "border-amber-200",
    text: "text-amber-700",
    iconBg: "bg-amber-100",
  },
  brilla: {
    icon: Wallet,
    bg: "bg-cyan-50",
    border: "border-cyan-200",
    text: "text-cyan-700",
    iconBg: "bg-cyan-100",
  },
  sistecredito: {
    icon: Wallet,
    bg: "bg-violet-50",
    border: "border-violet-200",
    text: "text-violet-700",
    iconBg: "bg-violet-100",
  },
  cruce_tramitador: {
    icon: RefreshCw,
    bg: "bg-teal-50",
    border: "border-teal-200",
    text: "text-teal-700",
    iconBg: "bg-teal-100",
  },
  otro: {
    icon: CircleDollarSign,
    bg: "bg-slate-50",
    border: "border-slate-200",
    text: "text-slate-600",
    iconBg: "bg-slate-100",
  },
};
