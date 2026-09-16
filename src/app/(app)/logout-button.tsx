"use client";

import { useActionState } from "react";
import { LogOut } from "lucide-react";
import { logoutGuarded } from "./logout-action";
import { iconButtonClass } from "@/lib/ui";

/**
 * Botón de cerrar sesión — si la caja de la sede sigue abierta, en vez de
 * bloquear directo pide el PIN de administrador (ver logoutGuarded). Con
 * el PIN correcto sale igual; la caja se queda abierta, es solo una
 * autorización para salir sin cerrarla primero.
 */
export function LogoutButton() {
  const [state, formAction, pending] = useActionState(logoutGuarded, {});

  if (state.requierePin) {
    return (
      <form action={formAction} className="flex flex-col gap-1.5 px-1">
        <p className="text-[10px] leading-tight text-amber-600">
          La caja de tu sede sigue abierta. Pedile el PIN a un administrador para salir igual.
        </p>
        <div className="flex items-center gap-1">
          <input
            type="password"
            name="pin"
            inputMode="numeric"
            placeholder="PIN"
            autoFocus
            required
            className="w-16 min-w-0 rounded-lg border border-slate-300 px-2 py-1 text-xs text-slate-900 outline-none focus:border-indigo-600 focus:ring-1 focus:ring-indigo-600"
          />
          <button
            type="submit"
            disabled={pending}
            title="Confirmar y salir"
            className={iconButtonClass("sm")}
          >
            <LogOut className="h-4 w-4" />
          </button>
        </div>
        {state.error ? <p className="text-[10px] text-red-600">{state.error}</p> : null}
      </form>
    );
  }

  return (
    <form action={formAction}>
      <button type="submit" disabled={pending} title="Salir" className={iconButtonClass("sm")}>
        <LogOut className="h-4 w-4" />
      </button>
    </form>
  );
}
