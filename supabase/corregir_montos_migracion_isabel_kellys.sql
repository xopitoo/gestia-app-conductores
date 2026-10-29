-- Corrige dos ventas de la migración que quedaron con un monto menor al
-- pedido real (según la lista de ingresos del sistema viejo del 24-oct):
--   #8801 Isabel Cristina Arias Aponza (Jamundí): total 470.000 -> 1.170.000, abonó 470.000 -> 730.000 (debe 440.000)
--   #9373 Kellys Yohana Moreno Delgado (Jamundí): total 780.000 -> 1.708.000, abonó 780.000 -> 1.370.000 (debe 338.000)
-- Gestia bloquea los cambios de monto de una venta salvo con la marca de
-- sesión app.allow_monto_item_adicional (ver lock_venta_privileged_columns),
-- por eso va en un bloque DO que la fija solo para esta transacción. Cada
-- corrección verifica los valores actuales antes de tocar nada.

do $$
declare
  r record;
  v_id uuid;
  v_pago_id uuid;
begin
  perform set_config('app.allow_monto_item_adicional', 'true', true);

  for r in
    select * from (values
      ('Tramite RUNT (migracion historica #8801)', 470000::numeric, 1170000::numeric, 470000::numeric, 730000::numeric),
      ('Tramite RUNT (migracion historica #9373)', 780000::numeric, 1708000::numeric, 780000::numeric, 1370000::numeric)
    ) as t(concepto, monto_actual, monto_nuevo, pago_actual, pago_nuevo)
  loop
    select id into v_id from public.ventas
      where concepto = r.concepto and monto = r.monto_actual;
    if v_id is null then
      raise exception 'No encontré la venta % con monto %, no se toca nada', r.concepto, r.monto_actual;
    end if;

    select id into v_pago_id from public.venta_pagos
      where venta_id = v_id and monto = r.pago_actual;
    if v_pago_id is null then
      raise exception 'La venta % no tiene un único pago de %, no se toca nada', r.concepto, r.pago_actual;
    end if;

    update public.venta_pagos set monto = r.pago_nuevo where id = v_pago_id;
    update public.venta_items set precio = r.monto_nuevo where venta_id = v_id;
    update public.ventas set monto = r.monto_nuevo, estado = 'abonada' where id = v_id;
  end loop;
end;
$$;
