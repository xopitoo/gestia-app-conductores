import type { Metadata } from "next";
import { LoginForm } from "./login-form";

export const metadata: Metadata = {
  title: "Ingresar | Gestia App Conductores",
};

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ redirect?: string }>;
}) {
  const { redirect } = await searchParams;

  return (
    <div className="flex min-h-svh flex-1 flex-col items-center justify-center bg-slate-50 px-4 py-12">
      <div className="w-full max-w-sm">
        <div className="mb-8 text-center">
          <h1 className="text-lg font-semibold text-slate-900">
            Gestia App Conductores
          </h1>
          <p className="mt-1 text-sm text-slate-500">
            Ingresá con tu cuenta para continuar.
          </p>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-xl shadow-slate-900/5">
          <LoginForm redirectTo={redirect ?? "/"} />
        </div>

        <p className="mt-6 text-center text-xs text-slate-400">
          ¿Problemas para ingresar? Contactá al administrador de tu cuenta.
        </p>
        <p className="mt-2 text-center text-[11px] text-slate-300">
          © {new Date().getFullYear()} Conductores App Group
        </p>
      </div>
    </div>
  );
}
