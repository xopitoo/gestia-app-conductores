-- Tabla SOAT_TARIFAS para la página /soat (consulta de precios del SOAT).
-- Semilla con el tarifario oficial 2026 de Seguros Mundial (PDF compartido
-- por el admin el 2026-10-13). Prima, contribución y tasa RUNT se guardan
-- tal cual las publica la aseguradora (no se recalculan con fórmula) porque
-- el redondeo oficial no sigue un porcentaje limpio — se editan a mano cada
-- vez que cambie el tarifario.

create table if not exists public.soat_tarifas (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  -- Código oficial de tarifa (ej. "100", "211") — no es único entre sí mismo
  -- a propósito: sirve solo de referencia visual, el orden real es `orden`.
  codigo text not null,
  categoria text not null,
  descripcion text not null,
  prima numeric(12, 0) not null default 0 check (prima >= 0),
  contribucion numeric(12, 0) not null default 0 check (contribucion >= 0),
  tasa_runt numeric(12, 0) not null default 0 check (tasa_runt >= 0),
  total numeric(12, 0) not null default 0 check (total >= 0),
  anio integer not null default 2026,
  orden integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create unique index if not exists soat_tarifas_org_codigo_idx on public.soat_tarifas (organization_id, codigo);
create index if not exists soat_tarifas_organization_id_idx on public.soat_tarifas (organization_id);

drop trigger if exists soat_tarifas_set_updated_at on public.soat_tarifas;
create trigger soat_tarifas_set_updated_at
  before update on public.soat_tarifas
  for each row execute function public.set_updated_at();

alter table public.soat_tarifas enable row level security;

drop policy if exists "soat_tarifas_select_org" on public.soat_tarifas;
create policy "soat_tarifas_select_org" on public.soat_tarifas
  for select using (organization_id = public.current_org_id());

drop policy if exists "soat_tarifas_insert_admin" on public.soat_tarifas;
create policy "soat_tarifas_insert_admin" on public.soat_tarifas
  for insert with check (public.current_role() = 'admin' and organization_id = public.current_org_id());

drop policy if exists "soat_tarifas_update_admin" on public.soat_tarifas;
create policy "soat_tarifas_update_admin" on public.soat_tarifas
  for update
  using (public.current_role() = 'admin' and organization_id = public.current_org_id())
  with check (public.current_role() = 'admin' and organization_id = public.current_org_id());

-- Semilla: una fila por organización existente, sin duplicar si se corre de
-- nuevo (gracias al índice único org+codigo).
insert into public.soat_tarifas
  (organization_id, codigo, categoria, descripcion, prima, contribucion, tasa_runt, total, anio, orden)
select o.id, v.codigo, v.categoria, v.descripcion, v.prima, v.contribucion, v.tasa_runt, v.total, 2026, v.orden
from public.organizations o
cross join (
  values
    ('100', 'Motos', 'Ciclomotor', 80100, 41600, 2400, 124100, 1),
    ('110', 'Motos', 'Menos de 100 c.c.', 167000, 86800, 2400, 256200, 2),
    ('120', 'Motos', 'De 100 a 200 c.c.', 224300, 116600, 2400, 343300, 3),
    ('130', 'Motos', 'Más de 200 c.c.', 499400, 259600, 2400, 761400, 4),
    ('140', 'Motos', 'Motocarros, tricimoto, cuadriciclos', 253000, 131500, 2400, 386900, 5),
    ('150', 'Motos', 'Motocarro 5 pasajeros', 253000, 131500, 2400, 386900, 6),

    ('211', 'Camperos y Camionetas 0 - 9 años', 'Menos de 1.500 c.c.', 520000, 270400, 2400, 792800, 7),
    ('221', 'Camperos y Camionetas 0 - 9 años', 'Entre 1.500 a 2.500 c.c.', 621200, 323000, 2400, 946600, 8),
    ('231', 'Camperos y Camionetas 0 - 9 años', 'Más de 2.500 c.c.', 728900, 379000, 2400, 1110300, 9),

    ('212', 'Camperos y Camionetas 10 años o más', 'Menos de 1.500 c.c.', 625400, 325200, 2400, 953000, 10),
    ('222', 'Camperos y Camionetas 10 años o más', 'Entre 1.500 a 2.500 c.c.', 736200, 382800, 2400, 1121400, 11),
    ('232', 'Camperos y Camionetas 10 años o más', 'Más de 2.500 c.c.', 836600, 435000, 2400, 1274000, 12),

    ('511', 'Autos Familiares 0 - 9 años', 'Menos de 1.500 c.c.', 292700, 152200, 2400, 447300, 13),
    ('521', 'Autos Familiares 0 - 9 años', 'Entre 1.500 a 2.500 c.c.', 356800, 185500, 2400, 544700, 14),
    ('531', 'Autos Familiares 0 - 9 años', 'Más de 2.500 c.c.', 416900, 216700, 2400, 636000, 15),

    ('512', 'Autos Familiares 10 años o más', 'Menos de 1.500 c.c.', 388500, 202000, 2400, 592900, 16),
    ('522', 'Autos Familiares 10 años o más', 'Entre 1.500 a 2.500 c.c.', 444100, 230900, 2400, 677400, 17),
    ('532', 'Autos Familiares 10 años o más', 'Más de 2.500 c.c.', 494700, 257200, 2400, 754300, 18),

    ('711', 'Autos de Negocios y Taxis 0 - 9 años', 'Menos de 1.500 c.c.', 183900, 95600, 2400, 281900, 19),
    ('721', 'Autos de Negocios y Taxis 0 - 9 años', 'Entre 1.500 a 2.500 c.c.', 228700, 118900, 2400, 350000, 20),
    ('731', 'Autos de Negocios y Taxis 0 - 9 años', 'Más de 2.500 c.c.', 295400, 153600, 2400, 451400, 21),

    ('712', 'Autos de Negocios y Taxis 10 años o más', 'Menos de 1.500 c.c.', 230000, 119600, 2400, 352000, 22),
    ('722', 'Autos de Negocios y Taxis 10 años o más', 'Entre 1.500 a 2.500 c.c.', 282900, 147100, 2400, 432400, 23),
    ('732', 'Autos de Negocios y Taxis 10 años o más', 'Más de 2.500 c.c.', 346700, 180200, 2400, 529300, 24),

    ('810', 'Buses y Busetas', 'Servicio Público Urbano', 441400, 229500, 2400, 673300, 25),
    ('910', 'Buses y Busetas', 'Intermunicipal menor a 10 pasajeros', 436300, 226800, 2400, 665500, 26),
    ('920', 'Buses y Busetas', 'Intermunicipal 10 o más pasajeros', 633500, 329400, 2400, 965300, 27),

    ('611', 'Vehículos para 6 o más Pasajeros 0 - 9 años', 'Menos de 2.500 c.c.', 523000, 271900, 2400, 797300, 28),
    ('621', 'Vehículos para 6 o más Pasajeros 0 - 9 años', '2.500 c.c. o más', 700600, 364300, 2400, 1067300, 29),

    ('612', 'Vehículos para 6 o más Pasajeros 10 años o más', 'Menos de 2.500 c.c.', 668000, 347300, 2400, 1017700, 30),
    ('622', 'Vehículos para 6 o más Pasajeros 10 años o más', '2.500 c.c. o más', 841600, 437600, 2400, 1281600, 31),

    ('310', 'Carga o Mixto', 'Menos de 5 toneladas', 582900, 303100, 2400, 888400, 32),
    ('320', 'Carga o Mixto', 'Entre 5 a 15 toneladas', 842400, 438000, 2400, 1282800, 33),
    ('330', 'Carga o Mixto', 'Más de 15 toneladas', 1065500, 554000, 2400, 1621900, 34),

    ('410', 'Oficiales Especiales', 'Menos de 1.500 c.c.', 656000, 341100, 2400, 999500, 35),
    ('420', 'Oficiales Especiales', 'Entre 1.500 a 2.500 c.c.', 827500, 430300, 2400, 1260200, 36),
    ('430', 'Oficiales Especiales', 'Más de 2.500 c.c.', 992300, 515900, 2400, 1510600, 37)
) as v(codigo, categoria, descripcion, prima, contribucion, tasa_runt, total, orden)
on conflict (organization_id, codigo) do nothing;
