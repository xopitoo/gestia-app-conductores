-- Daniel Cardenas Tello (CEAPP Santander): INSCRIPCION RUNT de Esperanza Banguero.
-- Estaba en $50.000 con descuento de $15.000 (el cliente pagó $35.000 en caja), y a la
-- tramitadora no le quedaba nada. Se quita el descuento: el cliente debe $50.000, la
-- organización se queda $35.000 (precio_tramitador) y a Esperanza le corresponden $15.000.
-- La venta pasa a 'abonada' con $15.000 por cobrar: registra ese abono desde la venta.
-- El descuento es admin-only por trigger, así que se desactiva un momento solo para este update.
begin;

alter table public.ventas disable trigger ventas_lock_privileged_columns;

do $$
declare
  v public.ventas;
begin
  select * into v from public.ventas where id = 'a2c6a35d-7c90-4ef0-9edd-08c42d6b9e8f';
  if v.id is null or v.monto <> 50000 or v.descuento <> 15000 or v.precio_tramitador <> 35000 then
    raise exception 'La venta no está como se esperaba, no se toca nada';
  end if;
  if (select coalesce(sum(monto), 0) from public.venta_pagos where venta_id = v.id) <> 35000 then
    raise exception 'La venta no tiene exactamente 35000 pagados, no se toca nada';
  end if;

  update public.ventas set descuento = 0, estado = 'abonada' where id = v.id;
end;
$$;

alter table public.ventas enable trigger ventas_lock_privileged_columns;

commit;
