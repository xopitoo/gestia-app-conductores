-- Config de "Curso de infractores" (/curso-infractores): una fila por
-- organización con el % del valor de la multa (ya con descuento) que CEAPP
-- cobra por el curso — el resto lo paga el cliente directo en el SIMIT.
-- Editable desde admin porque es una decisión comercial de CEAPP, no un
-- valor legal fijo (a diferencia de los plazos de 5/11/20/26 días, que sí
-- están fijados por ley y van harcodeados en el cálculo).

create table if not exists public.curso_infractores_config (
  organization_id uuid primary key references public.organizations (id) on delete cascade,
  porcentaje_curso numeric(5, 4) not null default 0.25 check (porcentaje_curso >= 0 and porcentaje_curso <= 1),
  updated_at timestamptz not null default now()
);

drop trigger if exists curso_infractores_config_set_updated_at on public.curso_infractores_config;
create trigger curso_infractores_config_set_updated_at
  before update on public.curso_infractores_config
  for each row execute function public.set_updated_at();

alter table public.curso_infractores_config enable row level security;

drop policy if exists "curso_infractores_config_select_org" on public.curso_infractores_config;
create policy "curso_infractores_config_select_org" on public.curso_infractores_config
  for select using (organization_id = public.current_org_id());

drop policy if exists "curso_infractores_config_update_admin" on public.curso_infractores_config;
create policy "curso_infractores_config_update_admin" on public.curso_infractores_config
  for update
  using (public.current_role() = 'admin' and organization_id = public.current_org_id())
  with check (public.current_role() = 'admin' and organization_id = public.current_org_id());

-- Semilla: una fila por organización existente, 25% por defecto (el mismo
-- % que usa CIA Carr SAS, la referencia que pidió el admin) — editable
-- después desde /curso-infractores.
insert into public.curso_infractores_config (organization_id, porcentaje_curso)
select o.id, 0.25
from public.organizations o
on conflict (organization_id) do nothing;
