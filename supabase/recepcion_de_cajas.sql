-- Recepción de cajas: el administrador marca que recibió el efectivo de una caja cerrada.
-- Se guarda cuándo y quién la marcó (recibida_at / recibida_by); null = "por recibir".
-- Solo un admin puede cambiar esas dos columnas (las recepcionistas pueden actualizar su caja
-- para cerrarla, así que se bloquea por trigger).
alter table public.caja_sesiones
  add column if not exists recibida_at timestamptz,
  add column if not exists recibida_by uuid references public.profiles (id);

create or replace function public.lock_caja_recepcion()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  if (new.recibida_at is distinct from old.recibida_at or new.recibida_by is distinct from old.recibida_by)
     and public.current_role() is distinct from 'admin' then
    raise exception 'Solo un administrador puede marcar una caja como recibida';
  end if;
  return new;
end;
$$;

drop trigger if exists caja_sesiones_lock_recepcion on public.caja_sesiones;
create trigger caja_sesiones_lock_recepcion
  before update on public.caja_sesiones
  for each row execute function public.lock_caja_recepcion();

-- Opcional: dejar como "recibidas" todas las cajas cerradas antes de hoy, para que solo se vean
-- por recibir las nuevas. Descomenta si lo quieres (recibida_by queda vacío).
-- update public.caja_sesiones set recibida_at = closed_at
--  where estado = 'cerrada' and recibida_at is null and closed_at < '2026-11-07T05:00:00Z';
