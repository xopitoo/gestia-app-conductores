-- Dos casos puntuales de clientes importados con apellido primero (se le
-- paso por alto el nombre real al clasificar) — ver revision de "quedo
-- alguien sin sexo" tras las migraciones de Jamundi y Santander.
begin;

alter table public.clientes disable trigger clientes_lock_privileged_columns;

update public.clientes
set sexo = 'F'
where id = '436a7754-f7eb-4337-95f5-94a2ed9bffa7'; -- COLLAZOS SABOGAL MARLIN XIMENA

update public.clientes
set sexo = 'M'
where id = '4ece7787-a1f3-4d9b-b053-304fe88bc484'; -- MARTINEZ ORTEGA CRISTIAN

alter table public.clientes enable trigger clientes_lock_privileged_columns;

commit;
