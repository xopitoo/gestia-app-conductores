"use client";

import { useEffect, useRef, useState } from "react";

/**
 * Envoltorio que desplaza a sus hijos verticalmente según la posición de
 * scroll — varias capas con `speed` distinto dentro de un mismo contenedor
 * dan la sensación de profundidad (parallax). Throttled con
 * requestAnimationFrame, y respeta prefers-reduced-motion (queda estático).
 */
export function ParallaxLayer({
  speed,
  className,
  children,
}: {
  /** Positivo = se mueve en el mismo sentido del scroll; negativo = al revés. */
  speed: number;
  className?: string;
  children: React.ReactNode;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [offset, setOffset] = useState(0);

  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

    let raf = 0;
    function update() {
      raf = 0;
      const el = ref.current;
      if (!el) return;
      const rect = el.getBoundingClientRect();
      const viewportCenter = window.innerHeight / 2;
      const elCenter = rect.top + rect.height / 2;
      setOffset((viewportCenter - elCenter) * speed);
    }
    function onScroll() {
      if (!raf) raf = requestAnimationFrame(update);
    }

    update();
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onScroll);
    return () => {
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", onScroll);
      if (raf) cancelAnimationFrame(raf);
    };
  }, [speed]);

  return (
    <div ref={ref} className={className} style={{ transform: `translateY(${offset}px)`, willChange: "transform" }}>
      {children}
    </div>
  );
}
