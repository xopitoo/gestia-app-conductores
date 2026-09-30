-- Bug: registrar_abono_tramitador traía v.id, v.monto, v.descuento, v.sede_id
-- de "ventas" pero después usaba v_venta.incremento (que nunca se había
-- seleccionado) para calcular el saldo pendiente de cada venta — Postgres
-- tiraba "record v_venta has no field incremento" y el abono nunca se
-- registraba. Se agrega v.incremento al select. Mismo cuerpo que en
-- schema.sql, solo para aplicar el fix sin correr todo el archivo de nuevo.
create or replace function public.registrar_abono_tramitador(
  p_tramitador_id uuid,
  p_sede_id uuid,
  p_pagos jsonb
)
returns table (total_cruzado numeric, total_efectivo numeric)
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_tramitador public.tramitadores;
  v_sesion_id uuid;
  v_pago jsonb;
  v_restante numeric(12, 2);
  v_venta record;
  v_pendiente_venta numeric(12, 2);
  v_allocar numeric(12, 2);
  v_pago_id uuid;
  v_total_efectivo numeric(12, 2) := 0;
  v_total_cruzado numeric(12, 2) := 0;
begin
  if p_pagos is null or jsonb_typeof(p_pagos) <> 'array' then
    raise exception 'Formato de pagos inválido';
  end if;

  select * into v_tramitador from public.tramitadores where id = p_tramitador_id;
  if v_tramitador.id is null or v_tramitador.organization_id is distinct from public.current_org_id() then
    raise exception 'Tramitador no encontrado';
  end if;

  select id into v_sesion_id from public.caja_sesiones
    where sede_id = p_sede_id and estado = 'abierta';
  if v_sesion_id is null then
    raise exception 'Debe abrir caja antes de registrar el abono';
  end if;

  -- Paso 1: cruzar automáticamente el saldo a favor existente.
  v_total_cruzado := public.tramitador_cruce_automatico(p_tramitador_id, p_sede_id);

  -- Paso 2: lo que siga pendiente se cubre con efectivo nuevo (p_pagos).
  if jsonb_array_length(p_pagos) > 0 then
    for v_pago in select * from jsonb_array_elements(p_pagos)
    loop
      v_restante := (v_pago ->> 'monto')::numeric;
      if v_restante is null or v_restante <= 0 then
        continue;
      end if;

      for v_venta in
        select v.id, v.monto, v.descuento, v.incremento, v.sede_id
        from public.ventas v
        where v.tramitador_id = p_tramitador_id
          and v.sede_id = p_sede_id
          and v.estado = 'abonada'
        order by v.created_at asc
        for update
      loop
        exit when v_restante <= 0;

        select (v_venta.monto - v_venta.descuento + v_venta.incremento) - coalesce(sum(monto), 0) into v_pendiente_venta
          from public.venta_pagos where venta_id = v_venta.id;
        if v_pendiente_venta <= 0 then
          continue;
        end if;

        v_allocar := least(v_restante, v_pendiente_venta);

        insert into public.venta_pagos (venta_id, organization_id, sede_id, monto, metodo_pago, comprobante_path, created_by)
        values (
          v_venta.id, v_tramitador.organization_id, v_venta.sede_id, v_allocar, v_pago ->> 'metodo_pago',
          nullif(v_pago ->> 'comprobante_path', ''), auth.uid()
        )
        returning id into v_pago_id;

        insert into public.caja_movimientos (
          caja_sesion_id, organization_id, sede_id, tipo, concepto, monto, metodo_pago,
          venta_id, venta_pago_id, tramitador_id, created_by
        )
        values (
          v_sesion_id, v_tramitador.organization_id, p_sede_id, 'ingreso',
          'Abono de ' || v_tramitador.nombre, v_allocar, v_pago ->> 'metodo_pago',
          v_venta.id, v_pago_id, p_tramitador_id, auth.uid()
        );

        update public.ventas
        set estado = case
          when (select coalesce(sum(monto), 0) from public.venta_pagos where venta_id = v_venta.id) >= (v_venta.monto - v_venta.descuento + v_venta.incremento)
          then 'pagada' else 'abonada'
        end
        where id = v_venta.id;

        v_restante := v_restante - v_allocar;
        v_total_efectivo := v_total_efectivo + v_allocar;
      end loop;

      if v_restante > 0 then
        raise exception 'El pago supera lo que debe el tramitador en esta sede';
      end if;
    end loop;
  end if;

  if v_total_cruzado = 0 and v_total_efectivo = 0 then
    raise exception 'Debe registrar al menos un pago';
  end if;

  return query select v_total_cruzado, v_total_efectivo;
end;
$$;
