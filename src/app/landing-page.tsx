import { Space_Grotesk, DM_Sans } from "next/font/google";
import {
  Banknote,
  Building2,
  GraduationCap,
  ShieldCheck,
  ShoppingBag,
  Users,
} from "lucide-react";
import { LoginForm } from "./login/login-form";

const spaceGrotesk = Space_Grotesk({
  variable: "--font-display",
  subsets: ["latin"],
  weight: ["500", "600", "700"],
});

const dmSans = DM_Sans({
  variable: "--font-body",
  subsets: ["latin"],
  weight: ["400", "500", "700"],
});

const FEATURES = [
  {
    icon: ShoppingBag,
    title: "Ventas en segundos",
    description: "Varios cursos en una sola orden, descuentos, abonos y pagos divididos en múltiples métodos.",
  },
  {
    icon: Banknote,
    title: "Caja bajo control",
    description: "Apertura y cierre por sede, egresos registrados y un comprobante imprimible de cada cierre.",
  },
  {
    icon: Users,
    title: "Clientes y RUNT",
    description: "Ficha de cada estudiante con su estado de inscripción en el RUNT, siempre a un clic.",
  },
  {
    icon: GraduationCap,
    title: "Certificados auditables",
    description: "Solo se certifica a quien ya pagó el 100%, con el archivo subido y la fecha para cruzar contra la escuela.",
  },
  {
    icon: Building2,
    title: "Multi-sede",
    description: "Cada sucursal opera la suya; el administrador ve el consolidado de toda la organización.",
  },
  {
    icon: ShieldCheck,
    title: "Seguridad primero",
    description: "PIN de autorización para ventas con poco anticipo, y permisos claros entre admin y recepción.",
  },
];

