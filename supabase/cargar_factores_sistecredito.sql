-- Carga la tabla de factores REAL de Sistecrédito (tomada directamente de
-- capturas de su propio simulador público "Simula tu crédito" para 1-10
-- cuotas sobre $1.000.000, el 2026-10-13) y activa la financiadora.
--
-- Por qué una tabla de factores y no una tasa_mensual: al intentar
-- reverse-engineer una tasa de interés limpia (mismo método que funcionó
-- con Brilla) el costo implícito salía absurdo (hasta ~516% EA en 1 cuota),
-- señal de que el simulador público no calcula con interés+seguro sino con
-- una tabla de cuotas fija por cantidad de cuotas. En vez de inventar una
-- tasa, se cargan los valores reales tal cual los muestra Sistecrédito.
--
-- factor(n) = cuota mensual / monto, para un plazo de n cuotas. La cuota es
-- igual todos los meses (sin desglose de seguro) y el plazo queda limitado
-- a las 10 cuotas que cubre esta tabla.

alter table public.financiadoras add column if not exists tabla_factores jsonb;

update public.financiadoras
set
  tabla_factores = '[
    1.163647, 0.587089, 0.394927, 0.298864, 0.241240,
    0.202836, 0.175415, 0.154859, 0.138877, 0.126100
  ]'::jsonb,
  plazo_max = 10,
  active = true
where nombre = 'Sistecrédito';
