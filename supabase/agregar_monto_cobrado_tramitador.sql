-- Permite registrar y corregir el caso en que un tramitador le cobra al
-- cliente un monto distinto al que queda registrado en la venta (ej. el
-- cliente paga $200.000 directo al tramitador por fuera de caja, pero en
-- Gestia solo se registran los $140.000 que le corresponden a la
-- organización). Antes la "ganancia del tramitador" solo se calculaba a
-- partir de los precios de los venta_items, así que en este caso siempre
-- daba $0 — para verla bien, tocaba anotar el monto real a mano por fuera
-- del sistema.
--
-- monto_cobrado_tramitador (NULL por defecto) es puramente informativo: no
-- afecta el monto de la venta, la caja ni los métodos de pago — solo entra
-- al cálculo de ganancia/reclamo del tramitador (tramitadores_saldo,
-- tramitador_extracto) cuando está presente.

alter table public.ventas add column if not exists monto_cobrado_tramitador numeric(12, 2);
alter table public.ventas drop constraint if exists ventas_monto_cobrado_tramitador_chk;
alter table public.ventas add constraint ventas_monto_cobrado_tramitador_chk
  check (monto_cobrado_tramitador is null or monto_cobrado_tramitador >= 0);

create or replace function public.registrar_venta(
  p_sede_id uuid,
  p_cliente_id uuid,
  p_items jsonb,
  p_pagos jsonb,
  p_vendedor_id uuid,
  p_pin text default null,
  p_referido_nombre text default null,
  p_descuento_tipo text default null,
  p_descuento_valor numeric default 0,
  p_tramitador_id uuid default null,
  p_precio_tramitador numeric default 0,
  p_categorias_licencia text[] default null,
  p_incremento_tipo text default null,
  p_incremento_valor numeric default 0,
  p_monto_cobrado_tramitador numeric default null
)
returns public.ventas
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_venta public.ventas;
  v_sesion_id uuid;
  v_org_id uuid;
  v_monto_total numeric(12, 2);
  v_descuento numeric(12, 2);
  v_incremento numeric(12, 2);
  v_monto_neto numeric(12, 2);
  v_monto_pagado numeric(12, 2);
  v_concepto text;
  v_item jsonb;
  v_pago jsonb;
  v_pago_id uuid;
