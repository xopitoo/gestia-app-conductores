-- Reemplaza la función anterior (admin-only) para que un recepcionista
-- también pueda anexar un producto/servicio adicional a una venta de SU
-- propia sede, y abre la excepción puntual en el trigger que bloqueaba
-- tocar 'monto' fuera de admin. Ver los comentarios en schema.sql junto a
-- cada función para el detalle completo.

-- 1) Trigger: abre 'monto' bajo la marca app.allow_monto_item_adicional
create or replace function public.lock_venta_privileged_columns()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  if public.current_role() is distinct from 'admin' and (
    new.concepto is distinct from old.concepto
    or (
      new.monto is distinct from old.monto
      and coalesce(current_setting('app.allow_monto_item_adicional', true), '') <> 'true'
    )
    or new.cliente_id is distinct from old.cliente_id
    or new.sede_id is distinct from old.sede_id
    or new.organization_id is distinct from old.organization_id
    or new.vendedor_id is distinct from old.vendedor_id
    or new.referido_nombre is distinct from old.referido_nombre
    or new.descuento is distinct from old.descuento
  ) then
    raise exception 'No autorizado para modificar esos campos de la venta';
  end if;

  if (
    new.certificado is distinct from old.certificado
    or new.certificado_at is distinct from old.certificado_at
    or new.certificado_by is distinct from old.certificado_by
    or new.certificado_path is distinct from old.certificado_path
  ) and coalesce(current_setting('app.allow_certificado_update', true), '') <> 'true' then
    raise exception 'No autorizado para modificar la certificación de esta venta';
  end if;

  if new.incremento is distinct from old.incremento then
    raise exception 'El incremento no se puede modificar después de creada la venta';
  end if;

  return new;
end;
$$;

-- 2) Función: ahora admin o recepcionista (solo su sede), security definer
create or replace function public.agregar_item_venta(
  p_venta_id uuid,
  p_producto_id uuid,
  p_nombre text,
  p_precio numeric
)
returns public.ventas
language plpgsql
security definer
set search_path = public
as $$
declare
  v_venta public.ventas;
  v_pagado numeric(12, 2);
  v_nombre text;
  v_rol text;
begin
  v_rol := public.current_role();
  if v_rol is null or v_rol not in ('admin', 'recepcionista') then
    raise exception 'No autorizado para anexar productos a una venta';
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
  if v_rol <> 'admin' and v_venta.sede_id is distinct from public.current_sede_id() then
    raise exception 'No autorizado para anexar productos a una venta de otra sede';
  end if;
  if v_venta.estado = 'anulada' then
    raise exception 'La venta está anulada';
  end if;

  insert into public.venta_items (venta_id, organization_id, sede_id, producto_id, nombre, precio)
  values (v_venta.id, v_venta.organization_id, v_venta.sede_id, p_producto_id, v_nombre, p_precio);

  select coalesce(sum(monto), 0) into v_pagado from public.venta_pagos where venta_id = p_venta_id;

  perform set_config('app.allow_monto_item_adicional', 'true', true);

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
