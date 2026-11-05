-- Control de PINES de curso (CEAPP Jamundí, Cali y Santander).
-- Un "curso real" es un PIN: así se cuentan cursos vendidos sin mezclarlos
-- con los demás productos de la misma persona (RUNT, médico, licencia...).
--
-- productos.cursos_reales = cuántos PINES/cursos incluye el producto
--   (A2, B1, C1 = 1; un combo = 2; el resto = 0 y no pide PIN).
-- venta_pines = un registro por PIN vendido, ligado a la venta y al cliente.
alter table public.productos add column if not exists cursos_reales int not null default 0
  check (cursos_reales >= 0);

create table if not exists public.venta_pines (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  sede_id uuid not null references public.sedes (id) on delete cascade,
  venta_id uuid not null references public.ventas (id) on delete cascade,
  cliente_id uuid not null references public.clientes (id) on delete restrict,
  pin text not null check (length(btrim(pin)) > 0),
  created_by uuid not null references public.profiles (id),
  created_at timestamptz not null default now()
);
-- El mismo PIN no puede venderse dos veces dentro de la organización.
create unique index if not exists venta_pines_org_pin_key on public.venta_pines (organization_id, pin);
create index if not exists venta_pines_venta_id_idx on public.venta_pines (venta_id);
create index if not exists venta_pines_sede_created_idx on public.venta_pines (sede_id, created_at);

alter table public.venta_pines enable row level security;

drop policy if exists "venta_pines_select_org_admin" on public.venta_pines;
create policy "venta_pines_select_org_admin" on public.venta_pines
  for select using (public.current_role() = 'admin' and organization_id = public.current_org_id());

drop policy if exists "venta_pines_select_sede_recepcionista" on public.venta_pines;
create policy "venta_pines_select_sede_recepcionista" on public.venta_pines
  for select using (
    public.current_role() = 'recepcionista'
    and organization_id = public.current_org_id()
    and sede_id = public.current_sede_id()
  );

drop policy if exists "venta_pines_insert_admin" on public.venta_pines;
create policy "venta_pines_insert_admin" on public.venta_pines
  for insert with check (public.current_role() = 'admin' and organization_id = public.current_org_id());

drop policy if exists "venta_pines_insert_recepcionista" on public.venta_pines;
create policy "venta_pines_insert_recepcionista" on public.venta_pines
  for insert with check (
    public.current_role() = 'recepcionista'
    and organization_id = public.current_org_id()
    and sede_id = public.current_sede_id()
  );

-- Corregir un PIN mal digitado: solo admin.
drop policy if exists "venta_pines_update_admin" on public.venta_pines;
create policy "venta_pines_update_admin" on public.venta_pines
  for update using (public.current_role() = 'admin' and organization_id = public.current_org_id())
  with check (public.current_role() = 'admin' and organization_id = public.current_org_id());

-- Marcado inicial de los productos que son curso (solo las 3 sedes CEAPP).
-- Cuenta cuántas categorías A2/B1/C1 trae el nombre (combo = 2). Se excluyen
-- recategorización, horas de práctica, adicionales, médicos, licencias, etc.
-- Después se puede ajustar producto por producto desde Admin → Productos.
update public.productos p
set cursos_reales = (
  select count(*) from regexp_matches(p.nombre, '(A2|B1|C1)', 'gi')
)
where p.sede_id in (
    '47fb5e63-7f43-4abb-8297-db6fe1cf6652', -- CEAPP JAMUNDI
    'eb12864e-6906-4fa9-b65e-4ee915993313', -- CEAPP CALI
    'a4269390-960c-4654-8460-2142df73288f'  -- CEAPP SANTANDER
  )
  and p.nombre ~* '(A2|B1|C1)'
  and p.nombre !~* '^(reca|valor|adicion|incremento|licencia|medico|médico|ex )'
  and p.nombre !~* 'reca';

-- Revisión rápida del resultado:
select s.name as sede, p.nombre, p.cursos_reales
from public.productos p join public.sedes s on s.id = p.sede_id
where p.cursos_reales > 0
order by s.name, p.cursos_reales, p.nombre;
