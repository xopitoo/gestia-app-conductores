-- Carga 7 pedidos del sistema viejo (lista de ingresos del 24/10) que tenían saldo pendiente y
-- no se habían migrado a Gestia. Mismo formato que la migración histórica: una venta
-- 'abonada' con un solo ítem, el abono previo como pago 'otro' (sin movimiento de caja) y
-- la fecha del pedido original. Es idempotente: si el pedido #N ya existe, no lo vuelve a crear.
-- Saldo total que se carga: $2.403.000.
--   #9659 Anderson Duarte (Jamundí)        total 1.708.000  abonó 1.000.000  debe   708.000
--   #9651 Leidy Rosero (Jamundí)           total 1.908.000  abonó 1.200.000  debe   708.000
--   #9455 Luz Anyi Quisaboni (Cali)        total   790.000  abonó   400.000  debe   390.000
--   #9582 Fernando González Daza (Cali)    total   411.000  abonó   402.000  debe     9.000  (cliente nuevo)
--   #9581 Jhonn Cifuentes (Cali)           total   210.000  abonó   207.000  debe     3.000  (cliente nuevo)
--   #7016 Andrés Jaramillo (C.R.C. Valorar) total  215.000  abonó         0  debe   215.000
--   #6841 Jefry Castillo (C.R.C. Valorar)   total  370.000  abonó         0  debe   370.000
do $$
declare
  c_org  constant uuid := '390f1a9c-bad2-42dc-9562-856775c05ae0';
  c_vend constant uuid := 'c0f9be43-b00b-499f-9df3-5f79182b9f9a'; -- usuario con el que se hizo la migración
  s_jam  constant uuid := '47fb5e63-7f43-4abb-8297-db6fe1cf6652';
  s_cali constant uuid := 'eb12864e-6906-4fa9-b65e-4ee915993313';
  s_val  constant uuid := 'c396127a-f17d-413a-b268-8a16e566460d';
  r record;
  v_cliente uuid;
  v_venta uuid;
  v_concepto text;
begin
  for r in
    select * from (values
      (9659, s_jam,  '1029141730', 'ANDERSON ARMANDO DUARTE VARGAS',        '3205018325', 1708000, 1000000, '2026-10-22 10:16:04', null::text,     'no inscrito, sin examen medico'),
      (9651, s_jam,  '1112484786', 'LEIDY NATALIA ROSERO FLOR',             '3184288874', 1908000, 1200000, '2026-10-14 14:32:38', null,           'no inscrito, sin examen medico'),
      (9455, s_cali, '1007600362', 'LUZ ANYI VANESA QUISABONI ROJAS',       '3142391423',  790000,  400000, '2026-09-11 12:07:29', null,           'no inscrito, sin examen medico'),
      (9582, s_cali, '16608522',   'FERNANDO GONZALEZ DAZA',                '3104288977',  411000,  402000, '2026-09-29 10:02:40', null,           'no inscrito, sin examen medico'),
      (9581, s_cali, '94064677',   'JHONN ALEXANDER CIFUENTES HURTADO',     '3218543853',  210000,  207000, '2026-09-29 09:50:48', null,           'no inscrito, sin examen medico'),
      (7016, s_val,  '1144225552', 'ANDRES RODOLFO JARAMILLO ORTIZ',        '305255225',   215000,       0, '2025-10-23 17:34:24', null,           'inscrito, con examen medico'),
      (6841, s_val,  '1007151349', 'JEFRY CASTILLO MORENO',                 '3113334152',  370000,       0, '2025-09-30 18:38:10', 'CEAPP CALI', 'inscrito, con examen medico')
    ) as t(pedido, sede, doc, nombre, tel, total, abono, fecha, referido, detalle)
  loop
    v_concepto := 'Tramite RUNT (migracion historica #' || r.pedido || ')';
    if exists (select 1 from public.ventas where concepto = v_concepto) then
      raise notice 'Pedido #% ya existe, se omite', r.pedido;
      continue;
    end if;

    -- cliente: el que ya existe por documento, o uno nuevo en la sede del pedido
    select id into v_cliente from public.clientes
      where organization_id = c_org and numero_documento = r.doc
      order by (sede_id = r.sede) desc limit 1;
    if v_cliente is null then
      insert into public.clientes (organization_id, sede_id, tipo_documento, numero_documento, nombre_completo, telefono_pais, telefono, runt)
      values (c_org, r.sede, 'CC', r.doc, r.nombre, '+57', r.tel, false)
      returning id into v_cliente;
    end if;

    insert into public.ventas (organization_id, sede_id, cliente_id, concepto, monto, estado, vendedor_id, created_by, created_at, referido_nombre, descuento)
    values (c_org, r.sede, v_cliente, v_concepto, r.total, 'abonada', c_vend, c_vend, r.fecha::timestamptz, r.referido, 0)
    returning id into v_venta;

    insert into public.venta_items (venta_id, organization_id, sede_id, producto_id, nombre, precio, created_at)
    values (v_venta, c_org, r.sede, null, 'Tramite RUNT (' || r.detalle || ') (migracion historica #' || r.pedido || ')', r.total, r.fecha::timestamptz);

    if r.abono > 0 then
      insert into public.venta_pagos (venta_id, organization_id, sede_id, monto, metodo_pago, created_by, created_at)
      values (v_venta, c_org, r.sede, r.abono, 'otro', c_vend, r.fecha::timestamptz);
    end if;
  end loop;
end;
$$;
