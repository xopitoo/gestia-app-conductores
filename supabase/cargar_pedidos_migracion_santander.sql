-- Carga 41 pedidos de Santander (S.QUILICHAO en el sistema viejo) que no se migraron: casi todos
-- del 30/9 al 14/10/2026 (cuando Santander aun vendia en el sistema viejo), todos pagados completos
-- (saldo $0). Se cargan como ventas 'pagada' con un ítem, el pago como 'otro' (sin movimiento de
-- caja) y la fecha original. Total cobrado: $34.448.000. Idempotente: si el pedido #N ya existe, se omite.
-- Los clientes que no existan se crean en Santander (tipo CC).
-- NO se cargan 56 pedidos del sistema viejo con total $0 (no se pueden registrar: monto debe ser > 0).
do $$
declare
  c_org  constant uuid := '390f1a9c-bad2-42dc-9562-856775c05ae0';
  c_vend constant uuid := 'c0f9be43-b00b-499f-9df3-5f79182b9f9a'; -- usuario con el que se hizo la migración
  c_sede constant uuid := 'a4269390-960c-4654-8460-2142df73288f'; -- CEAPP SANTANDER
  r record;
  v_cliente uuid;
  v_venta uuid;
  v_concepto text;
begin
  for r in
    select * from (values
      (9585, '1062330880', 'ALIXON FERNANDA PECHENE RIVERA', '3174122952', '2026-09-29 12:16:52', 1170000, 1170000, 0, 'MONO ARNULFO  CARVAJAL MONO', 'inscrito, sin examen medico'),
      (9587, '1062302938', 'ANDREA ESTEFANIA MUÑOZ TULANDE', '3115630781', '2026-09-29 13:07:34', 1170000, 1170000, 0, 'MONO ARNULFO  CARVAJAL MONO', 'inscrito, sin examen medico'),
      (9588, '1067464243', 'YEISON FERNANDO CRUZ YANDE', '3232986863', '2026-09-29 16:20:16', 1520000, 1520000, 0, 'MONO ARNULFO  CARVAJAL MONO', 'no inscrito, sin examen medico'),
      (9589, '34611109', 'CLAUDIA XIMENA MUÑOZ DELGADO', '3156044834', '2026-09-29 16:23:47', 890000, 890000, 0, 'MONO ARNULFO  CARVAJAL MONO', 'no inscrito, sin examen medico'),
      (9591, '1062332366', 'JOHAN ESTEBAN CASSO CASSO', '3128559856', '2026-09-30 14:23:43', 480000, 480000, 0, 'ANGIE LORENA DOSMAN UL', 'inscrito, sin examen medico'),
      (9592, '1062293567', 'ASTRID JHOJANA LOBOA MAQUILON', '3028270012', '2026-09-30 16:09:19', 50000, 50000, 0, 'ANGIE LORENA DOSMAN UL', 'no inscrito, sin examen medico'),
      (9593, '1062327283', 'KELLY JHOANA MARTINEZ RAMOS', '3229759315', '2026-09-30 16:57:10', 2018000, 2018000, 0, 'APP-ESCUELA', 'no inscrito, sin examen medico'),
      (9595, '16897903', 'WILVER EDWIN CALAMBAS TROMPETA', '3174155076', '2026-10-01 12:35:11', 1040000, 1040000, 0, 'MONO ARNULFO  CARVAJAL MONO', 'no inscrito, sin examen medico'),
      (9598, '1062324798', 'MILENA MENZA OSPINA', '3186500138', '2026-10-01 17:32:05', 50000, 50000, 0, 'ESPERANZA  BANGUERO', 'no inscrito, sin examen medico'),
      (9599, '10492915', 'CARLOS ALBERTO MELENGE IBARRA', '3046124601', '2026-10-02 10:31:22', 710000, 710000, 0, 'ALEXANDRA ZAMBRANO', 'no inscrito, sin examen medico'),
      (9600, '34610238', 'CLARA INES TROCHEZ PATIÑO', '3122315485', '2026-10-02 10:33:18', 1420000, 1420000, 0, 'MONO ARNULFO  CARVAJAL MONO', 'no inscrito, sin examen medico'),
      (9602, '1070808353', 'CHARY XIMENA GUERRERO BRAVO', '3216182471', '2026-10-02 12:16:11', 1320000, 1320000, 0, 'ESPERANZA  BANGUERO', 'no inscrito, sin examen medico'),
      (9604, '1089483274', 'JESUS BIRLEY OJEDA MUÑOZ', '3214956377', '2026-10-05 09:50:18', 480000, 480000, 0, 'MONO ARNULFO  CARVAJAL MONO', 'no inscrito, sin examen medico'),
      (9607, '1002876317', 'JOSE ALEXANDER SANCHEZ LEGARDA', '3102540033', '2026-10-05 11:24:34', 480000, 480000, 0, 'YESENIA  CUMBAL LOPEZ', 'no inscrito, sin examen medico'),
      (9610, '1067522745', 'DIANA PATRICIA PAVI ASCUE', '3137393992', '2026-10-05 14:22:40', 1370000, 1370000, 0, 'APP-ESCUELA', 'no inscrito, sin examen medico'),
      (9612, '1112400532', 'DEIBY DANIEL GARCIA ACOSTA', '3114519436', '2026-10-05 16:37:55', 1170000, 1170000, 0, 'MONO ARNULFO  CARVAJAL MONO', 'no inscrito, sin examen medico'),
      (9613, '1109542005', 'JOSE DANIEL BANGUERO HERRERA', '3168376515', '2026-10-05 16:40:16', 1370000, 1370000, 0, 'KATHERIN PAMELA HERNANDEZ LOPEZ', 'no inscrito, sin examen medico'),
      (9614, '1062303673', 'CLARA MARCELA CASTILLO MINA', '3145630728', '2026-10-05 16:43:21', 50000, 50000, 0, 'ESPERANZA  BANGUERO', 'no inscrito, sin examen medico'),
      (9615, '1087749401', 'ANDERSON YOVANI LIPEZ SOLARTE', '3117069671', '2026-10-06 15:10:28', 1410000, 1410000, 0, 'DIANA MARCELA VARONA TROCHEZ', 'no inscrito, sin examen medico'),
      (9616, '1088944474', 'LUIS CARLOS GONZALEZ ADRADA', '3184958694', '2026-10-06 15:12:24', 1370000, 1370000, 0, 'ESPERANZA  BANGUERO', 'no inscrito, sin examen medico'),
      (9617, '1062284266', 'JUAN CAMILO CAICEDO FORERO', '3104965423', '2026-10-06 15:15:14', 1170000, 1170000, 0, 'ESPERANZA  BANGUERO', 'no inscrito, sin examen medico'),
      (9618, '1061530060', 'DIANA PATRICIA IPIA OTERO', '3216394527', '2026-10-06 15:16:54', 1170000, 1170000, 0, 'MONO ARNULFO  CARVAJAL MONO', 'no inscrito, sin examen medico'),
      (9619, '76140565', 'JAVIER ANTONIO TOBAR ARARAT', '3126180235', '2026-10-07 14:33:20', 50000, 50000, 0, 'ESPERANZA  BANGUERO', 'inscrito, sin examen medico'),
      (9621, '1002946568', 'GUSTAVO ADOLFO CASSO CASSO', '3235859351', '2026-10-07 16:36:59', 50000, 50000, 0, 'ESPERANZA  BANGUERO', 'no inscrito, sin examen medico'),
      (9623, '1006335033', 'CARLOS ALBERTO CARDONA JARAMILLO', '3216650843', '2026-10-08 10:35:17', 50000, 50000, 0, 'APP-ESCUELA', 'no inscrito, sin examen medico'),
      (9624, '1061433000', 'YULIANA PAOLA PAZ VASQUEZ', '3174201263', '2026-10-08 15:54:15', 1370000, 1370000, 0, 'DANY ALEJANDRO GONZALEZ GUTIERREZ', 'no inscrito, sin examen medico'),
      (9625, '76216191', 'JESUS HERNAN CERON GOMEZ', '3175877493', '2026-10-09 10:40:11', 480000, 480000, 0, 'ESPERANZA  BANGUERO', 'no inscrito, sin examen medico'),
      (9626, '1002793845', 'DIEGO HERNAN PASCUE TUMBO', '3146909032', '2026-10-09 11:44:18', 1370000, 1370000, 0, 'DANY ALEJANDRO GONZALEZ GUTIERREZ', 'no inscrito, sin examen medico'),
      (9627, '4785280', 'GERARDO ESCUE ESCUE', '3137777492', '2026-10-09 12:53:27', 110000, 110000, 0, null::text, 'no inscrito, sin examen medico'),
      (9629, '1060362292', 'YULIANA ANDREA GONZALEZ LUCUMI', '3218393456', '2026-10-09 16:53:54', 1170000, 1170000, 0, 'MONO ARNULFO  CARVAJAL MONO', 'no inscrito, sin examen medico'),
      (9632, '48656299', 'CRISTINA ESPINOZA PALACIOS', '3235212680', '2026-10-10 13:23:15', 50000, 50000, 0, 'ESPERANZA  BANGUERO', 'no inscrito, sin examen medico'),
      (9635, '1065442430', 'YILVER ADRIAN REYES CORDOBA', '3113248191', '2026-10-13 09:50:51', 1370000, 1370000, 0, 'KATHERIN PAMELA HERNANDEZ LOPEZ', 'inscrito, sin examen medico'),
      (9636, '1087418782', 'DIEGO ARMANDO MELO MORA', '3218804923', '2026-10-13 10:23:22', 610000, 610000, 0, 'APP-ESCUELA', 'inscrito, sin examen medico'),
      (9637, '1004624402', 'JEAN FRANCO CUASQUEN MORA', '3155389901', '2026-10-13 10:27:50', 610000, 610000, 0, 'APP-ESCUELA', 'inscrito, sin examen medico'),
      (9638, '1065443062', 'SANTIAGO MANZANO VIAFARA', '3188871421', '2026-10-13 10:37:52', 50000, 50000, 0, 'ANGIE LORENA DOSMAN UL', 'inscrito, sin examen medico'),
      (9639, '1002884441', 'JHON EDINSON JIMENEZ MORENO', '3126462146', '2026-10-13 11:11:44', 480000, 480000, 0, 'MONO ARNULFO  CARVAJAL MONO', 'no inscrito, sin examen medico'),
      (9640, '1062278693', 'JOSE DANY VALENCIA', '3226425767', '2026-10-13 12:00:20', 1570000, 1570000, 0, 'MONO ARNULFO  CARVAJAL MONO', 'no inscrito, sin examen medico'),
      (9642, '1065443062', 'SANTIAGO MANZANO VIAFARA', '3188871421', '2026-10-13 14:53:21', 710000, 710000, 0, 'ESPERANZA  BANGUERO', 'no inscrito, sin examen medico'),
      (9643, '1193098607', 'YAMIT FERNEY GUETOTO BOTOTO', '3234820844', '2026-10-13 14:57:39', 50000, 50000, 0, 'APP-ESCUELA', 'no inscrito, sin examen medico'),
      (9645, '1062285999', 'CHRISTIAN DAVID SERNA VILLAQUIRAN', '3136444545', '2026-10-13 15:21:50', 1370000, 1370000, 0, 'MONO ARNULFO  CARVAJAL MONO', 'no inscrito, sin examen medico'),
      (9650, '1038106375', 'JUAN DAVID BARRIENTOS', '3216276945', '2026-10-14 13:42:50', 1050000, 1050000, 0, 'APP-ESCUELA', 'no inscrito, sin examen medico')
    ) as t(pedido, doc, nombre, tel, fecha, total, pagado, descuento, referido, detalle)
  loop
    v_concepto := 'Tramite RUNT (migracion historica #' || r.pedido || ')';
    if exists (select 1 from public.ventas where concepto = v_concepto) then
      raise notice 'Pedido #% ya existe, se omite', r.pedido;
      continue;
    end if;

    select id into v_cliente from public.clientes
      where organization_id = c_org and numero_documento = r.doc
      order by (sede_id = c_sede) desc limit 1;
    if v_cliente is null then
      insert into public.clientes (organization_id, sede_id, tipo_documento, numero_documento, nombre_completo, telefono_pais, telefono, runt)
      values (c_org, c_sede, 'CC', r.doc, r.nombre, '+57', r.tel, r.detalle like 'inscrito%')
      returning id into v_cliente;
    end if;

    insert into public.ventas (organization_id, sede_id, cliente_id, concepto, monto, estado, vendedor_id, created_by, created_at, referido_nombre, descuento)
    values (c_org, c_sede, v_cliente, v_concepto, r.total, 'pagada', c_vend, c_vend, r.fecha::timestamptz, r.referido, r.descuento)
    returning id into v_venta;

    insert into public.venta_items (venta_id, organization_id, sede_id, producto_id, nombre, precio, created_at)
    values (v_venta, c_org, c_sede, null, 'Tramite RUNT (' || r.detalle || ') (migracion historica #' || r.pedido || ')', r.total, r.fecha::timestamptz);

    if r.pagado > 0 then
      insert into public.venta_pagos (venta_id, organization_id, sede_id, monto, metodo_pago, created_by, created_at)
      values (v_venta, c_org, c_sede, r.pagado, 'otro', c_vend, r.fecha::timestamptz);
    end if;
  end loop;
end;
$$;
