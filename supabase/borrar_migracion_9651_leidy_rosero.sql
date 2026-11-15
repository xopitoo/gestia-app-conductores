-- Leidy Natalia Rosero Flor (CC 1112484786), CEAPP JAMUNDI.
-- Se borra por completo la venta migrada "Tramite RUNT (migracion historica
-- #9651)" ($1.908.000): sus items, sus 3 pagos ($1.200.000 migrado +
-- $323.000 efectivo + $177.000 transferencia de hoy) y los 2 ingresos de
-- caja de hoy que generaron esos 2 pagos ($500.000).
-- NO se toca la venta "MEDICO 2 CATEGORIAS, A2+C1 JAMUNDI 2026" ni sus pagos.
--
-- Los movimientos de caja se borran a mano primero porque su venta_id es
-- "on delete set null": si se borrara solo la venta quedarian huerfanos y
-- la caja seguiria contando esos $500.000.
-- Idempotente: si la venta ya no existe, no hace nada.

do $$
declare
  v_venta constant uuid := '7f6ec5dc-a9af-43df-bf35-9f98ec0fa25f';
  v_concepto text;
  v_movs int;
begin
  select concepto into v_concepto from public.ventas where id = v_venta;
  if v_concepto is null then
    raise notice 'La venta ya no existe, no se hace nada.';
    return;
  end if;
  if v_concepto <> 'Tramite RUNT (migracion historica #9651)' then
    raise exception 'La venta % no es la migracion #9651 (%), no se borra', v_venta, v_concepto;
  end if;
  if exists (
    select 1 from public.tramitador_pagos tp
    join public.venta_pagos vp on vp.id = tp.venta_pago_id
    where vp.venta_id = v_venta
  ) then
    raise exception 'Hay pagos de tramitador ligados a esta venta: revisar antes de borrar';
  end if;

  delete from public.caja_movimientos where venta_id = v_venta;
  get diagnostics v_movs = row_count;
  raise notice 'Movimientos de caja borrados: %', v_movs;

  delete from public.ventas where id = v_venta; -- cascada: items, pagos, pines
end $$;

-- Verificacion: la venta 9651 ya no debe existir y solo debe quedar la A2+C1
select v.concepto, v.estado,
       v.monto - v.descuento + v.incremento as total,
       (select coalesce(sum(monto), 0) from public.venta_pagos where venta_id = v.id) as pagado
from public.ventas v
where v.cliente_id = '054c7c8c-94d3-4985-a683-590a5bae45b9';