begin
  if p_items is null or jsonb_typeof(p_items) <> 'array' or jsonb_array_length(p_items) = 0 then
    raise exception 'Debe seleccionar al menos un producto';
  end if;
  -- p_pagos puede venir vacío: una venta puede quedar totalmente pendiente
  -- (ej. un tramitador trae gente y paga al día siguiente) — sigue exigiendo
  -- el PIN más abajo, porque $0 pagado siempre es menos del 50%.
  if p_pagos is null or jsonb_typeof(p_pagos) <> 'array' then
    raise exception 'El formato de los pagos es inválido';
  end if;

  select id into v_sesion_id from public.caja_sesiones
    where sede_id = p_sede_id and estado = 'abierta';
  if v_sesion_id is null then
    raise exception 'Debe abrir caja antes de registrar una venta';
  end if;

  select sum((item ->> 'precio')::numeric) into v_monto_total
    from jsonb_array_elements(p_items) as item;
  select string_agg(item ->> 'nombre', ', ' order by ordinality) into v_concepto
    from jsonb_array_elements(p_items) with ordinality as t (item, ordinality);
  select coalesce(sum((pago ->> 'monto')::numeric), 0) into v_monto_pagado
    from jsonb_array_elements(p_pagos) as pago;

  if p_descuento_tipo is null or p_descuento_tipo = '' then
    v_descuento := 0;
  elsif p_descuento_tipo = 'porcentaje' then
    if p_descuento_valor < 0 or p_descuento_valor > 100 then
      raise exception 'El porcentaje de descuento debe estar entre 0 y 100';
    end if;
    v_descuento := round(v_monto_total * p_descuento_valor / 100, 2);
  elsif p_descuento_tipo = 'fijo' then
    if p_descuento_valor < 0 then
      raise exception 'El descuento no puede ser negativo';
    end if;
    v_descuento := p_descuento_valor;
  else
    raise exception 'Tipo de descuento inválido';
  end if;
  if v_descuento > v_monto_total then
    raise exception 'El descuento no puede superar el total de la orden';
  end if;
  v_monto_neto := v_monto_total - v_descuento;

  -- Incremento (Brilla/Addi/Sistecrédito, etc.) — se calcula sobre el total
  -- YA con descuento aplicado (lo que de verdad se está financiando), y se
  -- le suma encima. A diferencia del descuento, no es editable después de
  -- creada la venta.
  if p_incremento_tipo is null or p_incremento_tipo = '' then
    v_incremento := 0;
  elsif p_incremento_tipo = 'porcentaje' then
    if p_incremento_valor < 0 or p_incremento_valor > 100 then
      raise exception 'El porcentaje de incremento debe estar entre 0 y 100';
    end if;
    v_incremento := round(v_monto_neto * p_incremento_valor / 100, 2);
  elsif p_incremento_tipo = 'fijo' then
    if p_incremento_valor < 0 then
      raise exception 'El incremento no puede ser negativo';
    end if;
    v_incremento := p_incremento_valor;
  else
    raise exception 'Tipo de incremento inválido';
  end if;
  v_monto_neto := v_monto_neto + v_incremento;

  if v_monto_pagado > v_monto_neto then
    raise exception 'El pago no puede superar el total de la orden';
  end if;

  if v_monto_pagado < v_monto_neto * 0.5 then
    if not public.verify_org_pin(p_pin) then
      raise exception 'Se requiere el PIN de autorización para ventas con menos del 50%% de pago inicial';
    end if;
  end if;

  v_org_id := public.current_org_id();

  if p_precio_tramitador < 0 then
    raise exception 'El precio del tramitador no puede ser negativo';
  end if;
  if p_precio_tramitador > v_monto_neto then
    raise exception 'El precio del tramitador no puede superar el total de la orden';
  end if;
  if p_monto_cobrado_tramitador is not null and p_monto_cobrado_tramitador < 0 then
    raise exception 'El monto cobrado por el tramitador no puede ser negativo';
  end if;

  insert into public.ventas (
    organization_id, sede_id, cliente_id, concepto, monto, estado, vendedor_id, referido_nombre,
    descuento, incremento, tramitador_id, precio_tramitador, monto_cobrado_tramitador, categorias_licencia,
    created_by
  )
  values (
    v_org_id, p_sede_id, p_cliente_id, v_concepto, v_monto_total,
    case when v_monto_pagado >= v_monto_neto then 'pagada' else 'abonada' end,
    p_vendedor_id, nullif(trim(p_referido_nombre), ''),
    v_descuento, v_incremento, p_tramitador_id, p_precio_tramitador, p_monto_cobrado_tramitador,
    p_categorias_licencia, auth.uid()
  )
  returning * into v_venta;

  perform public.actualizar_vencimiento_licencia(p_cliente_id, p_categorias_licencia, v_venta.created_at::date);

  for v_item in select * from jsonb_array_elements(p_items)
  loop
    insert into public.venta_items (venta_id, organization_id, sede_id, producto_id, nombre, precio)
    values (
      v_venta.id,
      v_org_id,
      p_sede_id,
      nullif(v_item ->> 'producto_id', '')::uuid,
      v_item ->> 'nombre',
      (v_item ->> 'precio')::numeric
    );
  end loop;

  for v_pago in select * from jsonb_array_elements(p_pagos)
  loop
    insert into public.venta_pagos (venta_id, organization_id, sede_id, monto, metodo_pago, comprobante_path, created_by)
    values (
      v_venta.id, v_org_id, p_sede_id,
      (v_pago ->> 'monto')::numeric, v_pago ->> 'metodo_pago', nullif(v_pago ->> 'comprobante_path', ''), auth.uid()
    )
    returning id into v_pago_id;

    insert into public.caja_movimientos (
      caja_sesion_id, organization_id, sede_id, tipo, concepto, monto, metodo_pago, venta_id, venta_pago_id, created_by
    )
    values (
      v_sesion_id, v_org_id, p_sede_id, 'ingreso', v_concepto,
      (v_pago ->> 'monto')::numeric, v_pago ->> 'metodo_pago', v_venta.id, v_pago_id, auth.uid()
    );
  end loop;

  -- Si es una venta de tramitador, cruza en el momento contra cualquier
  -- saldo a favor que ya tuviera acumulado (ver
  -- tramitador_cruce_automatico) — así, si esta venta queda con deuda,
  -- puede saldarse sola sin esperar a que alguien entre al módulo de
  -- tramitador. Puede dejar esta misma venta en 'pagada', así que se
  -- vuelve a leer antes de devolverla.
  if p_tramitador_id is not null then
    perform public.tramitador_cruce_automatico(p_tramitador_id, p_sede_id);
    select * into v_venta from public.ventas where id = v_venta.id;
  end if;

  return v_venta;
