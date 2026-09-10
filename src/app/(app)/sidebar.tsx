"use client";

import { useState } from "react";
import Link from "next/link";
import {
  AlertTriangle,
  Banknote,
  Building2,
  ChevronsLeft,
  ChevronsRight,
  GraduationCap,
  Handshake,
  LayoutDashboard,
  LogOut,
  Package,
  ShieldCheck,
  ShoppingBag,
  UserCog,
  Users,
} from "lucide-react";

const ROLE_LABEL = {
  admin: "Administrador",
  recepcionista: "Recepcionista",
} as const;

const STORAGE_KEY = "conductores-pos:sidebar-collapsed";

export function Sidebar({
  role,
  fullName,
  initials,
  orgName,
  sedeLabel,
  onLogout,
}: {
  role: "admin" | "recepcionista";
  fullName: string;
  initials: string;
  orgName: string;
  sedeLabel: string;
  onLogout: () => Promise<void>;
}) {
  // Lazy initializer (no useEffect): evita el "flash" de expandido→contraído
  // que se vería si se leyera localStorage recién después del primer paint.
  // En el server `window` no existe, así que ahí siempre arranca expandido.
  const [collapsed, setCollapsed] = useState(() => {
    if (typeof window === "undefined") return false;
    try {
      return window.localStorage.getItem(STORAGE_KEY) === "1";
    } catch {
      return false;
    }
  });

  function toggle() {
    setCollapsed((prev) => {
      const next = !prev;
      try {
        window.localStorage.setItem(STORAGE_KEY, next ? "1" : "0");
      } catch {
        // ignorar si no hay localStorage
      }
      return next;
    });
  }

  return (
    <aside
      className={`flex shrink-0 flex-col border-r border-slate-200 bg-white transition-[width] duration-200 print:hidden ${
        collapsed ? "w-16" : "w-60"
      }`}
    >
      <div className="flex h-16 items-center justify-between gap-2 border-b border-slate-200 px-3">
        <div className="flex min-w-0 items-center gap-2">
          <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-indigo-600 text-sm font-bold text-white">
            GA
          </span>
          {!collapsed ? (
            <span className="truncate text-sm font-semibold text-slate-900">
              Gestia App Conductores
            </span>
          ) : null}
        </div>
      </div>

      <nav className="flex flex-1 flex-col gap-1 p-3">
        <NavLink href="/dashboard" icon={<LayoutDashboard className="h-4.5 w-4.5" />} collapsed={collapsed}>
          Dashboard
        </NavLink>
        <NavLink href="/ventas" icon={<ShoppingBag className="h-4.5 w-4.5" />} collapsed={collapsed}>
          Ventas
        </NavLink>
        <NavLink href="/caja" icon={<Banknote className="h-4.5 w-4.5" />} collapsed={collapsed}>
          Caja
        </NavLink>
        <NavLink href="/clientes" icon={<Users className="h-4.5 w-4.5" />} collapsed={collapsed}>
          Clientes
        </NavLink>

        {role === "admin" ? (
          <>
            {!collapsed ? (
              <p className="mt-4 px-3 text-[11px] font-semibold tracking-wide text-slate-400 uppercase">
                Administración
              </p>
            ) : (
              <div className="mt-4 border-t border-slate-100" />
            )}
            <NavLink href="/admin/sedes" icon={<Building2 className="h-4.5 w-4.5" />} collapsed={collapsed}>
              Sedes
            </NavLink>
            <NavLink href="/admin/productos" icon={<Package className="h-4.5 w-4.5" />} collapsed={collapsed}>
              Productos
            </NavLink>
            <NavLink href="/admin/usuarios" icon={<UserCog className="h-4.5 w-4.5" />} collapsed={collapsed}>
              Usuarios
            </NavLink>
            <NavLink href="/admin/mora" icon={<AlertTriangle className="h-4.5 w-4.5" />} collapsed={collapsed}>
              Clientes en mora
            </NavLink>
            <NavLink href="/admin/tramitadores" icon={<Handshake className="h-4.5 w-4.5" />} collapsed={collapsed}>
              Tramitadores
            </NavLink>
            <NavLink href="/admin/certificados" icon={<GraduationCap className="h-4.5 w-4.5" />} collapsed={collapsed}>
              Certificados RUNT
            </NavLink>
            <NavLink href="/admin/seguridad" icon={<ShieldCheck className="h-4.5 w-4.5" />} collapsed={collapsed}>
              Seguridad
            </NavLink>
          </>
        ) : null}
      </nav>

      <div className="border-t border-slate-200 p-3">
        <button
          type="button"
          onClick={toggle}
          title={collapsed ? "Expandir menú" : "Contraer menú"}
          className="mb-2 flex h-8 w-full items-center justify-center rounded-lg text-slate-400 transition hover:bg-slate-100 hover:text-slate-700"
        >
          {collapsed ? <ChevronsRight className="h-4 w-4" /> : <ChevronsLeft className="h-4 w-4" />}
        </button>

        {!collapsed ? (
          <p className="truncate px-1 pb-2 text-xs text-slate-400">{orgName}</p>
        ) : null}
        <div className="flex items-center gap-2 px-1">
          <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-indigo-100 text-xs font-bold text-indigo-700">
            {initials || "?"}
          </span>
          {!collapsed ? (
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-medium text-slate-800">{fullName}</p>
              <p className="truncate text-xs text-slate-400">
                {ROLE_LABEL[role]} · {sedeLabel}
              </p>
            </div>
          ) : null}
          <form action={onLogout}>
            <button
              type="submit"
              title="Salir"
              className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-slate-400 transition hover:bg-slate-100 hover:text-slate-700"
            >
              <LogOut className="h-4 w-4" />
            </button>
          </form>
        </div>

        {!collapsed ? (
          <p className="mt-3 truncate px-1 text-[10px] text-slate-300">
            © {new Date().getFullYear()} Conductores App Group
          </p>
        ) : null}
      </div>
    </aside>
  );
}

function NavLink({
  href,
  icon,
  collapsed,
  children,
}: {
  href: string;
  icon: React.ReactNode;
  collapsed: boolean;
  children: React.ReactNode;
}) {
  return (
    <Link
      href={href}
      title={collapsed ? String(children) : undefined}
      className={`flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm font-medium text-slate-600 transition hover:bg-slate-100 hover:text-slate-900 ${
        collapsed ? "justify-center" : ""
      }`}
    >
      {icon}
      {!collapsed ? children : null}
    </Link>
  );
}
