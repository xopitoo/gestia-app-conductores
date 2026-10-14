-- Tabla FINANCIADORAS (Brilla, Addi, Sistecrédito) para el simulador de
-- cuotas (/simulador-credito) + semilla con las 3 financiadoras. Brilla
-- queda con la tasa real (confirmada contra su propio simulador el
-- 2026-10-13); Addi y Sistecrédito quedan inactivas con tasa 0 hasta que
-- se les cargue la tasa real desde el panel de admin en /simulador-credito.

create table if not exists public.financiadoras (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  nombre text not null,
  tasa_mensual numeric(8, 6) not null default 0 check (tasa_mensual >= 0),
  tasa_seguro numeric(8, 6) not null default 0 check (tasa_seguro >= 0),
  plazo_max integer not null default 60 check (plazo_max > 0),
  active boolean not null default true,
  created_by uuid references public.profiles (id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create unique index if not exists financiadoras_org_nombre_idx on public.financiadoras (organization_id, nombre);
create index if not exists financiadoras_organization_id_idx on public.financiadoras (organization_id);

drop trigger if exists financiadoras_set_updated_at on public.financiadoras;
create trigger financiadoras_set_updated_at
  before update on public.financiadoras
  for each row execute function public.set_updated_at();

alter table public.financiadoras enable row level security;

drop policy if exists "financiadoras_select_org" on public.financiadoras;
create policy "financiadoras_select_org" on public.financiadoras
  for select using (organization_id = public.current_org_id());

drop policy if exists "financiadoras_insert_admin" on public.financiadoras;
create policy "financiadoras_insert_admin" on public.financiadoras
  for insert with check (public.current_role() = 'admin' and organization_id = public.current_org_id());

drop policy if exists "financiadoras_update_admin" on public.financiadoras;
create policy "financiadoras_update_admin" on public.financiadoras
  for update
  using (public.current_role() = 'admin' and organization_id = public.current_org_id())
  with check (public.current_role() = 'admin' and organization_id = public.current_org_id());

-- Semilla: una fila por organización existente, sin duplicar si se corre
-- de nuevo (gracias al índice único org+nombre).
insert into public.financiadoras (organization_id, nombre, tasa_mensual, tasa_seguro, plazo_max, active)
select o.id, v.nombre, v.tasa_mensual, v.tasa_seguro, v.plazo_max, v.active
from public.organizations o
cross join (
  values
    ('Brilla', 0.021176::numeric, 0.002154::numeric, 60, true),
    ('Addi', 0::numeric, 0::numeric, 36, false),
    ('Sistecrédito', 0::numeric, 0::numeric, 36, false)
) as v(nombre, tasa_mensual, tasa_seguro, plazo_max, active)
on conflict (organization_id, nombre) do nothing;
