-- Jhonathan David Paz Madroñero (C.R.C. VALORAR, 2026-11-10): venta "Examen 1
-- categoria (tramitador), IMPRESION SENCILLA 1 CATEGORIA" de $310.000, tramitador
-- Fernando Jhonson, $0 pagados. El precio del tramitador (lo que se queda la
-- organizacion) quedo en $150.000 (el precio especial de un examen solo) y por
-- eso el saldo del tramitador solo cargaba $150.000 de esta venta. Debe ser
-- $310.000, como en las otras ventas de examen + impresion de Fernando: el
-- tramitador le debe a la organizacion los $310.000 completos.
--
-- Efecto: la deuda de Fernando Jhonson pasa de -$2.578.000 a -$2.738.000.
-- Solo cambia ventas.precio_tramitador de esa venta. No toca pagos ni caja.
-- Idempotente: si ya esta en 310000 no hace nada.

do $$
declare
  v_venta constant uuid := '1e044021-87a8-4632-b094-180778ba2a19';
  v record;
begin
  select concepto, monto, descuento, incremento, precio_tramitador, tramitador_id, estado
  into v from public.ventas where id = v_venta;
  if v.concepto is null then
    raise exception 'No se encontro la venta';
  end if;
  if v.tramitador_id is distinct from '7819b288-effd-481f-9799-04b93cf44727' then
    raise exception 'La venta no es de Fernando Jhonson: no se toca';
  end if;
  if v.monto - v.descuento + v.incremento <> 310000 then
    raise exception 'El total de la venta no es 310.000 (%): revisar', v.monto - v.descuento + v.incremento;
  end if;
  if v.precio_tramitador = 310000 then
    raise notice 'Ya estaba en 310.000, no se hace nada.';
    return;
  end if;
  if v.precio_tramitador <> 150000 then
    raise exception 'El precio del tramitador es % y no 150.000: revisar antes de tocar', v.precio_tramitador;
  end if;

  update public.ventas set precio_tramitador = 310000 where id = v_venta;
end $$;

-- Verificacion
select concepto, monto, precio_tramitador, estado from public.ventas
where id = '1e044021-87a8-4632-b094-180778ba2a19';
