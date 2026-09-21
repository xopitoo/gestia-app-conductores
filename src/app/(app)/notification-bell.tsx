"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { Bell, Cake, IdCard, Mail, MessageCircle } from "lucide-react";
import { formatDate } from "@/lib/format";
import { emailCumpleanosUrl, whatsappCumpleanosUrl, type ClienteCumpleanos } from "@/lib/cumpleanos";
import { emailLicenciaUrl, whatsappLicenciaUrl, type ClienteLicencia } from "@/lib/licencias";
import { linkClass } from "@/lib/ui";

/**
 * Campana de notificaciones — hoy junta dos cosas reales (nunca un
 * contador inventado): ventas con saldo pendiente, y cumpleaños de
 * clientes (hoy o en la próxima semana). Los botones de WhatsApp/correo
 * por cumpleaños son un saludo manual, uno por uno — quedan como base
 * para cuando exista un módulo de marketing que lo automatice/masifique.
 */
export function NotificationBell({
  pendientesCount,
  cumpleanos,
  vencimientosLicencia,
}: {
  pendientesCount: number;
  cumpleanos: ClienteCumpleanos[];
  vencimientosLicencia: ClienteLicencia[];
}) {
  const [abierto, setAbierto] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!abierto) return;
    function onClickOutside(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setAbierto(false);
    }
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") setAbierto(false);
    }
    document.addEventListener("mousedown", onClickOutside);
    window.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("mousedown", onClickOutside);
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [abierto]);

  const cumpleHoy = cumpleanos.filter((c) => c.diasParaCumplir === 0);
  const cumpleProximos = cumpleanos.filter((c) => c.diasParaCumplir > 0);
  const licenciasVencidas = vencimientosLicencia.filter((l) => l.diasParaVencer < 0);
  const licenciasPorVencer = vencimientosLicencia.filter((l) => l.diasParaVencer >= 0);
  const totalCount = pendientesCount + cumpleHoy.length + licenciasVencidas.length;

  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        onClick={() => setAbierto((v) => !v)}
        title="Notificaciones"
        className="relative flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-slate-100 text-slate-500 transition hover:bg-slate-200 hover:text-slate-700"
      >
        <Bell className="h-4.5 w-4.5" aria-hidden="true" />
        {totalCount > 0 ? (
          <span className="absolute -top-1 -right-1 flex h-5 min-w-5 items-center justify-center rounded-full bg-red-500 px-1 text-[10px] font-bold text-white">
            {totalCount > 99 ? "99+" : totalCount}
          </span>
        ) : null}
      </button>

      {abierto ? (
        <div className="absolute top-12 right-0 z-50 flex max-h-[28rem] w-80 flex-col overflow-y-auto rounded-2xl border border-slate-200 bg-white shadow-xl shadow-slate-900/10">
          <div className="border-b border-slate-100 px-4 py-3">
            <h2 className="text-sm font-semibold text-slate-800">Notificaciones</h2>
          </div>

          {cumpleHoy.length > 0 ? (
            <div className="flex flex-col gap-2 border-b border-slate-100 px-4 py-3">
              <p className="flex items-center gap-1.5 text-xs font-semibold tracking-wide text-pink-600 uppercase">
                <Cake className="h-3.5 w-3.5" aria-hidden="true" />
                Cumpleaños de hoy
              </p>
              {cumpleHoy.map((c) => (
                <CumpleanosRow key={c.id} cliente={c} />
              ))}
            </div>
          ) : null}

          {cumpleProximos.length > 0 ? (
            <div className="flex flex-col gap-2 border-b border-slate-100 px-4 py-3">
              <p className="text-xs font-semibold tracking-wide text-slate-400 uppercase">Próximos cumpleaños</p>
              {cumpleProximos.map((c) => (
                <CumpleanosRow key={c.id} cliente={c} />
              ))}
            </div>
          ) : null}

          {licenciasVencidas.length > 0 ? (
            <div className="flex flex-col gap-2 border-b border-slate-100 px-4 py-3">
              <p className="flex items-center gap-1.5 text-xs font-semibold tracking-wide text-red-600 uppercase">
                <IdCard className="h-3.5 w-3.5" aria-hidden="true" />
                Licencias vencidas
              </p>
              {licenciasVencidas.map((l) => (
                <LicenciaRow key={`${l.id}-${l.categoria}`} cliente={l} />
              ))}
            </div>
          ) : null}

          {licenciasPorVencer.length > 0 ? (
            <div className="flex flex-col gap-2 border-b border-slate-100 px-4 py-3">
              <p className="flex items-center gap-1.5 text-xs font-semibold tracking-wide text-cyan-700 uppercase">
                <IdCard className="h-3.5 w-3.5" aria-hidden="true" />
                Licencias por vencer
              </p>
              {licenciasPorVencer.map((l) => (
                <LicenciaRow key={`${l.id}-${l.categoria}`} cliente={l} />
              ))}
            </div>
          ) : null}

          <div className="px-4 py-3">
            <p className="mb-1.5 text-xs font-semibold tracking-wide text-slate-400 uppercase">Ventas pendientes</p>
            {pendientesCount > 0 ? (
              <Link
                href="/ventas?estado=abonada"
                onClick={() => setAbierto(false)}
                className={linkClass("primary")}
              >
                {pendientesCount} {pendientesCount === 1 ? "venta" : "ventas"} con saldo pendiente
              </Link>
            ) : (
              <p className="text-sm text-slate-400">Sin ventas pendientes.</p>
            )}
          </div>

          {cumpleanos.length === 0 && vencimientosLicencia.length === 0 && pendientesCount === 0 ? (
            <p className="px-4 py-6 text-center text-sm text-slate-400">Sin novedades por ahora.</p>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}

const CATEGORIA_LICENCIA_LABEL: Record<ClienteLicencia["categoria"], string> = {
  particular: "Particular",
  publico: "Público",
};

function LicenciaRow({ cliente }: { cliente: ClienteLicencia }) {
  const whatsappUrl = whatsappLicenciaUrl(
    cliente.nombreCompleto,
    cliente.telefonoPais,
    cliente.telefono,
    cliente.esValorar,
  );
  const emailUrl = emailLicenciaUrl(cliente.nombreCompleto, cliente.correoElectronico, cliente.esValorar);

  return (
    <div className="flex items-center justify-between gap-2">
      <div className="min-w-0">
        <p className="truncate text-sm font-medium text-slate-800">{cliente.nombreCompleto}</p>
        <p className="text-xs text-slate-400">
          {CATEGORIA_LICENCIA_LABEL[cliente.categoria]} · {formatDate(cliente.fechaVencimiento)}
          {cliente.diasParaVencer < 0
            ? ` · venció hace ${Math.abs(cliente.diasParaVencer)} ${Math.abs(cliente.diasParaVencer) === 1 ? "día" : "días"}`
            : cliente.diasParaVencer === 0
              ? " · vence hoy"
              : ` · vence en ${cliente.diasParaVencer} ${cliente.diasParaVencer === 1 ? "día" : "días"}`}
        </p>
      </div>
      <div className="flex shrink-0 items-center gap-1">
        {whatsappUrl ? (
          <a
            href={whatsappUrl}
            target="_blank"
            rel="noopener noreferrer"
            title="Recordar por WhatsApp"
            className="flex h-7 w-7 items-center justify-center rounded-full text-emerald-600 hover:bg-emerald-50"
          >
            <MessageCircle className="h-4 w-4" aria-hidden="true" />
          </a>
        ) : null}
        {emailUrl ? (
          <a
            href={emailUrl}
            title="Recordar por correo"
            className="flex h-7 w-7 items-center justify-center rounded-full text-indigo-600 hover:bg-indigo-50"
          >
            <Mail className="h-4 w-4" aria-hidden="true" />
          </a>
        ) : null}
      </div>
    </div>
  );
}

function CumpleanosRow({ cliente }: { cliente: ClienteCumpleanos }) {
  const whatsappUrl = whatsappCumpleanosUrl(cliente.nombreCompleto, cliente.telefonoPais, cliente.telefono);
  const emailUrl = emailCumpleanosUrl(cliente.nombreCompleto, cliente.correoElectronico);

  return (
    <div className="flex items-center justify-between gap-2">
      <div className="min-w-0">
        <p className="truncate text-sm font-medium text-slate-800">{cliente.nombreCompleto}</p>
        <p className="text-xs text-slate-400">
          {cliente.diasParaCumplir === 0
            ? `Cumple ${cliente.edadQueCumple} hoy`
            : `${formatDate(cliente.fechaNacimiento)} · cumple ${cliente.edadQueCumple}`}
        </p>
      </div>
      <div className="flex shrink-0 items-center gap-1">
        {whatsappUrl ? (
          <a
            href={whatsappUrl}
            target="_blank"
            rel="noopener noreferrer"
            title="Saludar por WhatsApp"
            className="flex h-7 w-7 items-center justify-center rounded-full text-emerald-600 hover:bg-emerald-50"
          >
            <MessageCircle className="h-4 w-4" aria-hidden="true" />
          </a>
        ) : null}
        {emailUrl ? (
          <a
            href={emailUrl}
            title="Saludar por correo"
            className="flex h-7 w-7 items-center justify-center rounded-full text-indigo-600 hover:bg-indigo-50"
          >
            <Mail className="h-4 w-4" aria-hidden="true" />
          </a>
        ) : null}
      </div>
    </div>
  );
}
