import { Crown, Flame, Sparkles, Star, Trophy } from "lucide-react";
import type { ReactNode } from "react";

type Tramo = {
  minimo: number;
  mensaje: string;
  icono: ReactNode;
  gradiente: string;
  texto: string;
  iconoTono: string;
};

// De más alto a más bajo — se usa el primero cuyo mínimo alcance la
// cantidad de ventas de hoy. Los mensajes van escalando en energía a
// propósito (de "vamos arrancando" a "eres la mejor vendedora"), pensados
// para la recepcionista/cajera que ve este dashboard, no para el admin.
// Colores pastel/crema (tonos 200-300, un punto más saturados que un pastel
// "lavado") — el texto va en un tono fuerte del mismo color para que siga
// siendo legible.
const TRAMOS: Tramo[] = [
  {
    minimo: 20,
    mensaje: "Eres la mejor vendedora. Tu jefa se va a poner muy contenta al ver estas ventas hoy.",
    icono: <Crown className="h-4.5 w-4.5" aria-hidden="true" />,
    gradiente: "from-amber-200 via-orange-200 to-pink-200",
    texto: "text-amber-900",
    iconoTono: "text-amber-600",
  },
  {
    minimo: 15,
    mensaje: "¡Imparable! Ya casi llegás a las 20 — dale con todo, hoy es tu día.",
    icono: <Trophy className="h-4.5 w-4.5" aria-hidden="true" />,
    gradiente: "from-fuchsia-200 via-purple-200 to-indigo-200",
    texto: "text-purple-900",
    iconoTono: "text-purple-600",
  },
  {
    minimo: 10,
    mensaje: "¡10 ventas! Estás en racha — el día se está poniendo muy bueno.",
    icono: <Star className="h-4.5 w-4.5" aria-hidden="true" />,
    gradiente: "from-rose-200 via-pink-200 to-fuchsia-200",
    texto: "text-rose-900",
    iconoTono: "text-rose-500",
  },
  {
    minimo: 6,
    mensaje: "¡Buen ritmo! Ya vas por buen camino, no lo bajes.",
    icono: <Flame className="h-4.5 w-4.5" aria-hidden="true" />,
    gradiente: "from-orange-200 to-amber-200",
    texto: "text-orange-900",
    iconoTono: "text-orange-500",
  },
  {
    minimo: 3,
    mensaje: "Vamos bien el día de hoy. No te desanimes, esto se va a poner bueno.",
    icono: <Flame className="h-4.5 w-4.5" aria-hidden="true" />,
    gradiente: "from-amber-100 to-amber-200",
    texto: "text-amber-900",
    iconoTono: "text-amber-500",
  },
  {
    minimo: 1,
    mensaje: "Ya arrancamos — cada venta cuenta, seguí así.",
    icono: <Sparkles className="h-4.5 w-4.5" aria-hidden="true" />,
    gradiente: "from-indigo-100 to-indigo-200",
    texto: "text-indigo-900",
    iconoTono: "text-indigo-500",
  },
  {
    minimo: 0,
    mensaje: "Hoy es un nuevo día para vender — ¡vamos con toda!",
    icono: <Sparkles className="h-4.5 w-4.5" aria-hidden="true" />,
    gradiente: "from-slate-100 to-slate-200",
    texto: "text-slate-700",
    iconoTono: "text-slate-500",
  },
];

function tramoDe(cantidad: number): Tramo {
  return TRAMOS.find((t) => cantidad >= t.minimo) ?? TRAMOS[TRAMOS.length - 1];
}

/**
 * Banner motivador para la cajera/recepcionista — cuántas personas lleva
 * atendidas (vendidas) hoy, con un mensaje que sube de energía por
 * tramos (3/6/10/15/20). Puramente de ánimo: no afecta ninguna métrica
 * real, solo cuenta las ventas de hoy que ya se le pasan al dashboard.
 */
export function VentasHoyMotivador({ cantidad }: { cantidad: number }) {
  const tramo = tramoDe(cantidad);

  return (
    <div className={`overflow-hidden rounded-2xl bg-gradient-to-br ${tramo.gradiente} p-4 shadow-sm`}>
      <div className="flex items-center gap-3.5">
        <span
          className={`flex h-[3.15rem] w-[3.15rem] shrink-0 items-center justify-center rounded-2xl bg-white/70 ${tramo.iconoTono}`}
        >
          {tramo.icono}
        </span>
        <div className="min-w-0">
          <div className="flex items-baseline gap-2">
            <span className={`text-[1.65rem] leading-none font-bold ${tramo.texto}`}>{cantidad}</span>
            <span className={`text-xs font-medium opacity-80 ${tramo.texto}`}>
              {cantidad === 1 ? "persona vendida hoy" : "personas vendidas hoy"}
            </span>
          </div>
          <p className={`mt-1 text-xs opacity-90 ${tramo.texto}`}>{tramo.mensaje}</p>
        </div>
      </div>
    </div>
  );
}
