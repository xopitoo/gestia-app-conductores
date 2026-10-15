-- Corrige 3 funciones con el mismo bug de autorización ya encontrado y
-- corregido antes en agregar_item_venta/corregir_precio_tramitador_venta:
-- `current_role() <> 'admin'` (o `not in (...)`) evalúa a NULL (no a TRUE)
-- cuando no hay sesión real — y en PL/pgSQL un `IF NULL THEN` no entra, así
-- que la excepción nunca se lanza y el chequeo queda salteado en silencio.
-- Fix: `if current_role() is null or current_role() <> 'admin' then ...`.
--
-- Impacto real de cada una (ninguna explotable hoy desde afuera, pero
-- todas dependían de una segunda barrera incidental en vez de este chequeo
-- — se corrige por las dudas / consistencia):
-- - cruzar_saldo_tramitador y eliminar_tramitador son security INVOKER: el
--   INSERT/UPDATE/DELETE de adentro sigue filtrado por las policies RLS
--   normales (current_role() = 'admin', NULL-safe), así que un llamado sin
--   sesión real igual queda bloqueado ahí — pero solo por eso.
-- - registrar_certificado_runt es security DEFINER (sin RLS de respaldo):
--   un llamado sin sesión real queda bloqueado porque current_org_id()
--   también da NULL y eso sí rompe el chequeo de organización de abajo —
--   pero de nuevo, es casualidad, no la barrera pensada para esto.

-- =========================================================
create or replace function public.cruzar_saldo_tramitador(
  p_venta_id uuid,
  p_monto numeric
)
returns public.ventas
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_venta public.ventas;
  v_saldo_pendiente numeric(12, 2);
  v_saldo_tramitador numeric(12, 2);
  v_cliente_nombre text;
  v_pago_id uuid;
begin
  if public.current_role() is null or public.current_role() <> 'admin' then
    raise exception 'Solo un administrador puede cruzar el saldo de un tramitador';
  end if;

  if p_monto is null or p_monto <= 0 then
    raise exception 'El monto a cruzar debe ser mayor a cero';
  end if;

  select * into v_venta from public.ventas where id = p_venta_id for update;
  if v_venta.id is null or v_venta.organization_id is distinct from public.current_org_id() then
    raise exception 'Venta no encontrada';
  end if;
  if v_venta.tramitador_id is null then
    raise exception 'Esta venta no tiene un tramitador asociado';
  end if;
  if v_venta.estado = 'anulada' then
    raise exception 'La venta está anulada';
  end if;
  if v_venta.estado = 'pagada' then
    raise exception 'La venta ya está paga por completo';
  end if;

  select (v_venta.monto - v_venta.descuento + v_venta.incremento) - coalesce(sum(monto), 0) into v_saldo_pendiente
    from public.venta_pagos where venta_id = v_venta.id;
  if p_monto > v_saldo_pendiente then
    raise exception 'El monto supera el saldo pendiente de la venta';
  end if;

  -- Mismo cálculo que tramitadores_saldo (no uno propio aparte que pueda
  -- divergir) — ver esa función para el criterio completo.
  select coalesce(saldo_a_favor, 0) into v_saldo_tramitador
  from public.tramitadores_saldo(null)
  where id = v_venta.tramitador_id;
  v_saldo_tramitador := coalesce(v_saldo_tramitador, 0);

  if p_monto > v_saldo_tramitador then
    raise exception 'El tramitador no tiene suficiente saldo a favor para cruzar ese monto';
  end if;

  select nombre_completo into v_cliente_nombre from public.clientes where id = v_venta.cliente_id;

  insert into public.venta_pagos (venta_id, organization_id, sede_id, monto, metodo_pago, created_by)
  values (v_venta.id, v_venta.organization_id, v_venta.sede_id, p_monto, 'cruce_tramitador', auth.uid())
  returning id into v_pago_id;

  insert into public.tramitador_pagos (tramitador_id, organization_id, sede_id, monto, nota, venta_pago_id, created_by)
  values (
    v_venta.tramitador_id, v_venta.organization_id, v_venta.sede_id, p_monto,
    'Cruce con venta de ' || coalesce(v_cliente_nombre, 'cliente'), v_pago_id, auth.uid()
  );

  update public.ventas
  set estado = case
    when (select coalesce(sum(monto), 0) from public.venta_pagos where venta_id = v_venta.id) >= (v_venta.monto - v_venta.descuento + v_venta.incremento)
    then 'pagada' else 'abonada'
  end
  where id = v_venta.id
  returning * into v_venta;

  return v_venta;
