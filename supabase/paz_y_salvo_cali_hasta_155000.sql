  -- Paz y salvo CEAPP CALI: clientes cuyo saldo pendiente TOTAL en Cali es de
  -- $155.000 o menos. Se perdona (no entra plata ni toca la caja): a cada venta
  -- 'abonada' de Cali de esos clientes se le sube el descuento por el valor del
  -- saldo y pasa a 'pagada' — exactamente lo que hace el boton "Paz y salvo" de
  -- Clientes en mora, pero solo con las ventas de CEAPP CALI (la deuda que el
  -- mismo cliente tenga en otras sedes NO se toca).
  --
  -- Revision previa (2026-11-11): 154 clientes / 154 ventas / $7.049.600
  --   * 148 migraciones del sistema viejo ($6.536.600)
  --   * 6 ventas reales ($513.000): Devison Marin 150.000, Gloria Hernandez
  --     108.000, Yulian Ibarguen 90.000, Jose Ramiro Riascos 70.000, Juan Miguel
  --     Sabogal 50.000, Sarai Vanegas 45.000.
  -- Si quieres dejar esas 6 para cobrarlas, pon v_incluir_reales := false.
  --
  -- Reversible: antes de tocar nada guarda en public.paz_y_salvo_cali_backup el
  -- descuento y el estado anteriores de cada venta. Para deshacer ver el bloque
  -- comentado del final.
  -- El script se DETIENE sin cambiar nada si los numeros ya no coinciden con la
  -- revision (alguien pago o vendio en el medio): avisame y lo regenero.
  
  create table if not exists public.paz_y_salvo_cali_backup (
    venta_id uuid primary key references public.ventas (id) on delete cascade,
    descuento_anterior numeric(12, 2) not null,
    estado_anterior text not null,
    saldo_perdonado numeric(12, 2) not null,
    created_at timestamptz not null default now()
  );
  alter table public.paz_y_salvo_cali_backup enable row level security;
  
  do $$
  declare
    v_incluir_reales constant boolean := true;
    v_sede constant uuid := 'eb12864e-6906-4fa9-b65e-4ee915993313'; -- CEAPP CALI
    v_tope constant numeric := 155000;
    v_esperado_ventas int := case when v_incluir_reales then 154 else 148 end;
    v_esperado_total numeric := case when v_incluir_reales then 7049600 else 6536600 end;
    v_n int;
    v_total numeric;
  begin
    create temp table _paz on commit drop as
    with saldos as (
      select v.id as venta_id, v.cliente_id, v.concepto, v.descuento, v.estado,
             v.monto - v.descuento + v.incremento
               - coalesce((select sum(p.monto) from public.venta_pagos p where p.venta_id = v.id), 0) as saldo
      from public.ventas v
      where v.sede_id = v_sede and v.estado = 'abonada'
    ), pendientes as (
      select * from saldos where saldo > 0
    ), por_cliente as (
      select cliente_id, sum(saldo) as total from pendientes group by cliente_id
    )
    select p.venta_id, p.descuento, p.estado, p.saldo
    from pendientes p
    join por_cliente c using (cliente_id)
    where c.total <= v_tope
      and (v_incluir_reales or p.concepto ilike '%migracion historica%');
  
    select count(*), coalesce(sum(saldo), 0) into v_n, v_total from _paz;
    if v_n <> v_esperado_ventas or v_total <> v_esperado_total then
      raise exception 'Los numeros cambiaron desde la revision: % ventas / $% (esperado % / $%). No se toco nada.',
        v_n, v_total, v_esperado_ventas, v_esperado_total;
    end if;
  
    insert into public.paz_y_salvo_cali_backup (venta_id, descuento_anterior, estado_anterior, saldo_perdonado)
    select venta_id, descuento, estado, saldo from _paz
    on conflict (venta_id) do nothing;
  
    -- El trigger bloquea cambiar el descuento desde el SQL Editor (no hay rol
    -- 'admin'): se apaga solo durante este UPDATE.
    alter table public.ventas disable trigger ventas_lock_privileged_columns;
    update public.ventas v
    set descuento = v.descuento + p.saldo,
        estado = 'pagada'
    from _paz p
    where v.id = p.venta_id;
    alter table public.ventas enable trigger ventas_lock_privileged_columns;
  
    raise notice 'Perdonadas % ventas por $%', v_n, v_total;
  end $$;
  
  -- Verificacion: debe dar 154 ventas / 7049600 en el backup, y en Cali ya no
  -- deben quedar clientes con saldo de 155000 o menos.
  select count(*) as ventas_perdonadas, sum(saldo_perdonado) as total_perdonado
  from public.paz_y_salvo_cali_backup;
  
  -- ---------------------------------------------------------------------------
  -- PARA DESHACER (descomentar y correr; vuelve cada venta a como estaba):
  -- alter table public.ventas disable trigger ventas_lock_privileged_columns;
  -- update public.ventas v
  -- set descuento = b.descuento_anterior, estado = b.estado_anterior
  -- from public.paz_y_salvo_cali_backup b
  -- where v.id = b.venta_id;
  -- alter table public.ventas enable trigger ventas_lock_privileged_columns;
