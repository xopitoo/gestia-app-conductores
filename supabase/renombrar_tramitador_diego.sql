-- Corrige el nombre del tramitador "DIEGO MUÑOZ" -> "DIEGO TULCAN".
-- Filtra por id para no tocar ningún otro registro por error.

update public.tramitadores
set nombre = 'DIEGO TULCAN'
where id = '3aed4286-6d84-4d64-a617-8de4635272af'
  and nombre = 'DIEGO MUÑOZ';
