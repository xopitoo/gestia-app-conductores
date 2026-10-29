-- Carga el catálogo de precios real de CEAPP Jamundí (33 productos, del
-- Excel "PRODUCTOS SEDE JAMUNDI 2.xlsx" compartido por el admin el
-- 2026-10-14) y borra el único producto genérico que tenía cargado antes
-- ("Soat", a un precio fijo que ya no aplica — ahora el SOAT se cotiza con
-- el valor real en la propia venta, ver /soat y el botón "SOAT (valor
-- variable)" en /ventas/nueva). Es seguro borrarlo aunque ya se haya usado
-- en una venta: venta_items.producto_id es "on delete set null", así que la
-- venta histórica conserva su nombre/precio propios sin romperse.

delete from public.productos
where sede_id = '47fb5e63-7f43-4abb-8297-db6fe1cf6652'
  and nombre = 'Soat';

insert into public.productos (organization_id, sede_id, nombre, precio)
select '390f1a9c-bad2-42dc-9562-856775c05ae0', '47fb5e63-7f43-4abb-8297-db6fe1cf6652', v.nombre, v.precio
from (
  values
    ('A2 JAMUNDI 2026', 540000::numeric),
    ('A2 TRAMITADOR', 470000::numeric),
    ('B1 JAMUNDI 2026', 920000::numeric),
    ('B1 TRAMITADOR', 700000::numeric),
    ('C1 JAMUNDI 2026', 1040000::numeric),
    ('C1 TRAMITADOR', 860000::numeric),
    ('A2+B1 JAMUNDI 2026', 1380000::numeric),
    ('A2+B1 TRAMITADOR', 1170000::numeric),
    ('A2+C1 JAMUNDI 2026', 1580000::numeric),
    ('A2+C1 TRAMITADOR', 1350000::numeric),
    ('RECA', 720000::numeric),
    ('RECA TRAMITADOR', 850000::numeric),
    ('MEDICO TRAMITADOR', 180000::numeric),
    ('ADICIONAL RUNT', 100000::numeric),
    ('MEDICO COMBO TRAMITADOR', 260000::numeric),
    ('MEDICO', 240000::numeric),
    ('MEDICO COMBO', 320000::numeric),
    ('INCREMENTO MEDICO', 11000::numeric),
    ('INCREMENTO MEDICO COMBO', 18000::numeric),
    ('LICENCIA INTERNACIONAL', 590000::numeric),
    ('INCREMENTO LICENCIA', 20000::numeric),
    ('INCREMENTO LICENCIA COMBO', 40000::numeric),
    ('LICENCIA', 160000::numeric),
    ('LICENCIA COMBO', 320000::numeric),
    ('RENOVACION', 360000::numeric),
    ('RENOVACION COMBO', 580000::numeric),
    ('RUNT', 50000::numeric),
    ('RUNT MODIFICACIÓN', 40000::numeric),
    ('2 HORAS REFUERZO', 110000::numeric),
    ('4 HORAS REFUERZO', 220000::numeric),
    ('6 HORAS REFUERZO', 300000::numeric),
    ('10 HORAS REFUERZO', 500000::numeric),
    ('ADICIONAL PRACTICA', 150000::numeric)
) as v(nombre, precio)
where not exists (
  select 1 from public.productos p
  where p.sede_id = '47fb5e63-7f43-4abb-8297-db6fe1cf6652' and p.nombre = v.nombre
);
