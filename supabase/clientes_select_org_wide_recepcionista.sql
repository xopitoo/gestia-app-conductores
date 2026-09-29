-- Un cliente hoy le "pertenece" a una sola sede, y una recepcionista solo
-- veía/buscaba clientes de su propia sede. Como la misma persona suele pasar
-- por más de una sede de CEAPP (ej. examen médico en C.R.C. Valorar y curso
-- en una sede CEAPP), esto trababa la venta: el cliente ya existía (por su
-- documento, único a nivel de organización) pero la recepcionista de la otra
-- sede no lo encontraba ni podía crearlo de nuevo.
--
-- Esto abre la LECTURA de clientes a toda la organización para cualquier
-- recepcionista (antes solo veía su propia sede) — insertar/editar un
-- cliente sigue restringido a la sede propia, sin cambios ahí.
--
-- Correr esto completo en el SQL Editor de Supabase.

drop policy if exists "clientes_select_sede_recepcionista" on public.clientes;
create policy "clientes_select_sede_recepcionista" on public.clientes
  for select using (
    public.current_role() = 'recepcionista'
    and organization_id = public.current_org_id()
  );
