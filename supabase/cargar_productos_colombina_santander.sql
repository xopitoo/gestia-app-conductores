-- Productos "Colombina 2026" para CEAPP SANTANDER (a2, b1, c1, combos y reca).
-- cursos_reales: A2/B1/C1 y Reca = 1 PIN, combos = 2 (ver crear_pines_curso.sql).
-- Idempotente: si el nombre ya existe en la sede, no lo duplica.
insert into public.productos (organization_id, sede_id, nombre, precio, cursos_reales, created_by)
select s.organization_id, s.id, v.nombre, v.precio, v.cursos, (select id from public.profiles where role = 'admin' and organization_id = s.organization_id order by created_at limit 1)
from public.sedes s
cross join (values
  ('A2 Colombina 2026',     470000, 1),
  ('B1 Colombina 2026',     800000, 1),
  ('C1 Colombina 2026',     960000, 1),
  ('A2+B1 Colombina 2026', 1270000, 2),
  ('A2+C1 Colombina 2026', 1431000, 2),
  ('Reca Colombina 2026',   850000, 1)
) as v(nombre, precio, cursos)
where s.id = 'a4269390-960c-4654-8460-2142df73288f'
  and not exists (
    select 1 from public.productos p where p.sede_id = s.id and p.nombre = v.nombre
  );

select nombre, precio, cursos_reales from public.productos
where sede_id = 'a4269390-960c-4654-8460-2142df73288f' and nombre like '% Colombina 2026' order by nombre;
