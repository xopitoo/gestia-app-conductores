-- Corrige un error mío en clientes_actualizacion_datos_recepcionista.sql:
-- bloqueaba licencia_particular_vence/licencia_publico_vence como si fueran
-- campos "privilegiados" de solo-admin, pero esas las actualiza SOLA
-- actualizar_vencimiento_licencia en cada venta con categorías de licencia
-- (curso A2, B1, etc.) — para CUALQUIERA que venda, admin o recepcionista.
-- Eso rompía el registro de esas ventas con el error "No autorizado para
-- modificar esos campos del cliente".
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
    or new.created_by is distinct from old.created_by
  ) then
    raise exception 'No autorizado para modificar esos campos del cliente';
  end if;
  return new;
end;
$$;
