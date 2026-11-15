-- Miguel Angel Mejia Galvis (CC 1093884570), CEAPP CALI.
-- La segunda venta del 2026-10-14 "Licencia, A2 combo HERO" ($888.000, 12:45 p.m.
-- Bogota, Leidy Pastusano) estaba de mas: sin pagos, sin PIN y sin movimientos
-- de caja. Se ANULA (estado = 'anulada', como el boton de anular): no se borra,
-- queda el registro, y sale de Clientes en mora y de las estadisticas.
-- Miguel queda debiendo solo la C1 ($440.000).
-- Idempotente: si ya esta anulada, no hace nada.

do $$
declare
  v_venta constant uuid := '4609d9db-3dbd-4ca9-9f2b-1e741bf4c1ac';
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
  if v.concepto <> 'Licencia, A2 combo HERO' then
    raise exception 'La venta no es la A2 combo HERO de Miguel (%): no se toca', v.concepto;
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

-- Verificacion: A2 combo HERO anulada, C1 abonada con saldo 440000
select v.concepto, v.estado,
       v.monto - v.descuento + v.incremento
         - coalesce((select sum(monto) from public.venta_pagos where venta_id = v.id), 0) as saldo
from public.ventas v
where v.cliente_id = '1d761ec1-9ad8-45a3-a1c6-e0b9f8899c27'
order by v.created_at;
