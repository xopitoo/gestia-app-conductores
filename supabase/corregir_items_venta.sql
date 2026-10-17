-- Permite al administrador corregir los productos de una venta ya creada sin
-- tocar sus pagos (botón "Corregir productos" en el detalle de la venta).

-- =========================================================
-- CORREGIR_ITEMS_VENTA: reemplaza los productos de una venta ya creada
-- (ej. el cliente cambió de opinión y hace dos categorías en vez de una)
-- SIN tocar sus pagos: venta_pagos y caja_movimientos quedan exactamente
-- como están; solo cambian venta_items, el monto, el concepto y, según lo
-- ya pagado, el estado (pagada/abonada). Admin-only. Rechaza: venta
-- anulada, certificado RUNT ya subido, un nuevo total por debajo de lo ya
-- pagado (habría que devolver plata, eso se maneja aparte), un descuento
-- mayor al nuevo total, o un precio especial de tramitador mayor al nuevo
-- total. security definer porque venta_items no tiene policy de
-- delete/insert para nadie; el chequeo de rol de abajo es la barrera.
-- =========================================================
create or replace function public.corregir_items_venta(
  p_venta_id uuid,
  p_items jsonb
)
returns public.ventas
language plpgsql
security definer
set search_path = public
as $$
declare
  v_venta public.ventas;
  v_item jsonb;
  v_nombre text;
  v_total numeric(12, 2);
  v_pagado numeric(12, 2);
  v_neto numeric(12, 2);
  v_concepto text;
begin
  if public.current_role() is null or public.current_role() <> 'admin' then
    raise exception 'Solo un administrador puede corregir los productos de una venta';
  end if;

  if p_items is null or jsonb_typeof(p_items) <> 'array' or jsonb_array_length(p_items) = 0 then
    raise exception 'La venta debe tener al menos un producto';
  end if;
  for v_item in select * from jsonb_array_elements(p_items)
  loop
    v_nombre := nullif(trim(v_item ->> 'nombre'), '');
    if v_nombre is null then
      raise exception 'Falta el nombre de un producto';
    end if;
    if (v_item ->> 'precio') is null or (v_item ->> 'precio')::numeric <= 0 then
      raise exception 'Todos los productos deben tener un precio mayor a cero';
    end if;
  end loop;

  select * into v_venta from public.ventas where id = p_venta_id for update;
  if v_venta.id is null or v_venta.organization_id is distinct from public.current_org_id() then
    raise exception 'Venta no encontrada';
  end if;
  if v_venta.estado = 'anulada' then
    raise exception 'La venta está anulada';
  end if;
  if v_venta.certificado then
    raise exception 'La venta ya tiene el certificado RUNT subido';
  end if;

  select sum((item ->> 'precio')::numeric) into v_total from jsonb_array_elements(p_items) as item;
  select coalesce(sum(monto), 0) into v_pagado from public.venta_pagos where venta_id = p_venta_id;

  if v_venta.descuento > v_total then
    raise exception 'El descuento de la venta supera el nuevo total';
  end if;
  v_neto := v_total - v_venta.descuento + v_venta.incremento;
  if v_neto < v_pagado then
    raise exception 'El nuevo total queda por debajo de lo ya pagado';
  end if;
  if v_venta.tramitador_id is not null and v_venta.precio_tramitador > v_neto then
    raise exception 'El precio especial del tramitador supera el nuevo total';
  end if;

  select string_agg(item ->> 'nombre', ', ' order by ordinality) into v_concepto
    from jsonb_array_elements(p_items) with ordinality as t (item, ordinality);

  delete from public.venta_items where venta_id = p_venta_id;
  insert into public.venta_items (venta_id, organization_id, sede_id, producto_id, nombre, precio)
  select
    v_venta.id, v_venta.organization_id, v_venta.sede_id,
    nullif(item ->> 'producto_id', '')::uuid, trim(item ->> 'nombre'), (item ->> 'precio')::numeric
  from jsonb_array_elements(p_items) with ordinality as t (item, ordinality)
  order by ordinality;

  update public.ventas
  set monto = v_total,
      concepto = v_concepto,
      estado = case when v_pagado >= v_neto then 'pagada' else 'abonada' end
  where id = p_venta_id
  returning * into v_venta;

  return v_venta;
end;
$$;

