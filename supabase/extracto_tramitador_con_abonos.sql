-- Extracto de tramitador: ahora cada pago/abono real de un cliente suyo
-- aparece como una fila propia (tipo 'abono', en verde en la UI) en vez de
-- quedar escondido dentro del aporte neto de la venta. La fila de la venta
-- pasa a mostrar solo la deuda (negativa) y cada abono suma aparte — la
-- suma total es idéntica, así que el saldo final sigue coincidiendo con
-- tramitadores_saldo.

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
      -- Solo lo que se le reclama (deuda), en negativo: lo que el cliente ya
      -- pagó aparece aparte, una fila verde por cada pago/abono (abajo) —
      -- la suma de ambas es idéntica al aporte neto de antes, así que el
      -- saldo final sigue coincidiendo con tramitadores_saldo.
      -(
        (v.monto - v.descuento + v.incremento) - greatest(
          0,
          coalesce(
            v.monto_cobrado_tramitador,
            referidos.monto_referido
              - case when v.monto > 0 then round(v.descuento * referidos.monto_referido / v.monto) else 0 end
          ) - v.precio_tramitador
        )
      ) as monto,
      coalesce(pagos.pagado, 0) as pagado,
      (v.monto - v.descuento + v.incremento) as total,
      0 as orden
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

    -- Un pago/abono real de un cliente de este tramitador (un cruce no
    -- cuenta: no es plata nueva, ya lo refleja el pago_tramitador de abajo).
    select
      vp.created_at as fecha,
      'abono'::text as tipo,
      vp.id as referencia_id,
      case
        when vp.created_at - v.created_at > interval '1 minute' then 'Abono'
        else 'Pago inicial'
      end || ' (' || vp.metodo_pago || ') — ' || coalesce(c.nombre_completo, 'Cliente') as descripcion,
      vp.monto as monto,
      null::numeric as pagado,
      null::numeric as total,
      1 as orden
    from public.venta_pagos vp
    join public.ventas v on v.id = vp.venta_id
    left join public.clientes c on c.id = v.cliente_id
    where v.tramitador_id = p_tramitador_id
      and v.estado <> 'anulada'
      and vp.metodo_pago <> 'cruce_tramitador'

    union all

    select
      tp.created_at as fecha,
      'pago_tramitador'::text as tipo,
      tp.id as referencia_id,
      coalesce(tp.nota, 'Pago al tramitador') as descripcion,
      -tp.monto as monto,
      null::numeric as pagado,
      null::numeric as total,
      2 as orden
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
    sum(e.monto) over (order by e.fecha, e.orden, e.referencia_id rows between unbounded preceding and current row) as saldo_acumulado
  from eventos e
  order by e.fecha, e.orden, e.referencia_id;
end;
$$;