export function LandingPage() {
  return (
    <div className={`${spaceGrotesk.variable} ${dmSans.variable} flex min-h-svh flex-col bg-slate-950`}>
      <style>{`
        .font-display { font-family: var(--font-display), sans-serif; }
        .font-body { font-family: var(--font-body), sans-serif; }
        @keyframes drift {
          0%, 100% { transform: translate(0, 0) scale(1); }
          50% { transform: translate(3%, -4%) scale(1.05); }
        }
        @media (prefers-reduced-motion: no-preference) {
          .blob { animation: drift 14s ease-in-out infinite; }
        }
      `}</style>

      <header className="relative z-10 flex items-center justify-between gap-3 px-6 py-6 sm:px-10">
        <span className="font-display min-w-0 truncate text-base font-bold text-white sm:text-lg">
          Gestia App Conductores
        </span>
        <a
          href="#ingresar"
          className="shrink-0 rounded-full bg-white px-5 py-2.5 text-sm font-semibold text-slate-900 transition hover:bg-slate-100"
        >
          Iniciar sesión
        </a>
      </header>

      <main className="relative flex-1">
        {/* Hero */}
        <section className="relative isolate overflow-hidden px-6 pt-12 pb-24 sm:px-10 sm:pt-16 sm:pb-32">
          <div
            aria-hidden="true"
            className="blob pointer-events-none absolute -top-40 left-1/2 h-[560px] w-[560px] -translate-x-1/2 rounded-full bg-gradient-to-tr from-indigo-600 via-violet-600 to-fuchsia-500 opacity-40 blur-[120px]"
          />

          <div className="relative mx-auto grid max-w-6xl grid-cols-1 items-center gap-14 lg:grid-cols-[1.1fr_0.9fr] lg:gap-10">
            <div className="flex flex-col items-center text-center lg:items-start lg:text-left">
              <span className="font-body rounded-full border border-white/15 bg-white/5 px-4 py-1.5 text-xs font-medium tracking-wide text-indigo-200 uppercase">
                Para escuelas de conducción
              </span>

              <h1 className="font-display mt-6 flex flex-col">
                <span className="text-[clamp(2.25rem,5vw,3.75rem)] leading-[1.05] font-bold tracking-tight text-white">
                  Gestia
                </span>
                <span className="mt-1 text-[clamp(1.1rem,2.4vw,1.75rem)] font-semibold tracking-tight bg-gradient-to-r from-indigo-400 via-violet-400 to-fuchsia-400 bg-clip-text text-transparent">
                  App Conductores
                </span>
              </h1>

              <p className="font-body mt-5 max-w-lg text-lg text-slate-300">
                Ventas, caja, clientes y certificados RUNT — todo en un solo lugar, para que tu
                escuela de conducción deje de operar a punta de cuadernos y Excel.
              </p>

              <a
                href="#funciones"
                className="font-body mt-8 rounded-full border border-white/20 px-8 py-3.5 text-center text-base font-medium text-slate-200 transition hover:bg-white/5"
              >
                Ver qué incluye
              </a>
            </div>

            <div id="ingresar" className="w-full scroll-mt-10 justify-self-center lg:justify-self-end">
              <div className="w-full max-w-sm rounded-2xl border border-slate-200 bg-white p-6 shadow-2xl shadow-indigo-950/40">
                <div className="mb-5 text-center">
                  <h2 className="font-display text-lg font-semibold text-slate-900">Iniciar sesión</h2>
                  <p className="font-body mt-1 text-sm text-slate-500">
                    Ingresá con la cuenta que te dio tu escuela.
                  </p>
                </div>
                <LoginForm redirectTo="/" />
              </div>
            </div>
          </div>
        </section>

        {/* Features */}
        <section id="funciones" className="relative border-t border-white/10 bg-slate-950 px-6 py-20 sm:px-10">
          <div className="mx-auto max-w-6xl">
            <div className="mx-auto max-w-2xl text-center">
              <h2 className="font-display text-3xl font-bold text-white sm:text-4xl">
                Todo lo que tu escuela necesita
              </h2>
              <p className="font-body mt-3 text-slate-400">
                Pensado para el día a día de recepción y la mirada completa del administrador.
              </p>
            </div>

            <div className="mt-14 grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
              {FEATURES.map(({ icon: Icon, title, description }) => (
                <div
                  key={title}
                  className="rounded-2xl border border-white/10 bg-white/[0.03] p-6 transition hover:border-white/20 hover:bg-white/[0.05]"
                >
                  <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-gradient-to-br from-indigo-500 to-fuchsia-500">
                    <Icon className="h-5 w-5 text-white" aria-hidden="true" />
                  </span>
                  <h3 className="font-display mt-4 text-lg font-semibold text-white">{title}</h3>
                  <p className="font-body mt-1.5 text-sm text-slate-400">{description}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* CTA */}
        <section className="relative border-t border-white/10 px-6 py-20 sm:px-10">
          <div
            aria-hidden="true"
            className="pointer-events-none absolute inset-x-0 bottom-0 h-64 bg-gradient-to-t from-indigo-950/60 to-transparent"
          />
          <div className="relative mx-auto flex max-w-3xl flex-col items-center text-center">
            <h2 className="font-display text-3xl font-bold text-white sm:text-4xl">
              ¿Ya te la recomendaron?
            </h2>
            <p className="font-body mt-3 max-w-xl text-slate-400">
              Ingresá con la cuenta que te dio el administrador de tu escuela.
            </p>
            <a
              href="#ingresar"
              className="mt-8 rounded-full bg-gradient-to-r from-indigo-500 to-fuchsia-500 px-8 py-3.5 text-base font-semibold text-white shadow-lg shadow-indigo-950/40 transition hover:brightness-110"
            >
              Iniciar sesión
            </a>
          </div>
        </section>
      </main>

      <footer className="relative border-t border-white/10 px-6 py-8 text-center sm:px-10">
        <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-2 sm:flex-row">
          <span className="font-display text-sm font-semibold text-white">Gestia App Conductores</span>
          <p className="font-body text-xs text-slate-500">
            © {new Date().getFullYear()} Conductores App Group
          </p>
        </div>
      </footer>
    </div>
  );
}