end;
$$;

-- =========================================================
create or replace function public.eliminar_tramitador(
  p_tramitador_id uuid,
  p_pin text
)
returns void
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_ventas_count int;
  v_pagos_count int;
begin
  if public.current_role() is null or public.current_role() <> 'admin' then
    raise exception 'Solo un administrador puede eliminar tramitadores';
  end if;
  if not public.verify_org_pin(p_pin) then
    raise exception 'PIN de autorización incorrecto';
  end if;

  select count(*) into v_ventas_count from public.ventas where tramitador_id = p_tramitador_id;
  if v_ventas_count > 0 then
    raise exception 'Este tramitador ya tiene % ventas registradas — desactivalo en vez de eliminarlo', v_ventas_count;
  end if;

  select count(*) into v_pagos_count from public.tramitador_pagos where tramitador_id = p_tramitador_id;
  if v_pagos_count > 0 then
    raise exception 'Este tramitador ya tiene pagos de comisión registrados — desactivalo en vez de eliminarlo';
  end if;

  delete from public.tramitador_precios where tramitador_id = p_tramitador_id;
  delete from public.tramitadores where id = p_tramitador_id;
end;
$$;

-- =========================================================
-- REGISTRAR_CERTIFICADO_RUNT: registra que el certificado RUNT de una venta
-- ya se subió (a `certificado_path`, en el bucket certificados-runt — el
-- archivo en sí lo sube el cliente directo a Storage, esta función solo dev
-- deja la constancia en la fila). Lo puede hacer un admin (cualquier sede de
-- su organización) o un recepcionista (solo su propia sede) — a diferencia
-- de aplicar_descuento_venta, este NO es admin-only: el recepcionista es
-- quien normalmente hace el trámite y tiene el PDF/foto a mano. Igual que
-- antes, solo si la venta ya está paga por completo, y de una sola vía (no
-- hay forma de "quitar" el certificado desde la UI).
--
-- security definer a propósito: un recepcionista no tiene ninguna policy de
-- UPDATE sobre una venta 'pagada' (solo sobre una 'abonada', para completar
-- su propio abono) — este chequeo de arriba (rol + sede + saldo) reemplaza
-- esa policy para este caso puntual. set_config dentro de la función deja
-- una marca de una sola transacción que el trigger de abajo exige para
-- dejar pasar el cambio a estas columnas puntuales.
-- =========================================================
create or replace function public.registrar_certificado_runt(
  p_venta_id uuid,
  p_certificado_path text
)
returns public.ventas
language plpgsql
security definer
set search_path = public
as $$
declare
  v_venta public.ventas;
  v_pagado numeric(12, 2);
begin
  if public.current_role() is null or public.current_role() not in ('admin', 'recepcionista') then
    raise exception 'No autorizado';
  end if;
  if p_certificado_path is null or length(trim(p_certificado_path)) = 0 then
    raise exception 'Falta el archivo del certificado';
  end if;

  select * into v_venta from public.ventas where id = p_venta_id for update;
  if v_venta.id is null then
    raise exception 'Venta no encontrada';
  end if;
  if v_venta.organization_id is distinct from public.current_org_id() then
    raise exception 'No autorizado';
  end if;
  if public.current_role() = 'recepcionista' and v_venta.sede_id is distinct from public.current_sede_id() then
    raise exception 'No autorizado para esta sede';
  end if;
  if v_venta.estado = 'anulada' then
    raise exception 'La venta está anulada';
  end if;
  if v_venta.certificado then
    raise exception 'Esta venta ya tiene el certificado RUNT subido';
  end if;

  select coalesce(sum(monto), 0) into v_pagado from public.venta_pagos where venta_id = p_venta_id;
  if v_pagado < (v_venta.monto - v_venta.descuento + v_venta.incremento) then
    raise exception 'No se puede subir el certificado: todavía queda saldo pendiente por cobrar';
  end if;

  perform set_config('app.allow_certificado_update', 'true', true);

  update public.ventas
  set certificado = true,
      certificado_at = now(),
      certificado_by = auth.uid(),
      certificado_path = p_certificado_path
  where id = p_venta_id
  returning * into v_venta;

  return v_venta;
end;
$$;
