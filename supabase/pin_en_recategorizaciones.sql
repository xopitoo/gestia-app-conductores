-- Las recategorizaciones (Reca) también piden PIN de curso: 1 PIN cada una.
-- Aplica a las 3 sedes CEAPP (Jamundí, Cali, Santander).
update public.productos
set cursos_reales = 1
where sede_id in (
    '47fb5e63-7f43-4abb-8297-db6fe1cf6652', -- CEAPP JAMUNDI
    'eb12864e-6906-4fa9-b65e-4ee915993313', -- CEAPP CALI
    'a4269390-960c-4654-8460-2142df73288f'  -- CEAPP SANTANDER
  )
  and nombre ~* '^reca';

select s.name as sede, p.nombre, p.cursos_reales
from public.productos p join public.sedes s on s.id = p.sede_id
where p.nombre ~* '^reca'
order by s.name, p.nombre;
