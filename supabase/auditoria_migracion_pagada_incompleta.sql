-- Auditoría (solo lectura, no modifica nada): busca ventas de la migración
-- histórica marcadas como 'pagada' donde en realidad no se había cobrado el
-- total — el mismo problema que tenía NATALIA LOPEZ LOZANO (#9255): quedó
-- "Pagada" en la migración aunque solo se le habían cobrado $1.150.000 de
-- $1.550.000, así que nunca apareció en "Clientes en mora" (esa página solo
-- mira estado='abonada').
select
  v.id as venta_id,
  c.nombre_completo,
  c.numero_documento,
  s.name as sede,
  v.concepto,
  v.created_at,
  (v.monto - v.descuento + v.incremento) as total_real,
  coalesce(sum(vp.monto), 0) as total_pagado,
  (v.monto - v.descuento + v.incremento) - coalesce(sum(vp.monto), 0) as saldo_real_pendiente
from public.ventas v
join public.clientes c on c.id = v.cliente_id
join public.sedes s on s.id = v.sede_id
left join public.venta_pagos vp on vp.venta_id = v.id
where v.estado = 'pagada'
  and v.concepto ilike '%migracion historica%'
group by v.id, c.nombre_completo, c.numero_documento, s.name, v.concepto, v.created_at, v.monto, v.descuento, v.incremento
having coalesce(sum(vp.monto), 0) < (v.monto - v.descuento + v.incremento)
order by saldo_real_pendiente desc;
