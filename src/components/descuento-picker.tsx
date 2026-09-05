"use client";

import { formatCOP } from "@/lib/format";
import type { DescuentoTipo } from "@/lib/supabase/types";

const PORCENTAJES = [10, 15, 20];
const FIJOS = [50000, 100000, 150000];

/**
 * Selector de descuento (porcentaje o monto fijo) con presets rápidos +
 * valor libre. Puramente controlado — quien lo usa decide qué hacer con
 * tipo/valor (hidden inputs de un form, o pasarlo a otro componente).
 */
export function DescuentoPicker({
  tipo,
  valor,
  onTipoChange,
  onValorChange,
}: {
  tipo: DescuentoTipo | "";
  valor: number;
  onTipoChange: (tipo: DescuentoTipo | "") => void;
  onValorChange: (valor: number) => void;
}) {
  return (
    <div className="flex flex-col gap-2">
      <div className="flex flex-wrap gap-1.5">
        <TipoButton
          active={tipo === ""}
          onClick={() => {
            onTipoChange("");
            onValorChange(0);
          }}
        >
          Sin descuento
        </TipoButton>
        <TipoButton active={tipo === "porcentaje"} onClick={() => onTipoChange("porcentaje")}>
          Descuento %
        </TipoButton>
        <TipoButton active={tipo === "fijo"} onClick={() => onTipoChange("fijo")}>
          Descuento fijo
        </TipoButton>
      </div>

      {tipo === "porcentaje" ? (
        <div className="flex flex-wrap items-center gap-1.5">
          {PORCENTAJES.map((p) => (
            <PresetButton key={p} active={valor === p} onClick={() => onValorChange(p)}>
              {p}%
            </PresetButton>
          ))}
          <input
            type="number"
            min={0}
            max={100}
            step="1"
            value={valor || ""}
            onChange={(e) => onValorChange(Math.min(100, Math.max(0, Number(e.target.value) || 0)))}
            placeholder="Otro %"
            className="w-24 rounded-lg border border-slate-300 px-2.5 py-1.5 text-sm text-slate-900 outline-none focus:border-indigo-600 focus:ring-1 focus:ring-indigo-600"
          />
        </div>
      ) : null}

      {tipo === "fijo" ? (
        <div className="flex flex-wrap items-center gap-1.5">
          {FIJOS.map((f) => (
            <PresetButton key={f} active={valor === f} onClick={() => onValorChange(f)}>
              {formatCOP(f)}
            </PresetButton>
          ))}
          <input
            type="number"
            min={0}
            step="1000"
            value={valor || ""}
            onChange={(e) => onValorChange(Math.max(0, Number(e.target.value) || 0))}
            placeholder="Otro monto"
            className="w-32 rounded-lg border border-slate-300 px-2.5 py-1.5 text-sm text-slate-900 outline-none focus:border-indigo-600 focus:ring-1 focus:ring-indigo-600"
          />
        </div>
      ) : null}
    </div>
  );
}

function TipoButton({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`rounded-lg border px-3 py-1.5 text-xs font-medium transition ${
        active
          ? "border-indigo-600 bg-indigo-50 text-indigo-700"
          : "border-slate-300 text-slate-600 hover:bg-slate-100"
      }`}
    >
      {children}
    </button>
  );
}

function PresetButton({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`rounded-full border px-3 py-1 text-xs font-medium transition ${
        active
          ? "border-indigo-600 bg-indigo-600 text-white"
          : "border-slate-300 text-slate-600 hover:bg-slate-100"
      }`}
    >
      {children}
    </button>
  );
}
