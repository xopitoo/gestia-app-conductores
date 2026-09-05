"use client";

import { ExternalLink } from "lucide-react";

const RUNT_URL =
  "https://portalpublico.runt.gov.co/#/consulta-ciudadano-documento/consulta/consulta-ciudadano-documento";

/**
 * Link al portal público del RUNT. Fuerza window.open() en el click además
 * de target="_blank" — en algunos entornos (webviews, ciertos navegadores)
 * el atributo solo no alcanza y el link termina navegando en la misma
 * pestaña, perdiendo lo que se estaba completando en el formulario.
 */
export function RuntConsultaLink({
  documento,
  compact = false,
}: {
  documento?: string;
  compact?: boolean;
}) {
  function abrir(e: React.MouseEvent<HTMLAnchorElement>) {
    e.preventDefault();
    window.open(RUNT_URL, "_blank", "noopener,noreferrer");
  }

  return (
    <a
      href={RUNT_URL}
      target="_blank"
      rel="noopener noreferrer"
      onClick={abrir}
      title={
        documento
          ? `Abre el portal público del RUNT en una pestaña nueva — buscá con ${documento}`
          : "Abre el portal público del RUNT en una pestaña nueva"
      }
      className={
        compact
          ? "flex items-center gap-1.5 text-xs font-medium text-indigo-700 hover:underline"
          : "flex items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-3.5 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-50"
      }
    >
      <ExternalLink className={compact ? "h-3.5 w-3.5" : "h-4 w-4"} aria-hidden="true" />
      Consultar en RUNT
    </a>
  );
}