end;
$$;

drop function if exists public.tramitadores_saldo(uuid);
create or replace function public.tramitadores_saldo(p_sede_id uuid default null)
returns table (
  id uuid,
  nombre text,
  pagado_clientes numeric,
  reclamo numeric,
  pagado_tramitador numeric,
  saldo_a_favor numeric
)
language plpgsql
security definer
set search_path = public
as $$
begin
  return query
  select
    t.id,
    t.nombre,
    coalesce(v_sum.pagado_clientes, 0) as pagado_clientes,
    coalesce(v_sum.reclamo, 0) as reclamo,
    coalesce(tp_sum.pagado_tramitador, 0) as pagado_tramitador,
    coalesce(v_sum.pagado_clientes, 0) - coalesce(v_sum.reclamo, 0) - coalesce(tp_sum.pagado_tramitador, 0) as saldo_a_favor
  from public.tramitadores t
  left join lateral (
    select sum(vs.pagado) as pagado_clientes, sum(vs.reclamo) as reclamo
    from (
      select
        coalesce(pagos.pagado, 0) as pagado,
        -- coalesce con monto_cobrado_tramitador: si el tramitador le cobró al
        -- cliente un monto distinto al registrado (ver comentario en la
        -- columna), ese es el que cuenta como "lo que trajo" — sin el ajuste
        -- proporcional de descuento, porque ese descuento es sobre lo que
        -- cobra Gestia, no sobre el trato aparte con el cliente.
        (v.monto - v.descuento + v.incremento) - greatest(
          0,
          coalesce(
            v.monto_cobrado_tramitador,
            referidos.monto_referido
              - case when v.monto > 0 then round(v.descuento * referidos.monto_referido / v.monto) else 0 end
          ) - v.precio_tramitador
        ) as reclamo
      from public.ventas v
      left join lateral (
        select case
          when count(*) > 0 then sum(vi.precio)
          else v.monto
        end as monto_referido
        from public.venta_items vi
        where vi.venta_id = v.id
          and vi.producto_id in (select tp.producto_id from public.tramitador_precios tp where tp.tramitador_id = t.id)
      ) referidos on true
      left join lateral (
        -- 'cruce_tramitador' no es plata nueva de un cliente — es crédito
        -- que el tramitador ya tenía, reasignado a esta venta. Si se
        -- contara acá, pagado_clientes subiría exactamente igual que
        -- pagado_tramitador y el saldo a favor nunca bajaría después de
        -- cruzarse, permitiendo cruzar el mismo crédito una y otra vez.
        select coalesce(sum(vp.monto), 0) as pagado
        from public.venta_pagos vp
        where vp.venta_id = v.id and vp.metodo_pago <> 'cruce_tramitador'
      ) pagos on true
      where v.tramitador_id = t.id and v.estado <> 'anulada'
    ) vs
  ) v_sum on true
  left join lateral (
    select sum(tp.monto) as pagado_tramitador
    from public.tramitador_pagos tp
    where tp.tramitador_id = t.id
  ) tp_sum on true
  where t.active = true
    and t.organization_id = public.current_org_id()
    and (p_sede_id is null or t.sede_id is null or t.sede_id = p_sede_id)
  order by t.nombre;
end;
$$;

