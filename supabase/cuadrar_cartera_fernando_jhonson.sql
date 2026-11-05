-- Cuadrar la cartera del tramitador FERNANDO JHONSON con el Excel del 4/11/2026
-- (saldo a cancelar pendiente: $2.208.000).
--
-- 1) Andrés Hoyos (2/10): el precio del tramitador estaba en $250.000; el Excel
--    dice $210.000 (mismo examen de 2 categorías que Juan Sebastián Balanta).
-- 2) Leonardo Félix Núñez (4/11): el Excel dice $540.000. Gestia no puede
--    reclamar más de lo que se le cobró al cliente ($530.000), así que se deja
--    el tope ($530.000) y los $10.000 restantes quedan en el ajuste de abajo.
-- 3) Las 3 ventas de septiembre (William, Javier, Carlos) NO se anulan: son
--    ventas reales que los clientes pagaron completas. El Excel las traía
--    dentro de su saldo anterior; por eso el ajuste (paso 4) las absorbe.
-- 4) Se registra UNA fila en tramitador_pagos con la nota "Ajuste saldo
--    anterior..." por la diferencia exacta que hace falta para que el saldo
--    quede en -$2.208.000. No es una salida de caja (no toca caja_movimientos).
do $$
declare
  t constant uuid := '7819b288-effd-481f-9799-04b93cf44727';
  v_org uuid;
  v_sede uuid;
  v_user uuid;
  v_saldo numeric;
  v_ajuste numeric;
  v_hoyos uuid;
  v_leonardo uuid;
begin
  select organization_id, sede_id into v_org, v_sede from public.tramitadores where id = t;

  select v.id, v.created_by into v_hoyos, v_user
  from public.ventas v join public.clientes c on c.id = v.cliente_id
  where v.tramitador_id = t and c.numero_documento = '1110297496' and v.precio_tramitador = 250000 and v.estado <> 'anulada';
  if v_hoyos is null then raise exception 'No encontré la venta de Andrés Hoyos con precio_tramitador 250000, no se toca nada'; end if;

  select v.id into v_leonardo
  from public.ventas v join public.clientes c on c.id = v.cliente_id
  where v.tramitador_id = t and c.numero_documento = '14476623' and v.precio_tramitador = 510000 and v.estado <> 'anulada';
  if v_leonardo is null then raise exception 'No encontré la venta de Leonardo Núñez con precio_tramitador 510000, no se toca nada'; end if;

  if exists (select 1 from public.tramitador_pagos where tramitador_id = t) then
    raise exception 'Fernando ya tiene pagos de tramitador registrados, no se toca nada';
  end if;

  update public.ventas set precio_tramitador = 210000 where id = v_hoyos;
  update public.ventas set precio_tramitador = 530000 where id = v_leonardo;

  -- Saldo actual con la misma fórmula de tramitadores_saldo (positivo = Gestia le debe a él).
  select coalesce(sum(pagos.pagado), 0) - coalesce(sum(
           (v.monto - v.descuento + v.incremento) - greatest(0,
             coalesce(v.monto_cobrado_tramitador,
               ref.monto_referido - case when v.monto > 0 then round(v.descuento * ref.monto_referido / v.monto) else 0 end
             ) - v.precio_tramitador)
         ), 0)
  into v_saldo
  from public.ventas v
  left join lateral (
    select case when count(*) > 0 then sum(vi.precio) else v.monto end as monto_referido
    from public.venta_items vi
    where vi.venta_id = v.id
      and vi.producto_id in (select tp.producto_id from public.tramitador_precios tp where tp.tramitador_id = t)
  ) ref on true
  left join lateral (
    select coalesce(sum(vp.monto), 0) as pagado
    from public.venta_pagos vp
    where vp.venta_id = v.id and vp.metodo_pago <> 'cruce_tramitador'
  ) pagos on true
  where v.tramitador_id = t and v.estado <> 'anulada';

  v_ajuste := v_saldo + 2208000;  -- saldo ahora (negativo = debe) menos el objetivo (-2.208.000)
  if v_ajuste <= 0 or v_ajuste > 2000000 then
    raise exception 'Ajuste inesperado (%), no se toca nada', v_ajuste;
  end if;

  insert into public.tramitador_pagos (tramitador_id, organization_id, sede_id, monto, nota, created_by)
  values (t, v_org, v_sede, v_ajuste,
          'Ajuste saldo anterior según cartera Excel 4/11/2026 (no es salida de caja)', v_user);

  raise notice 'Ajuste registrado: %. Saldo final esperado: -2208000', v_ajuste;
end;
$$;
