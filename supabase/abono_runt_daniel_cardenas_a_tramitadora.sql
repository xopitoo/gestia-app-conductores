-- Daniel Cardenas Tello (CEAPP Santander): los $15.000 que faltaban de la INSCRIPCION RUNT
-- se registran como pagados y quedan a favor de Esperanza Banguero (pago "otro", SIN
-- movimiento de caja: la plata no entra a la caja de la sede).
-- Resultado: la venta queda 'pagada' ($50.000) y la tramitadora queda con $15.000 a su favor.
do $$
declare
  v public.ventas;
begin
  select * into v from public.ventas where id = 'a2c6a35d-7c90-4ef0-9edd-08c42d6b9e8f';
  if v.id is null or v.estado <> 'abonada' or v.monto <> 50000 or v.descuento <> 0 then
    raise exception 'La venta no está como se esperaba, no se toca nada';
  end if;
  if (select coalesce(sum(monto), 0) from public.venta_pagos where venta_id = v.id) <> 35000 then
    raise exception 'La venta no tiene exactamente 35000 pagados, no se toca nada';
  end if;

  insert into public.venta_pagos (venta_id, organization_id, sede_id, monto, metodo_pago, created_by)
  values (v.id, v.organization_id, v.sede_id, 15000, 'otro', v.vendedor_id);

  update public.ventas set estado = 'pagada' where id = v.id;
end;
$$;
