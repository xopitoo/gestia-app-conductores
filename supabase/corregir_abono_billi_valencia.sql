-- Billi Valencia Torres (CC 14477594), CEAPP CALI, venta del 2026-11-09
-- (Leidy Pastusano): se registro un pago de $1.500.000 y la venta quedo
-- 'pagada', pero el cliente solo abono $800.000.
--
-- Cambios:
--   * venta_pagos.monto           1.500.000 -> 800.000
--   * caja_movimientos.monto      1.500.000 -> 800.000 (mismo pago, caja de hoy)
--   * ventas.estado               pagada    -> abonada
-- El descuento de $195.000 NO se toca: total a pagar 1.500.000, queda un
-- saldo de $700.000 en Clientes en mora.
-- Idempotente: si el pago ya esta en 800.000 no hace nada.

do $$
declare
  v_venta   constant uuid := '00f6156a-55fb-4721-8c61-8af953071e07';
  v_pago    constant uuid := '6364fa7a-722c-466c-af05-719e463d5888';
  v_actual  numeric;
  v_total   numeric;
begin
  select monto into v_actual from public.venta_pagos where id = v_pago and venta_id = v_venta;
  if v_actual is null then
    raise exception 'No se encontro el pago de Billi Valencia';
  end if;
  if v_actual = 800000 then
    raise notice 'Ya estaba corregido, no se hace nada.';
    return;
  end if;
  if v_actual <> 1500000 then
    raise exception 'El pago vale % y no 1.500.000: revisar antes de tocar', v_actual;
  end if;

  select monto - descuento + incremento into v_total from public.ventas where id = v_venta;
  if v_total <> 1500000 then
    raise exception 'El total de la venta es % y no 1.500.000: revisar', v_total;
  end if;

  update public.venta_pagos set monto = 800000 where id = v_pago;
  update public.caja_movimientos set monto = 800000 where venta_pago_id = v_pago;
  update public.ventas set estado = 'abonada' where id = v_venta;
end $$;

-- Verificacion (debe dar pago 800000, movimiento 800000, estado abonada)
select v.estado,
       (select sum(monto) from public.venta_pagos where venta_id = v.id) as pagado,
       (select sum(monto) from public.caja_movimientos where venta_id = v.id) as en_caja,
       v.monto - v.descuento + v.incremento - (select sum(monto) from public.venta_pagos where venta_id = v.id) as saldo
from public.ventas v
where v.id = '00f6156a-55fb-4721-8c61-8af953071e07';
