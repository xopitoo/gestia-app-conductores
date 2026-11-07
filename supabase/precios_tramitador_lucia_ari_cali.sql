-- Precios especiales de Esteban (CEAPP Cali) copiados a Lucia tramitadora Escuela y ARI (CEAPP Cali).
-- Lucia ya tenia A2, B1, Combo A2+B1 y A2+C1 con estos mismos valores y una Reca ($705.000): no se tocan.
-- Su C1 esta en $980.000 (Esteban: $1.245.000). Si quieres igualarlo, descomenta el bloque del final.

insert into public.tramitador_precios (tramitador_id, producto_id, organization_id, precio_especial)
select t.id, p.producto_id, p.organization_id, p.precio_especial
from public.tramitador_precios p
cross join (values
  ('09c53b31-d41f-4d81-81f1-7f2302c034e3'::uuid),  -- ARI
  ('8fdd8f4c-3397-48e2-9deb-5af919aa1603'::uuid)   -- Lucia tramitadora Escuela
) as t(id)
where p.tramitador_id = '98351f15-2807-40e0-9701-9ebe21ba4a0a'
on conflict (tramitador_id, producto_id) do nothing;

-- update public.tramitador_precios
--    set precio_especial = 1245000, updated_at = now()
--  where tramitador_id = '8fdd8f4c-3397-48e2-9deb-5af919aa1603'
--    and producto_id = '16404108-f751-4ab9-87cf-d325eb808e4b';
