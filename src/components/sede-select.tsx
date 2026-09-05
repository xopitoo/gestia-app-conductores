"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import type { SedeRow } from "@/lib/supabase/types";

export function SedeSelect({
  sedes,
  currentSedeId,
  allowAll,
}: {
  sedes: SedeRow[];
  currentSedeId: string | null;
  /** Agrega la opción "Todas las sedes" (value="all", currentSedeId=null). */
  allowAll?: boolean;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  if (sedes.length <= 1 && !allowAll) return null;

  return (
    <select
      value={currentSedeId ?? "all"}
      onChange={(e) => {
        const params = new URLSearchParams(searchParams.toString());
        params.set("sede", e.target.value);
        router.push(`${pathname}?${params.toString()}`);
      }}
      className="rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-sm font-medium text-slate-700 outline-none focus:border-indigo-600"
    >
      {allowAll ? <option value="all">Todas las sedes</option> : null}
      {sedes.map((s) => (
        <option key={s.id} value={s.id}>
          {s.name}
        </option>
      ))}
    </select>
  );
}
