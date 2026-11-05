-- Esteban Tramite del sur ESCUELA (CEAPP CALI): la venta de Valery Espinosa
-- ($748.000) quedó con precio_tramitador $528.000, lo que le generaba a
-- Esteban un saldo a favor de $212.000. Todo el valor le pertenece a la
-- escuela, así que el precio del tramitador pasa a ser el total de la venta.
-- Queda solo lo que la clienta aún debe ($8.000) como pendiente.
do $$
declare
  n int;
begin
  update public.ventas
  set precio_tramitador = 748000
  where tramitador_id = '98351f15-2807-40e0-9701-9ebe21ba4a0a'
    and monto = 748000
    and precio_tramitador = 528000
    and estado = 'abonada';
  get diagnostics n = row_count;
  if n <> 1 then
    raise exception 'Se esperaba 1 venta y se actualizaron %, se revierte', n;
  end if;
end;
$$;
