-- Nicole Osorio Brand (CC 1054857192), CEAPP CALI.
-- La venta "B1 escuela 2026, Curso de infractores, Licencia" ($1.350.000,
-- 2026-10-21 7:52 p.m. Bogota, Yeni Ruge) estaba mal: sin pagos, sin PIN y sin
-- movimientos de caja. Se ANULA (estado = 'anulada', como el boton de anular):
-- no se borra, queda el registro, y sale de Clientes en mora y de las
-- estadisticas. Nicole queda debiendo solo la A2 ($390.000).
-- Idempotente: si ya esta anulada, no hace nada.

do $$
declare
  v_venta constant uuid := 'f71a75b2-646c-453d-a2d5-a44b13ba96f1';
  v record;
begin
  select estado, concepto, tramitador_id into v from public.ventas where id = v_venta;
  if v.concepto is null then
    raise exception 'No se encontro la venta';
  end if;
  if v.estado = 'anulada' then
    raise notice 'Ya estaba anulada, no se hace nada.';
    return;
  end if;
  if v.concepto <> 'B1 escuela 2026, Curso de infractores, Licencia' then
    raise exception 'La venta no es la B1 de Nicole (%): no se toca', v.concepto;
  end if;
  if v.tramitador_id is not null then
    raise exception 'La venta tiene tramitador: anularla desde la app para que revierta el cruce';
  end if;
  if exists (select 1 from public.venta_pagos where venta_id = v_venta)
     or exists (select 1 from public.caja_movimientos where venta_id = v_venta)
     or exists (select 1 from public.venta_pines where venta_id = v_venta) then
    raise exception 'La venta ya tiene pagos, caja o PIN: revisar antes de anular';
  end if;

  update public.ventas set estado = 'anulada' where id = v_venta;
end $$;

-- Verificacion: B1 anulada, A2 abonada con saldo 390000
select v.concepto, v.estado,
       v.monto - v.descuento + v.incremento
         - coalesce((select sum(monto) from public.venta_pagos where venta_id = v.id), 0) as saldo
from public.ventas v
where v.cliente_id = '74d4e06e-4896-4a89-b8c9-c803a204a014'
order by v.created_at;
