-- Borra los dos productos de prueba sin sede ("Recategorización - Escuela" y
-- "Recategorización - Médico", creados el 2/9/2026) que nunca se vendieron.
-- Solo borra si ninguna venta, cotización ni precio de tramitador los usa.
delete from public.productos p
where p.sede_id is null
  and p.nombre in ('Recategorización - Escuela', 'Recategorización - Médico')
  and not exists (select 1 from public.venta_items vi where vi.producto_id = p.id)
  and not exists (select 1 from public.cotizacion_items ci where ci.producto_id = p.id)
  and not exists (select 1 from public.tramitador_precios tp where tp.producto_id = p.id);

select count(*) as quedan from public.productos
where sede_id is null and nombre in ('Recategorización - Escuela', 'Recategorización - Médico');
