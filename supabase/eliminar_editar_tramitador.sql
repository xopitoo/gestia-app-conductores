-- =========================================================
-- Botones de editar/eliminar tramitador, con PIN de seguridad al borrar.
--
-- Agrega:
--  1) Policy de delete en tramitadores (solo admin) — el borrado real
--     siempre pasa por eliminar_tramitador, nunca directo.
--  2) eliminar_tramitador(p_tramitador_id, p_pin): exige el PIN de
--     autorización de la organización y se niega si el tramitador ya
--     tiene ventas o pagos de comisión registrados (para no perder
--     historial financiero por accidente) — en ese caso hay que
--     desactivarlo, no borrarlo.
--
-- Editar nombre/sede/precio especial no necesitaba cambios de base de
-- datos (ya existía la policy de update para admin).
--
-- Correr esto completo en el SQL Editor de Supabase.
-- =========================================================

begin;

drop policy if exists "tramitadores_delete_admin" on public.tramitadores;
create policy "tramitadores_delete_admin" on public.tramitadores
  for delete
  using (public.current_role() = 'admin' and organization_id = public.current_org_id());

create or replace function public.eliminar_tramitador(
  p_tramitador_id uuid,
  p_pin text
)
returns void
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_ventas_count int;
  v_pagos_count int;
begin
  if public.current_role() <> 'admin' then
    raise exception 'Solo un administrador puede eliminar tramitadores';
  end if;
  if not public.verify_org_pin(p_pin) then
    raise exception 'PIN de autorización incorrecto';
  end if;

  select count(*) into v_ventas_count from public.ventas where tramitador_id = p_tramitador_id;
  if v_ventas_count > 0 then
    raise exception 'Este tramitador ya tiene % ventas registradas — desactivalo en vez de eliminarlo', v_ventas_count;
  end if;

  select count(*) into v_pagos_count from public.tramitador_pagos where tramitador_id = p_tramitador_id;
  if v_pagos_count > 0 then
    raise exception 'Este tramitador ya tiene pagos de comisión registrados — desactivalo en vez de eliminarlo';
  end if;

  delete from public.tramitador_precios where tramitador_id = p_tramitador_id;
  delete from public.tramitadores where id = p_tramitador_id;
end;
$$;

commit;
