-- Sara Alvarez Garcia (Jamundí, pedido #9299): la migración la dejó con total
-- 780.000 y un solo abono de 450.000; según la lista de ingresos del sistema
-- viejo (24-oct) el pedido es de 940.000 y abonó 910.000 (debe 30.000).
-- Cambiar el monto de una venta exige la marca de sesión
-- app.allow_monto_item_adicional (ver lock_venta_privileged_columns). El abono
-- que falta (460.000) se agrega como pago "otro", sin movimiento de caja.
do $$
declare
  v public.ventas;
begin
  perform set_config('app.allow_monto_item_adicional', 'true', true);

  select * into v from public.ventas
    where concepto = 'Tramite RUNT (migracion historica #9299)' and monto = 780000;
  if v.id is null then
    raise exception 'No encontré la venta #9299 con monto 780000, no se toca nada';
  end if;
  if (select coalesce(sum(monto), 0) from public.venta_pagos where venta_id = v.id) <> 450000 then
    raise exception 'La venta #9299 no tiene exactamente 450000 pagados, no se toca nada';
  end if;

  update public.venta_items set precio = 940000 where venta_id = v.id;
  update public.ventas set monto = 940000, estado = 'abonada' where id = v.id;
  insert into public.venta_pagos (venta_id, organization_id, sede_id, monto, metodo_pago, created_by, created_at)
  values (v.id, v.organization_id, v.sede_id, 460000, 'otro', v.vendedor_id, '2026-10-24 22:00:00+00');
end;
$$;
