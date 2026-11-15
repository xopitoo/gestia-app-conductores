/** Decoración de diciembre: guirnalda de luces arriba y nieve suave. Solo
 * visual (no recibe clics), no se imprime y se apaga con "reducir movimiento". */
const COPOS = Array.from({ length: 34 }, (_, i) => ({
  left: (i * 29 + 7) % 100,
  size: 4 + ((i * 7) % 6),
  dur: 11 + ((i * 5) % 12),
  delay: -((i * 3) % 17),
  sway: 12 + ((i * 11) % 30),
}));

export function NavidadDecor() {
  return (
    <div aria-hidden className="xmas-decor print:hidden">
      <ul className="xmas-lights">
        {Array.from({ length: 48 }, (_, i) => (
          <li key={i} style={{ animationDelay: `${(i % 6) * 0.35}s` }} />
        ))}
      </ul>
      <div className="xmas-snow">
        {COPOS.map((c, i) => (
          <span
            key={i}
            style={{
              left: `${c.left}%`,
              width: c.size,
              height: c.size,
              animationDuration: `${c.dur}s`,
              animationDelay: `${c.delay}s`,
              ["--sway" as string]: `${c.sway}px`,
            }}
          />
        ))}
      </div>
    </div>
  );
}

/** Gorro de Papá Noel para el logo del menú. */
export function GorroNavidad() {
  return (
    <svg aria-hidden viewBox="0 0 40 32" className="pointer-events-none absolute -top-3.5 -right-2 h-6 w-7 rotate-[14deg] drop-shadow-sm">
      <path d="M4 26 C6 10 16 2 30 6 C26 10 28 18 34 26 Z" fill="#dc2626" />
      <path d="M2 24 h34 a3 3 0 0 1 0 6 h-34 a3 3 0 0 1 0 -6 z" fill="#fff" />
      <circle cx="31" cy="6" r="4" fill="#fff" />
    </svg>
  );
}
