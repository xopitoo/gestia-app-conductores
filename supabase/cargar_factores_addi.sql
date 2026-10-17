-- Carga la tabla de factores de Addi (cuota / monto por cantidad de cuotas)
-- a partir de una captura real del flujo de pago de Addi con un monto de
-- $55.000 (2 a 6 cuotas) y la activa en el simulador. Igual que con
-- Sistecrédito: el costo no calza con una tasa de interés limpia (la tasa
-- implícita baja de 11,5% a 6,4% mensual según las cuotas, señal de un
-- cargo fijo + algo proporcional al plazo), así que se usan los factores
-- reales en vez de inventar una tasa. Posición 1 = 1 cuota (Addi no la
-- ofrece, queda null).
--
-- OJO: salió de UN solo monto. Si Addi cobra una parte fija (no
-- proporcional al monto), las cuotas de montos muy distintos a $55.000 van
-- a desviarse — conviene contrastar con una captura de otro monto.

alter table public.financiadoras add column if not exists tabla_factores jsonb;

update public.financiadoras
set
  tabla_factores = '[null, 0.587564, 0.396945, 0.301527, 0.244345, 0.206236]'::jsonb,
  plazo_max = 6,
  active = true
where nombre = 'Addi';
