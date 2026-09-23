import Link from "next/link";

/**
 * Paginación por número de página — genérica, pensada para listas largas
 * tipo /clientes. Muestra siempre la primera, la última, y una ventana
 * alrededor de la página actual (con "…" en los saltos) para no listar
 * cientos de números cuando hay muchas páginas. Server component puro
 * (son todos <Link>): no necesita JS en el cliente.
 */
export function Pagination({
  page,
  totalPages,
  basePath,
  searchParams,
}: {
  page: number;
  totalPages: number;
  basePath: string;
  /** Otros parámetros a conservar en cada link (ej. la búsqueda "q"). */
  searchParams?: Record<string, string | undefined>;
}) {
  if (totalPages <= 1) return null;

  function hrefFor(p: number) {
    const params = new URLSearchParams();
    for (const [k, v] of Object.entries(searchParams ?? {})) {
      if (v) params.set(k, v);
    }
    params.set("page", String(p));
    return `${basePath}?${params.toString()}`;
  }

  const paginas = new Set<number>([1, totalPages]);
  for (let p = page - 1; p <= page + 1; p++) {
    if (p >= 1 && p <= totalPages) paginas.add(p);
  }
  const ordenadas = [...paginas].sort((a, b) => a - b);

  return (
    <nav className="flex items-center justify-center gap-1 py-2" aria-label="Paginación">
      <Link
        href={hrefFor(Math.max(1, page - 1))}
        aria-disabled={page === 1}
        tabIndex={page === 1 ? -1 : undefined}
        className={`rounded-lg px-3 py-1.5 text-sm font-medium transition ${
          page === 1 ? "pointer-events-none text-slate-300" : "text-slate-600 hover:bg-slate-100"
        }`}
      >
        Anterior
      </Link>
      {ordenadas.map((p, i) => (
        <span key={p} className="flex items-center gap-1">
          {i > 0 && p - ordenadas[i - 1] > 1 ? <span className="px-1 text-slate-300">…</span> : null}
          <Link
            href={hrefFor(p)}
            aria-current={p === page ? "page" : undefined}
            className={`flex h-8 w-8 items-center justify-center rounded-lg text-sm font-medium transition ${
              p === page ? "bg-indigo-600 text-white" : "text-slate-600 hover:bg-slate-100"
            }`}
          >
            {p}
          </Link>
        </span>
      ))}
      <Link
        href={hrefFor(Math.min(totalPages, page + 1))}
        aria-disabled={page === totalPages}
        tabIndex={page === totalPages ? -1 : undefined}
        className={`rounded-lg px-3 py-1.5 text-sm font-medium transition ${
          page === totalPages ? "pointer-events-none text-slate-300" : "text-slate-600 hover:bg-slate-100"
        }`}
      >
        Siguiente
      </Link>
    </nav>
  );
}