drop function if exists public.tramitador_extracto(uuid);
create or replace function public.tramitador_extracto(p_tramitador_id uuid)
returns table (
  fecha timestamptz,
  tipo text,
  referencia_id uuid,
  descripcion text,
  monto numeric,
  pagado numeric,
  total numeric,
  saldo_acumulado numeric
)
language plpgsql
security definer
set search_path = public
as $$
begin
  if not exists (
    select 1 from public.tramitadores t
    where t.id = p_tramitador_id and t.organization_id = public.current_org_id()
  ) then
    return;
  end if;

  return query
  with eventos as (
    select
      v.created_at as fecha,
      'venta'::text as tipo,
      v.id as referencia_id,
      coalesce(c.nombre_completo, 'Cliente') as descripcion,
      (
        coalesce(pagos.pagado, 0) - (
          (v.monto - v.descuento + v.incremento) - greatest(
            0,
            coalesce(
              v.monto_cobrado_tramitador,
              referidos.monto_referido
                - case when v.monto > 0 then round(v.descuento * referidos.monto_referido / v.monto) else 0 end
            ) - v.precio_tramitador
          )
        )
      ) as monto,
      coalesce(pagos.pagado, 0) as pagado,
      (v.monto - v.descuento + v.incremento) as total
    from public.ventas v
    left join public.clientes c on c.id = v.cliente_id
    left join lateral (
      select case
        when count(*) > 0 then sum(vi.precio)
        else v.monto
      end as monto_referido
      from public.venta_items vi
      where vi.venta_id = v.id
        and vi.producto_id in (select tp.producto_id from public.tramitador_precios tp where tp.tramitador_id = p_tramitador_id)
    ) referidos on true
    left join lateral (
      -- Mismo criterio que tramitadores_saldo: un cruce no es plata nueva
      -- del cliente, así que no cuenta acá (el pago_tramitador de abajo ya
      -- refleja esa salida de crédito).
      select coalesce(sum(vp.monto), 0) as pagado
      from public.venta_pagos vp
      where vp.venta_id = v.id and vp.metodo_pago <> 'cruce_tramitador'
    ) pagos on true
    where v.tramitador_id = p_tramitador_id and v.estado <> 'anulada'

    union all

    select
      tp.created_at as fecha,
      'pago_tramitador'::text as tipo,
      tp.id as referencia_id,
      coalesce(tp.nota, 'Pago al tramitador') as descripcion,
      -tp.monto as monto,
      null::numeric as pagado,
      null::numeric as total
    from public.tramitador_pagos tp
    where tp.tramitador_id = p_tramitador_id
  )
  select
    e.fecha,
    e.tipo,
    e.referencia_id,
    e.descripcion,
    e.monto,
    e.pagado,
    e.total,
    sum(e.monto) over (order by e.fecha rows between unbounded preceding and current row) as saldo_acumulado
  from eventos e
  order by e.fecha;
end;
$$;

-- =========================================================
-- CORREGIR_PRECIO_TRAMITADOR_VENTA: corrige el precio especial (lo que le
-- corresponde a la organización) y/o el monto que el tramitador le cobró al
-- cliente por fuera de caja (monto_cobrado_tramitador, ver comentario en la
-- definición de la columna) de una venta ya creada — antes no existía
-- ninguna forma de arreglar esto si quedaba mal cargado (ej. el campo se
-- editó a mano por error y quedó en $0), solo se podía ver, nunca corregir.
-- Admin-only, mismo criterio que corregir_forma_pago_venta.
-- =========================================================
create or replace function public.corregir_precio_tramitador_venta(
  p_venta_id uuid,
  p_precio_tramitador numeric,
  p_monto_cobrado_tramitador numeric default null
)
returns public.ventas
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_venta public.ventas;
begin
  if public.current_role() is null or public.current_role() <> 'admin' then
    raise exception 'Solo un administrador puede corregir el precio del tramitador';
  end if;
  if p_precio_tramitador is null or p_precio_tramitador < 0 then
    raise exception 'El precio del tramitador no puede ser negativo';
  end if;
  if p_monto_cobrado_tramitador is not null and p_monto_cobrado_tramitador < 0 then
    raise exception 'El monto cobrado por el tramitador no puede ser negativo';
  end if;

  select * into v_venta from public.ventas where id = p_venta_id;
  if v_venta.id is null or v_venta.organization_id is distinct from public.current_org_id() then
    raise exception 'Venta no encontrada';
  end if;
  if v_venta.tramitador_id is null then
    raise exception 'Esta venta no tiene un tramitador asociado';
  end if;
  if p_precio_tramitador > (v_venta.monto - v_venta.descuento + v_venta.incremento) then
    raise exception 'El precio del tramitador no puede superar el total de la orden';
  end if;

  update public.ventas
  set precio_tramitador = p_precio_tramitador,
      monto_cobrado_tramitador = p_monto_cobrado_tramitador
  where id = p_venta_id
  returning * into v_venta;

  return v_venta;
end;
$$;
