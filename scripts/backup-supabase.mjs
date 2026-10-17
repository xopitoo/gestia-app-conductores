// Copia de seguridad de las tablas de Gestia: baja cada tabla por la API de
// Supabase a JSON, la comprime en un .tar.gz con fecha y borra las copias
// más viejas. No depende de Claude ni de Vercel — solo necesita Node y las
// variables de .env.local. Uso: node scripts/backup-supabase.mjs [carpeta]
import { readFileSync, mkdirSync, writeFileSync, readdirSync, rmSync, statSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { homedir } from "node:os";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const raiz = join(dirname(fileURLToPath(import.meta.url)), "..");
const env = Object.fromEntries(
  readFileSync(join(raiz, ".env.local"), "utf8")
    .split("\n")
    .filter((l) => l.includes("=") && !l.startsWith("#"))
    .map((l) => [l.slice(0, l.indexOf("=")), l.slice(l.indexOf("=") + 1).replace(/^["']|["']$/g, "")]),
);
const URL = env.NEXT_PUBLIC_SUPABASE_URL;
const KEY = env.SUPABASE_SERVICE_ROLE_KEY;
const DESTINO = process.argv[2] ?? join(homedir(), "Backups", "gestia");
const CONSERVAR = 30;

const TABLAS = {
  organizations: "id", sedes: "id", profiles: "id", clientes: "id", productos: "id",
  tramitadores: "id", tramitador_precios: "id", tramitador_pagos: "id",
  ventas: "id", venta_items: "id", venta_pagos: "id",
  caja_sesiones: "id", caja_movimientos: "id",
  cotizaciones: "id", cotizacion_items: "id",
  financiadoras: "id", soat_tarifas: "id", curso_infractores_config: "organization_id",
};

async function bajar(tabla, orden) {
  const filas = [];
  for (let desde = 0; ; desde += 1000) {
    const r = await fetch(`${URL}/rest/v1/${tabla}?select=*&order=${orden}`, {
      headers: { apikey: KEY, Authorization: `Bearer ${KEY}`, Range: `${desde}-${desde + 999}` },
    });
    if (!r.ok) throw new Error(`${tabla}: ${r.status} ${await r.text()}`);
    const lote = await r.json();
    filas.push(...lote);
    if (lote.length < 1000) return filas;
  }
}

const fecha = new Date().toISOString().slice(0, 10);
const carpeta = join(DESTINO, `gestia-${fecha}`);
mkdirSync(carpeta, { recursive: true });
const resumen = {};
for (const [tabla, orden] of Object.entries(TABLAS)) {
  const filas = await bajar(tabla, orden);
  writeFileSync(join(carpeta, `${tabla}.json`), JSON.stringify(filas));
  resumen[tabla] = filas.length;
}
writeFileSync(join(carpeta, "_resumen.json"), JSON.stringify({ fecha, filas: resumen }, null, 2));
execFileSync("tar", ["-czf", `${carpeta}.tar.gz`, "-C", DESTINO, `gestia-${fecha}`]);
rmSync(carpeta, { recursive: true });

const viejas = readdirSync(DESTINO).filter((f) => f.endsWith(".tar.gz")).sort();
for (const f of viejas.slice(0, Math.max(0, viejas.length - CONSERVAR))) rmSync(join(DESTINO, f));

const mb = (statSync(`${carpeta}.tar.gz`).size / 1024 / 1024).toFixed(1);
console.log(`Backup listo: ${carpeta}.tar.gz (${mb} MB) — ${Object.values(resumen).reduce((a, b) => a + b, 0)} filas`);
