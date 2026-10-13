-- AGREGAR_ITEM_VENTA: le permite a un admin anexarle un producto/servicio
-- adicional a una venta que ya existe (ej. desde "Clientes en mora": al
-- cliente le faltaba otro trámite que no se vendió en el momento). Sube el
-- monto de la venta y recalcula el estado (pagada/abonada), igual que
-- aplicar_descuento_venta pero en la dirección contraria. No toca pagos ni
-- caja — el nuevo saldo queda pendiente de cobrar como cualquier otro.
create or replace function public.agregar_item_venta(
  p_venta_id uuid,
  p_producto_id uuid,
  p_nombre text,
  p_precio numeric
)
returns public.ventas
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_venta public.ventas;
  v_pagado numeric(12, 2);
  v_nombre text;
begin
  if public.current_role() is distinct from 'admin' then
    raise exception 'Solo un administrador puede anexar productos a una venta';
  end if;

  v_nombre := nullif(trim(p_nombre), '');
  if v_nombre is null then
    raise exception 'Falta el nombre del producto';
  end if;
  if p_precio is null or p_precio <= 0 then
    raise exception 'El precio debe ser mayor a cero';
  end if;

  select * into v_venta from public.ventas where id = p_venta_id for update;
  if v_venta.id is null then
    raise exception 'Venta no encontrada';
  end if;
  if v_venta.estado = 'anulada' then
    raise exception 'La venta está anulada';
  end if;

  insert into public.venta_items (venta_id, organization_id, sede_id, producto_id, nombre, precio)
  values (v_venta.id, v_venta.organization_id, v_venta.sede_id, p_producto_id, v_nombre, p_precio);

  select coalesce(sum(monto), 0) into v_pagado from public.venta_pagos where venta_id = p_venta_id;

  update public.ventas
  set monto = monto + p_precio,
      estado = case
        when v_pagado >= (monto + p_precio - descuento + incremento) then 'pagada'
        else 'abonada'
      end
  where id = p_venta_id
  returning * into v_venta;

  return v_venta;
end;
$$;
