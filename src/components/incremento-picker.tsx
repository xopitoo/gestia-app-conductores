"use client";

import { formatCOP } from "@/lib/format";
import type { DescuentoTipo } from "@/lib/supabase/types";

const PORCENTAJES = [5, 8, 12];
const FIJOS = [10000, 20000, 50000];

/**
 * Selector de incremento (porcentaje o monto fijo) — lo opuesto al
 * DescuentoPicker: en vez de restar, suma sobre el total. Pensado para
 * financiadoras que cobran de más (Brilla, Addi, Sistecrédito). Mismo
 * patrón de presets + valor libre, controlado igual que DescuentoPicker.
 */
export function IncrementoPicker({
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
          Sin incremento
        </TipoButton>
        <TipoButton active={tipo === "porcentaje"} onClick={() => onTipoChange("porcentaje")}>
          Incremento %
        </TipoButton>
        <TipoButton active={tipo === "fijo"} onClick={() => onTipoChange("fijo")}>
          Incremento fijo
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
            className="w-24 rounded-lg border border-slate-300 px-2.5 py-1.5 text-sm text-slate-900 outline-none focus:border-amber-600 focus:ring-1 focus:ring-amber-600"
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
            className="w-32 rounded-lg border border-slate-300 px-2.5 py-1.5 text-sm text-slate-900 outline-none focus:border-amber-600 focus:ring-1 focus:ring-amber-600"
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
          ? "border-amber-600 bg-amber-50 text-amber-700"
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
          ? "border-amber-600 bg-amber-600 text-white"
          : "border-slate-300 text-slate-600 hover:bg-slate-100"
      }`}
    >
      {children}
    </button>
  );
}
