"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  AlertTriangle,
  Banknote,
  Building2,
  ChevronsLeft,
  ChevronsRight,
  GraduationCap,
  Handshake,
  LayoutDashboard,
  Megaphone,
  Menu,
  Package,
  ShieldCheck,
  ShoppingBag,
  UserCog,
  Users,
  X,
} from "lucide-react";
import { LogoutButton } from "./logout-button";

export const ROLE_LABEL = {
  admin: "Administrador",
  recepcionista: "Recepcionista",
} as const;

const STORAGE_KEY = "conductores-pos:sidebar-collapsed";

export function Sidebar({
  role,
  orgName,
}: {
  role: "admin" | "recepcionista";
  orgName: string;
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
  // En celular el sidebar no se "contrae" (eso es un ajuste de escritorio):
  // vive fuera de pantalla y este botón lo trae como un panel encima del
  // contenido — se cierra al elegir cualquier link de <nav> (delegado por
  // el onClick ahí abajo, no hace falta tocarlo en cada NavLink) o al
  // tocar el fondo oscuro.
  const [mobileOpen, setMobileOpen] = useState(false);

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
    <>
      <button
        type="button"
        onClick={() => setMobileOpen(true)}
        title="Abrir menú"
        className="fixed top-4 left-4 z-30 flex h-10 w-10 items-center justify-center rounded-full bg-white text-slate-600 shadow-md shadow-slate-900/10 sm:hidden print:hidden"
      >
        <Menu className="h-5 w-5" />
      </button>

      {mobileOpen ? (
        <div
          onClick={() => setMobileOpen(false)}
          className="fixed inset-0 z-40 bg-slate-900/40 sm:hidden print:hidden"
          aria-hidden="true"
        />
      ) : null}

      <aside
        className={`fixed inset-y-0 left-0 z-50 flex w-64 shrink-0 flex-col bg-white shadow-sm shadow-slate-200/70 transition-transform duration-200 print:hidden sm:static sm:z-auto sm:translate-x-0 sm:rounded-2xl sm:bg-white/70 sm:transition-[width] ${
          mobileOpen ? "translate-x-0" : "-translate-x-full"
        } ${collapsed ? "sm:w-16" : "sm:w-60"}`}
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
          <button
            type="button"
            onClick={() => setMobileOpen(false)}
            title="Cerrar menú"
            className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-slate-400 hover:bg-slate-100 hover:text-slate-700 sm:hidden"
          >
            <X className="h-4.5 w-4.5" />
          </button>
        </div>

        <nav className="flex flex-1 flex-col gap-1 p-3" onClick={() => setMobileOpen(false)}>
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
          <NavLink href="/tramitadores" icon={<Handshake className="h-4.5 w-4.5" />} collapsed={collapsed}>
            Tramitadores
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
              <NavLink href="/admin/marketing" icon={<Megaphone className="h-4.5 w-4.5" />} collapsed={collapsed}>
                Marketing
              </NavLink>
              <NavLink
                href="/admin/certificados"
                icon={<GraduationCap className="h-4.5 w-4.5" />}
                collapsed={collapsed}
              >
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
            className="mb-2 hidden h-8 w-full items-center justify-center rounded-lg text-slate-400 transition hover:bg-slate-100 hover:text-slate-700 sm:flex"
          >
            {collapsed ? <ChevronsRight className="h-4 w-4" /> : <ChevronsLeft className="h-4 w-4" />}
          </button>

          {!collapsed ? (
            <p className="truncate px-1 pb-2 text-xs text-slate-400">{orgName}</p>
          ) : null}
          <div className={`flex items-center gap-2 px-1 ${collapsed ? "justify-center" : "justify-between"}`}>
            {!collapsed ? (
              <p className="truncate text-xs text-slate-400">{ROLE_LABEL[role]}</p>
            ) : null}
            <LogoutButton />
          </div>

          {!collapsed ? (
            <p className="mt-3 truncate px-1 text-[10px] text-slate-300">
              © {new Date().getFullYear()} Conductores App Group
            </p>
          ) : null}
        </div>
      </aside>
    </>
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
  const pathname = usePathname();
  const active = pathname === href || pathname?.startsWith(`${href}/`);

  return (
    <Link
      href={href}
      title={collapsed ? String(children) : undefined}
      className={`flex items-center gap-2.5 rounded-xl px-3 py-2 text-sm font-medium transition ${
        active
          ? "bg-indigo-600 text-white shadow-sm shadow-indigo-600/30"
          : "text-slate-600 hover:bg-slate-100 hover:text-slate-900"
      } ${collapsed ? "justify-center" : ""}`}
    >
      {icon}
      {!collapsed ? children : null}
    </Link>
  );
}
