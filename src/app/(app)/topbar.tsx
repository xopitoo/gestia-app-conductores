import { ROLE_LABEL } from "./sidebar";
import { NotificationBell } from "./notification-bell";
import type { ClienteCumpleanos } from "@/lib/cumpleanos";
import type { ClienteLicencia } from "@/lib/licencias";

/**
 * Identidad del usuario (foto/iniciales, nombre, correo) + campana de
 * notificaciones — antes esto vivía solo como un bloque chico al fondo del
 * sidebar, sin correo ni nada que se pareciera a "notificaciones". La
 * campana junta cosas reales (nunca un contador inventado): ventas con
 * saldo pendiente, y cumpleaños de clientes — ver notification-bell.tsx.
 */
export function Topbar({
  fullName,
  email,
  initials,
  role,
  pendientesCount,
  cumpleanos,
  vencimientosLicencia,
}: {
  fullName: string;
  email: string | null;
  initials: string;
  role: "admin" | "recepcionista";
  pendientesCount: number;
  cumpleanos: ClienteCumpleanos[];
  vencimientosLicencia: ClienteLicencia[];
}) {
  return (
    <div className="mb-6 flex items-center justify-end gap-3 print:hidden">
      <NotificationBell
        pendientesCount={pendientesCount}
        cumpleanos={cumpleanos}
        vencimientosLicencia={vencimientosLicencia}
      />

      <div className="flex min-w-0 items-center gap-2.5 rounded-full bg-slate-50 py-1.5 pr-4 pl-1.5">
        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-indigo-600 text-xs font-bold text-white">
          {initials || "?"}
        </span>
        <div className="min-w-0">
          <p className="truncate text-sm font-semibold text-slate-800">{fullName}</p>
          <p className="truncate text-xs text-slate-400">{email ?? ROLE_LABEL[role]}</p>
        </div>
      </div>
    </div>
  );
}
