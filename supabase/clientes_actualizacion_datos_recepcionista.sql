-- Deja que una recepcionista actualice datos de contacto/RUNT de un
-- cliente ya cargado (fecha de nacimiento, teléfono, correo, si tiene o no
-- RUNT) — antes esto era exclusivo del admin. El resto de los campos
-- (documento, nombre, sexo, sede, activo/inactivo) sigue siendo solo-admin:
-- el trigger de abajo lo bloquea aunque alguien intente forzarlo con un
-- UPDATE distinto al que arma la Server Action.
--
-- Correr esto completo en el SQL Editor de Supabase.

create or replace function public.lock_cliente_privileged_columns()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  if public.current_role() is distinct from 'admin' and (
    new.tipo_documento is distinct from old.tipo_documento
    or new.numero_documento is distinct from old.numero_documento
    or new.nombre_completo is distinct from old.nombre_completo
    or new.sexo is distinct from old.sexo
    or new.sede_id is distinct from old.sede_id
    or new.organization_id is distinct from old.organization_id
    or new.active is distinct from old.active
    or new.fingerprints_enrolled is distinct from old.fingerprints_enrolled
    or new.licencia_particular_vence is distinct from old.licencia_particular_vence
    or new.licencia_publico_vence is distinct from old.licencia_publico_vence
    or new.created_by is distinct from old.created_by
  ) then
    raise exception 'No autorizado para modificar esos campos del cliente';
  end if;
  return new;
end;
$$;

drop trigger if exists clientes_lock_privileged_columns on public.clientes;
create trigger clientes_lock_privileged_columns
  before update on public.clientes
  for each row execute function public.lock_cliente_privileged_columns();

drop policy if exists "clientes_update_recepcionista" on public.clientes;
create policy "clientes_update_recepcionista" on public.clientes
  for update
  using (public.current_role() = 'recepcionista' and organization_id = public.current_org_id())
  with check (public.current_role() = 'recepcionista' and organization_id = public.current_org_id());
