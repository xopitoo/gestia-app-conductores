-- conductores-pos — esquema inicial multi-tenant
-- Ejecutar en el SQL Editor del proyecto Supabase de conductores-pos (proyecto
-- propio, separado del de CEAPP Aula Virtual — no comparten base de datos).

create extension if not exists "pgcrypto";

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- =========================================================
-- ORGANIZATIONS (una fila por escuela de conducción cliente)
-- =========================================================
create table if not exists public.organizations (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  slug text not null unique,
  active boolean not null default true,
  -- Hash (pgcrypto/bcrypt) del PIN de autorización para ventas con menos
  -- del 50% de pago inicial. null = todavía no lo configuró el admin, y
  -- entonces ninguna venta por debajo del mínimo se puede crear. Nunca se
  -- expone en texto plano ni se lee directo — ver verify_org_pin().
  pin_hash text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
-- columna agregada después del v1 inicial: no rompe instalaciones ya
-- corridas porque create table if not exists no toca tablas existentes.
alter table public.organizations add column if not exists pin_hash text;

drop trigger if exists organizations_set_updated_at on public.organizations;
create trigger organizations_set_updated_at
  before update on public.organizations
  for each row execute function public.set_updated_at();

-- =========================================================
-- SEDES
-- =========================================================
create table if not exists public.sedes (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  name text not null,
  address text,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (organization_id, name)
);
create index if not exists sedes_organization_id_idx on public.sedes (organization_id);

drop trigger if exists sedes_set_updated_at on public.sedes;
create trigger sedes_set_updated_at
  before update on public.sedes
  for each row execute function public.set_updated_at();

-- =========================================================
-- PROFILES (extiende auth.users)
-- =========================================================
create table if not exists public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  organization_id uuid references public.organizations (id) on delete cascade,
  sede_id uuid references public.sedes (id) on delete set null,
  role text not null check (role in ('platform_owner', 'admin', 'recepcionista')),
  full_name text not null,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  -- sede_id de un 'recepcionista' puede quedar en null temporalmente: el
  -- usuario la autoasigna la primera vez que entra (ver /elegir-sede),
  -- no hace falta que el admin la fije al crear la cuenta.
  constraint profiles_role_scope_chk check (
    (role = 'platform_owner' and organization_id is null and sede_id is null)
    or (role = 'admin' and organization_id is not null)
    or (role = 'recepcionista' and organization_id is not null)
  )
);
create index if not exists profiles_organization_id_idx on public.profiles (organization_id);
create index if not exists profiles_sede_id_idx on public.profiles (sede_id);

-- =========================================================
-- CLIENTES
-- =========================================================
create table if not exists public.clientes (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  sede_id uuid not null references public.sedes (id) on delete restrict,
  tipo_documento text not null check (tipo_documento in ('CC', 'TI', 'CE', 'PPT', 'PASAPORTE', 'NIT')),
  numero_documento text not null,
  nombre_completo text not null,
  sexo text check (sexo in ('M', 'F', 'OTRO')),
  fecha_nacimiento date,
  telefono_pais text not null default '+57',
  telefono text,
  correo_electronico text,
  -- Placeholder para biométricos (fase 2, sin integración de hardware todavía).
  -- La UI muestra "{fingerprints_enrolled}/2" igual que el producto de referencia.
  fingerprints_enrolled int not null default 0 check (fingerprints_enrolled >= 0),
  -- Si el cliente ya está inscrito en el RUNT (Registro Único Nacional de
  -- Tránsito). Lo fija el recepcionista al crear el cliente; luego, como
  -- cualquier otro campo de clientes, solo el admin puede corregirlo.
  runt boolean not null default false,
  active boolean not null default true,
  created_by uuid references public.profiles (id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (organization_id, tipo_documento, numero_documento)
);
alter table public.clientes add column if not exists runt boolean not null default false;
create index if not exists clientes_organization_id_idx on public.clientes (organization_id);
create index if not exists clientes_sede_id_idx on public.clientes (sede_id);

drop trigger if exists clientes_set_updated_at on public.clientes;
create trigger clientes_set_updated_at
  before update on public.clientes
  for each row execute function public.set_updated_at();

-- =========================================================
-- PRODUCTOS (catálogo compartido por toda la organización — no por
-- sede: los mismos cursos/trámites se ofrecen en cualquier sucursal)
-- =========================================================
create table if not exists public.productos (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  nombre text not null,
  descripcion text,
  precio numeric(12, 2) not null check (precio >= 0),
  categoria text check (categoria in ('multiple', 'individual')),
  active boolean not null default true,
  created_by uuid references public.profiles (id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists productos_organization_id_idx on public.productos (organization_id);

drop trigger if exists productos_set_updated_at on public.productos;
create trigger productos_set_updated_at
  before update on public.productos
  for each row execute function public.set_updated_at();

-- =========================================================
-- VENTAS (encabezado de la orden — total y estado de cobro). `concepto` y
-- `monto` se derivan de sus venta_items (varios productos por venta); los
-- métodos y montos realmente pagados viven en venta_pagos, porque una
-- venta puede cobrarse en más de un método y/o en más de un momento
-- (abonos) — ver el README para el detalle de este modelo.
-- =========================================================
create table if not exists public.ventas (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  sede_id uuid not null references public.sedes (id) on delete restrict,
  cliente_id uuid not null references public.clientes (id) on delete restrict,
  concepto text not null,
  monto numeric(12, 2) not null check (monto > 0),
  estado text not null default 'pagada' check (estado in ('pagada', 'abonada', 'anulada')),
  vendedor_id uuid not null references public.profiles (id),
  -- Persona externa (no es un usuario del sistema) que refirió al cliente,
  -- para comisión/seguimiento — texto libre, opcional.
  referido_nombre text,
  -- Descuento en pesos ya aplicado sobre `monto` (bruto, suma de
  -- venta_items). Lo que realmente hay que cobrar/queda pendiente siempre
  -- es `monto - descuento`. Se puede fijar al crear la venta (recepcionista
  -- o admin) o después, desde /admin/mora (solo admin) — ver
  -- registrar_venta / aplicar_descuento_venta.
  descuento numeric(12, 2) not null default 0 check (descuento >= 0),
  -- Certificado RUNT: para una auditoría, toda venta ya paga por completo
  -- debe tener el certificado subido — lo sube el recepcionista (de su
  -- propia sede) o un admin, nunca antes de que el saldo llegue a cero. Es
  -- un hecho de una sola vía, no se "des-sube" desde la UI — ver
  -- registrar_certificado_runt(). El archivo en sí vive en el bucket de
  -- Storage `certificados-runt`, `certificado_path` es su ruta ahí.
  certificado boolean not null default false,
  certificado_at timestamptz,
  certificado_by uuid references public.profiles (id),
  certificado_path text,
  created_by uuid not null references public.profiles (id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists ventas_organization_id_idx on public.ventas (organization_id);
create index if not exists ventas_sede_id_idx on public.ventas (sede_id);
create index if not exists ventas_created_at_idx on public.ventas (created_at);
create index if not exists ventas_vendedor_id_idx on public.ventas (vendedor_id);
alter table public.ventas add column if not exists referido_nombre text;
alter table public.ventas add column if not exists descuento numeric(12, 2) not null default 0;
alter table public.ventas drop constraint if exists ventas_descuento_chk;
alter table public.ventas add constraint ventas_descuento_chk check (descuento >= 0);
alter table public.ventas add column if not exists certificado boolean not null default false;
alter table public.ventas add column if not exists certificado_at timestamptz;
alter table public.ventas add column if not exists certificado_by uuid references public.profiles (id);
alter table public.ventas add column if not exists certificado_path text;

-- Bucket privado para los certificados RUNT subidos (nunca público — se
-- accede siempre con signed URLs de corta duración, generadas en el
-- servidor). Las políticas de storage.objects de abajo son el único modo de
-- leer/escribir ahí.
insert into storage.buckets (id, name, public)
values ('certificados-runt', 'certificados-runt', false)
on conflict (id) do nothing;
-- `categoria` y `producto_id` vivían acá en la v1 de un solo producto por
-- venta; ahora que una venta puede tener varios productos, esos datos
-- viven por ítem en venta_items. `metodo_pago` vivía acá en la v1 de un
-- solo método por venta; ahora vive por pago en venta_pagos. Se quitan si
-- quedaron de una instalación previa (no rompe nada correr esto de nuevo).
alter table public.ventas drop column if exists categoria;
alter table public.ventas drop column if exists producto_id;
alter table public.ventas drop column if exists metodo_pago;
alter table public.ventas drop constraint if exists ventas_estado_check;
alter table public.ventas add constraint ventas_estado_check check (estado in ('pagada', 'abonada', 'anulada'));

drop trigger if exists ventas_set_updated_at on public.ventas;
create trigger ventas_set_updated_at
  before update on public.ventas
  for each row execute function public.set_updated_at();

-- =========================================================
-- VENTA_ITEMS (línea por producto dentro de una venta — inmutable, igual
-- que caja_movimientos: se crean todas juntas con registrar_venta, no se
-- editan después)
-- =========================================================
create table if not exists public.venta_items (
  id uuid primary key default gen_random_uuid(),
  venta_id uuid not null references public.ventas (id) on delete cascade,
  -- organization_id / sede_id desnormalizados a propósito, mismo motivo
  -- que en caja_movimientos: cada policy de RLS filtra directo, sin join.
  organization_id uuid not null references public.organizations (id) on delete cascade,
  sede_id uuid not null references public.sedes (id) on delete restrict,
  producto_id uuid references public.productos (id) on delete set null,
  nombre text not null,
  precio numeric(12, 2) not null check (precio >= 0),
  created_at timestamptz not null default now()
);
create index if not exists venta_items_venta_id_idx on public.venta_items (venta_id);
create index if not exists venta_items_organization_id_idx on public.venta_items (organization_id);
create index if not exists venta_items_sede_id_idx on public.venta_items (sede_id);

-- =========================================================
-- VENTA_PAGOS (un registro por método usado en cada momento de pago —
-- inmutable, igual que venta_items/caja_movimientos. Varias filas con el
-- mismo venta_id = abonos sucesivos; varias filas del mismo momento =
-- pago dividido en métodos, ej. mitad efectivo mitad tarjeta)
-- =========================================================
create table if not exists public.venta_pagos (
  id uuid primary key default gen_random_uuid(),
  venta_id uuid not null references public.ventas (id) on delete cascade,
  organization_id uuid not null references public.organizations (id) on delete cascade,
  sede_id uuid not null references public.sedes (id) on delete restrict,
  monto numeric(12, 2) not null check (monto > 0),
  metodo_pago text not null check (metodo_pago in ('efectivo', 'transferencia', 'tarjeta', 'nequi', 'addi', 'credito', 'otro')),
  created_by uuid not null references public.profiles (id),
  created_at timestamptz not null default now()
);
alter table public.venta_pagos drop constraint if exists venta_pagos_metodo_pago_check;
alter table public.venta_pagos
  add constraint venta_pagos_metodo_pago_check
  check (metodo_pago in ('efectivo', 'transferencia', 'tarjeta', 'nequi', 'addi', 'credito', 'otro'));

create index if not exists venta_pagos_venta_id_idx on public.venta_pagos (venta_id);
create index if not exists venta_pagos_organization_id_idx on public.venta_pagos (organization_id);
create index if not exists venta_pagos_sede_id_idx on public.venta_pagos (sede_id);

-- =========================================================
-- COTIZACIONES (borrador de una venta: mismo cliente + productos, sin
-- caja ni pago todavía. Se convierte en una venta real cuando el cliente
-- acepta — `venta_id` queda seteado en ese momento. A diferencia de
-- ventas, SÍ se puede editar/rechazar libremente mientras está
-- 'pendiente', porque todavía no hay plata de por medio.)
-- =========================================================
create table if not exists public.cotizaciones (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  sede_id uuid not null references public.sedes (id) on delete restrict,
  cliente_id uuid not null references public.clientes (id) on delete restrict,
  concepto text not null,
  monto numeric(12, 2) not null check (monto > 0),
  estado text not null default 'pendiente' check (estado in ('pendiente', 'convertida', 'rechazada')),
  referido_nombre text,
  valida_hasta date,
  vendedor_id uuid not null references public.profiles (id),
  venta_id uuid references public.ventas (id) on delete set null,
  created_by uuid not null references public.profiles (id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists cotizaciones_organization_id_idx on public.cotizaciones (organization_id);
create index if not exists cotizaciones_sede_id_idx on public.cotizaciones (sede_id);
create index if not exists cotizaciones_created_at_idx on public.cotizaciones (created_at);

drop trigger if exists cotizaciones_set_updated_at on public.cotizaciones;
create trigger cotizaciones_set_updated_at
  before update on public.cotizaciones
  for each row execute function public.set_updated_at();

create table if not exists public.cotizacion_items (
  id uuid primary key default gen_random_uuid(),
  cotizacion_id uuid not null references public.cotizaciones (id) on delete cascade,
  organization_id uuid not null references public.organizations (id) on delete cascade,
  sede_id uuid not null references public.sedes (id) on delete restrict,
  producto_id uuid references public.productos (id) on delete set null,
  nombre text not null,
  precio numeric(12, 2) not null check (precio >= 0),
  created_at timestamptz not null default now()
);
create index if not exists cotizacion_items_cotizacion_id_idx on public.cotizacion_items (cotizacion_id);
create index if not exists cotizacion_items_organization_id_idx on public.cotizacion_items (organization_id);

-- =========================================================
-- CAJA_SESIONES (un ciclo abrir/cerrar por sede)
-- =========================================================
create table if not exists public.caja_sesiones (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  sede_id uuid not null references public.sedes (id) on delete restrict,
  opened_by uuid not null references public.profiles (id),
  opened_at timestamptz not null default now(),
  closed_by uuid references public.profiles (id),
  closed_at timestamptz,
  opening_balance numeric(12, 2) not null default 0,
  closing_balance numeric(12, 2),
  estado text not null default 'abierta' check (estado in ('abierta', 'cerrada')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists caja_sesiones_organization_id_idx on public.caja_sesiones (organization_id);
create index if not exists caja_sesiones_sede_id_idx on public.caja_sesiones (sede_id);

-- Invariante dura: como máximo una sesión ABIERTA por sede, forzado por
-- Postgres (no por la app) via índice único parcial.
drop index if exists caja_sesiones_one_open_per_sede;
create unique index caja_sesiones_one_open_per_sede
  on public.caja_sesiones (sede_id)
  where estado = 'abierta';

drop trigger if exists caja_sesiones_set_updated_at on public.caja_sesiones;
create trigger caja_sesiones_set_updated_at
  before update on public.caja_sesiones
  for each row execute function public.set_updated_at();

-- =========================================================
-- CAJA_MOVIMIENTOS (libro contable inmutable dentro de una sesión)
-- =========================================================
create table if not exists public.caja_movimientos (
  id uuid primary key default gen_random_uuid(),
  caja_sesion_id uuid not null references public.caja_sesiones (id) on delete cascade,
  -- organization_id / sede_id desnormalizados a propósito: cada policy de RLS
  -- filtra directo sobre esta tabla sin necesitar un subquery/join.
  organization_id uuid not null references public.organizations (id) on delete cascade,
  sede_id uuid not null references public.sedes (id) on delete restrict,
  tipo text not null check (tipo in ('ingreso', 'egreso')),
  concepto text not null,
  monto numeric(12, 2) not null check (monto > 0),
  metodo_pago text check (metodo_pago in ('efectivo', 'transferencia', 'tarjeta', 'nequi', 'addi', 'credito', 'otro')),
  venta_id uuid references public.ventas (id) on delete set null,
  created_by uuid not null references public.profiles (id),
  created_at timestamptz not null default now()
);
alter table public.caja_movimientos drop constraint if exists caja_movimientos_metodo_pago_check;
alter table public.caja_movimientos
  add constraint caja_movimientos_metodo_pago_check
  check (metodo_pago in ('efectivo', 'transferencia', 'tarjeta', 'nequi', 'addi', 'credito', 'otro'));

create index if not exists caja_movimientos_caja_sesion_id_idx on public.caja_movimientos (caja_sesion_id);
create index if not exists caja_movimientos_organization_id_idx on public.caja_movimientos (organization_id);
create index if not exists caja_movimientos_sede_id_idx on public.caja_movimientos (sede_id);
create index if not exists caja_movimientos_created_at_idx on public.caja_movimientos (created_at);

create or replace function public.enforce_open_caja_session()
returns trigger
language plpgsql
security definer set search_path = public
as $$
declare
  v_estado text;
begin
  select estado into v_estado from public.caja_sesiones where id = new.caja_sesion_id;
  if v_estado is distinct from 'abierta' then
    raise exception 'No se puede registrar un movimiento en una caja cerrada';
  end if;
  return new;
end;
$$;

drop trigger if exists caja_movimientos_require_open_session on public.caja_movimientos;
create trigger caja_movimientos_require_open_session
  before insert on public.caja_movimientos
  for each row execute function public.enforce_open_caja_session();

-- =========================================================
-- HELPERS DE RLS (security definer, evitan recursión de RLS al
-- consultar profiles desde dentro de sus propias policies)
-- =========================================================
create or replace function public.current_org_id()
returns uuid
language sql
security definer
stable
set search_path = public
as $$
  select organization_id from public.profiles where id = auth.uid() and active = true;
$$;

create or replace function public.current_role()
returns text
language sql
security definer
stable
set search_path = public
as $$
  select role from public.profiles where id = auth.uid() and active = true;
$$;

create or replace function public.current_sede_id()
returns uuid
language sql
security definer
stable
set search_path = public
as $$
  select sede_id from public.profiles where id = auth.uid() and active = true;
$$;

create or replace function public.is_platform_owner()
returns boolean
language sql
security definer
stable
set search_path = public
as $$
  select coalesce(
    (select role = 'platform_owner' from public.profiles where id = auth.uid() and active = true),
    false
  );
$$;

-- =========================================================
-- PIN DE AUTORIZACIÓN (ventas con menos del 50% de pago inicial). Se
-- hashea con pgcrypto (bcrypt) — set_org_pin es la única forma de
-- escribirlo, verify_org_pin la única de leerlo, y nunca devuelve el hash
-- en sí: ni admin ni recepcionista pueden ver el PIN de otro, solo
-- confirmar si el que tipeó un recepcionista es correcto.
-- =========================================================
create or replace function public.set_org_pin(p_pin text)
returns void
language plpgsql
security definer
-- crypt()/gen_salt() (pgcrypto) viven en el esquema `extensions` en
-- Supabase, no en `public` — hay que incluirlo acá.
set search_path = public, extensions
as $$
begin
  -- "is distinct from", no "<>": current_role() puede dar null (ej. si
  -- alguna vez se llama sin sesión de usuario real) y "null <> 'admin'"
  -- es null, no true, así que "if" no dispara y el chequeo se saltea.
  if public.current_role() is distinct from 'admin' then
    raise exception 'No autorizado';
  end if;
  if p_pin is null or length(p_pin) < 4 then
    raise exception 'El PIN debe tener al menos 4 caracteres';
  end if;
  update public.organizations
  set pin_hash = crypt(p_pin, gen_salt('bf'))
  where id = public.current_org_id();
end;
$$;

create or replace function public.verify_org_pin(p_pin text)
returns boolean
language sql
security definer
stable
set search_path = public, extensions
as $$
  select coalesce(
    (
      select pin_hash = crypt(p_pin, pin_hash)
      from public.organizations
      where id = public.current_org_id() and pin_hash is not null
    ),
    false
  );
$$;

-- =========================================================
-- REGISTRAR_VENTA: escritura atómica de una orden con VARIOS productos —
-- venta + venta_items (uno por producto) + movimiento de caja. security
-- invoker: sigue pasando por las policies normales de abajo, solo
-- garantiza que todas las filas se creen juntas o ninguna.
--
-- p_items: jsonb array {"producto_id": uuid|null, "nombre": text,
-- "precio": numeric} — uno por producto elegido. p_pagos: jsonb array
-- {"monto": numeric, "metodo_pago": text} — uno por método usado en este
-- momento (puede ser menos del total: la venta queda 'abonada'). Si lo
-- pagado ahora es menos del 50% del total NETO (ya con descuento), exige
-- p_pin correcto. p_descuento_tipo: 'porcentaje' | 'fijo' | null — lo puede
-- fijar cualquier vendedor al registrar la orden (a diferencia de
-- aplicar_descuento_venta, que es solo-admin y edita una venta existente).
-- =========================================================
-- Postgres identifica funciones por nombre + tipos de argumentos: cambiar
-- la firma no "reemplaza" ninguna versión anterior — hay que borrarlas a
-- mano para no dejar overloads viejos (PostgREST no sabe elegir cuál usar
-- si queda más de uno).
drop function if exists public.registrar_venta(uuid, uuid, text, text, numeric, text, uuid);
drop function if exists public.registrar_venta(uuid, uuid, text, text, numeric, text, uuid, uuid);
drop function if exists public.registrar_venta(uuid, uuid, jsonb, text, uuid);
drop function if exists public.registrar_venta(uuid, uuid, jsonb, jsonb, uuid, text);
drop function if exists public.registrar_venta(uuid, uuid, jsonb, jsonb, uuid, text, text);

create or replace function public.registrar_venta(
  p_sede_id uuid,
  p_cliente_id uuid,
  p_items jsonb,
  p_pagos jsonb,
  p_vendedor_id uuid,
  p_pin text default null,
  p_referido_nombre text default null,
  p_descuento_tipo text default null,
  p_descuento_valor numeric default 0
)
returns public.ventas
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_venta public.ventas;
  v_sesion_id uuid;
  v_org_id uuid;
  v_monto_total numeric(12, 2);
  v_descuento numeric(12, 2);
  v_monto_neto numeric(12, 2);
  v_monto_pagado numeric(12, 2);
  v_concepto text;
  v_item jsonb;
  v_pago jsonb;
begin
  if p_items is null or jsonb_typeof(p_items) <> 'array' or jsonb_array_length(p_items) = 0 then
    raise exception 'Debe seleccionar al menos un producto';
  end if;
  if p_pagos is null or jsonb_typeof(p_pagos) <> 'array' or jsonb_array_length(p_pagos) = 0 then
    raise exception 'Debe registrar al menos un pago';
  end if;

  select id into v_sesion_id from public.caja_sesiones
    where sede_id = p_sede_id and estado = 'abierta';
  if v_sesion_id is null then
    raise exception 'Debe abrir caja antes de registrar una venta';
  end if;

  select sum((item ->> 'precio')::numeric) into v_monto_total
    from jsonb_array_elements(p_items) as item;
  select string_agg(item ->> 'nombre', ', ' order by ordinality) into v_concepto
    from jsonb_array_elements(p_items) with ordinality as t (item, ordinality);
  select sum((pago ->> 'monto')::numeric) into v_monto_pagado
    from jsonb_array_elements(p_pagos) as pago;

  if p_descuento_tipo is null or p_descuento_tipo = '' then
    v_descuento := 0;
  elsif p_descuento_tipo = 'porcentaje' then
    if p_descuento_valor < 0 or p_descuento_valor > 100 then
      raise exception 'El porcentaje de descuento debe estar entre 0 y 100';
    end if;
    v_descuento := round(v_monto_total * p_descuento_valor / 100, 2);
  elsif p_descuento_tipo = 'fijo' then
    if p_descuento_valor < 0 then
      raise exception 'El descuento no puede ser negativo';
    end if;
    v_descuento := p_descuento_valor;
  else
    raise exception 'Tipo de descuento inválido';
  end if;
  if v_descuento > v_monto_total then
    raise exception 'El descuento no puede superar el total de la orden';
  end if;
  v_monto_neto := v_monto_total - v_descuento;

  if v_monto_pagado > v_monto_neto then
    raise exception 'El pago no puede superar el total de la orden';
  end if;

  if v_monto_pagado < v_monto_neto * 0.5 then
    if not public.verify_org_pin(p_pin) then
      raise exception 'Se requiere el PIN de autorización para ventas con menos del 50%% de pago inicial';
    end if;
  end if;

  v_org_id := public.current_org_id();

  insert into public.ventas (
    organization_id, sede_id, cliente_id, concepto, monto, estado, vendedor_id, referido_nombre, descuento, created_by
  )
  values (
    v_org_id, p_sede_id, p_cliente_id, v_concepto, v_monto_total,
    case when v_monto_pagado >= v_monto_neto then 'pagada' else 'abonada' end,
    p_vendedor_id, nullif(trim(p_referido_nombre), ''), v_descuento, auth.uid()
  )
  returning * into v_venta;

  for v_item in select * from jsonb_array_elements(p_items)
  loop
    insert into public.venta_items (venta_id, organization_id, sede_id, producto_id, nombre, precio)
    values (
      v_venta.id,
      v_org_id,
      p_sede_id,
      nullif(v_item ->> 'producto_id', '')::uuid,
      v_item ->> 'nombre',
      (v_item ->> 'precio')::numeric
    );
  end loop;

  for v_pago in select * from jsonb_array_elements(p_pagos)
  loop
    insert into public.venta_pagos (venta_id, organization_id, sede_id, monto, metodo_pago, created_by)
    values (
      v_venta.id, v_org_id, p_sede_id,
      (v_pago ->> 'monto')::numeric, v_pago ->> 'metodo_pago', auth.uid()
    );

    insert into public.caja_movimientos (
      caja_sesion_id, organization_id, sede_id, tipo, concepto, monto, metodo_pago, venta_id, created_by
    )
    values (
      v_sesion_id, v_org_id, p_sede_id, 'ingreso', v_concepto,
      (v_pago ->> 'monto')::numeric, v_pago ->> 'metodo_pago', v_venta.id, auth.uid()
    );
  end loop;

  return v_venta;
end;
$$;

-- =========================================================
-- REGISTRAR_ABONO: agrega uno o más pagos a una venta 'abonada' ya
-- existente (el cliente vuelve a completar el saldo). No pide PIN — el
-- mínimo del 50% solo aplica al arranque, no a terminar de pagar.
-- =========================================================
create or replace function public.registrar_abono(
  p_venta_id uuid,
  p_pagos jsonb
)
returns public.ventas
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_venta public.ventas;
  v_sesion_id uuid;
  v_pagado_previo numeric(12, 2);
  v_monto_nuevo numeric(12, 2);
  v_pago jsonb;
begin
  if p_pagos is null or jsonb_typeof(p_pagos) <> 'array' or jsonb_array_length(p_pagos) = 0 then
    raise exception 'Debe registrar al menos un pago';
  end if;

  select * into v_venta from public.ventas where id = p_venta_id for update;
  if v_venta.id is null then
    raise exception 'Venta no encontrada';
  end if;
  if v_venta.estado = 'anulada' then
    raise exception 'La venta está anulada';
  end if;
  if v_venta.estado = 'pagada' then
    raise exception 'La venta ya está paga por completo';
  end if;

  select id into v_sesion_id from public.caja_sesiones
    where sede_id = v_venta.sede_id and estado = 'abierta';
  if v_sesion_id is null then
    raise exception 'Debe abrir caja antes de registrar un abono';
  end if;

  select coalesce(sum(monto), 0) into v_pagado_previo
    from public.venta_pagos where venta_id = p_venta_id;
  select sum((pago ->> 'monto')::numeric) into v_monto_nuevo
    from jsonb_array_elements(p_pagos) as pago;

  if v_pagado_previo + v_monto_nuevo > (v_venta.monto - v_venta.descuento) then
    raise exception 'El pago supera el saldo pendiente';
  end if;

  for v_pago in select * from jsonb_array_elements(p_pagos)
  loop
    insert into public.venta_pagos (venta_id, organization_id, sede_id, monto, metodo_pago, created_by)
    values (
      p_venta_id, v_venta.organization_id, v_venta.sede_id,
      (v_pago ->> 'monto')::numeric, v_pago ->> 'metodo_pago', auth.uid()
    );

    insert into public.caja_movimientos (
      caja_sesion_id, organization_id, sede_id, tipo, concepto, monto, metodo_pago, venta_id, created_by
    )
    values (
      v_sesion_id, v_venta.organization_id, v_venta.sede_id, 'ingreso', v_venta.concepto,
      (v_pago ->> 'monto')::numeric, v_pago ->> 'metodo_pago', p_venta_id, auth.uid()
    );
  end loop;

  update public.ventas
  set estado = case when v_pagado_previo + v_monto_nuevo >= (monto - descuento) then 'pagada' else 'abonada' end
  where id = p_venta_id
  returning * into v_venta;

  return v_venta;
end;
$$;

-- =========================================================
-- APLICAR_DESCUENTO_VENTA: fija (o quita) el descuento de una venta ya
-- existente — pensada para /admin/mora, donde el admin revisa clientes con
-- saldo pendiente y negocia una rebaja de la deuda. Solo admin (chequeado a
-- mano, no depende únicamente de la policy de UPDATE porque acá además hay
-- que validar que el descuento no deje el total por debajo de lo ya
-- pagado). security invoker: la escritura igual pasa por
-- ventas_update_admin + el trigger de columnas privilegiadas de abajo.
-- =========================================================
create or replace function public.aplicar_descuento_venta(
  p_venta_id uuid,
  p_descuento_tipo text,
  p_descuento_valor numeric default 0
)
returns public.ventas
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_venta public.ventas;
  v_pagado numeric(12, 2);
  v_descuento numeric(12, 2);
begin
  if public.current_role() is distinct from 'admin' then
    raise exception 'Solo un administrador puede aplicar descuentos';
  end if;

  select * into v_venta from public.ventas where id = p_venta_id for update;
  if v_venta.id is null then
    raise exception 'Venta no encontrada';
  end if;
  if v_venta.estado = 'anulada' then
    raise exception 'La venta está anulada';
  end if;

  if p_descuento_tipo is null or p_descuento_tipo = '' or p_descuento_tipo = 'ninguno' then
    v_descuento := 0;
  elsif p_descuento_tipo = 'porcentaje' then
    if p_descuento_valor < 0 or p_descuento_valor > 100 then
      raise exception 'El porcentaje de descuento debe estar entre 0 y 100';
    end if;
    v_descuento := round(v_venta.monto * p_descuento_valor / 100, 2);
  elsif p_descuento_tipo = 'fijo' then
    if p_descuento_valor < 0 then
      raise exception 'El descuento no puede ser negativo';
    end if;
    v_descuento := p_descuento_valor;
  else
    raise exception 'Tipo de descuento inválido';
  end if;

  if v_descuento > v_venta.monto then
    raise exception 'El descuento no puede superar el total de la orden';
  end if;

  select coalesce(sum(monto), 0) into v_pagado from public.venta_pagos where venta_id = p_venta_id;
  if v_pagado > (v_venta.monto - v_descuento) then
    raise exception 'El descuento no puede dejar el total por debajo de lo ya pagado';
  end if;

  update public.ventas
  set descuento = v_descuento,
      estado = case when v_pagado >= (v_venta.monto - v_descuento) then 'pagada' else 'abonada' end
  where id = p_venta_id
  returning * into v_venta;

  return v_venta;
end;
$$;

-- Reemplazada por registrar_certificado_runt: ya no es un simple toggle de
-- admin, ahora exige que además se suba el archivo del certificado.
drop function if exists public.certificar_venta(uuid);

-- =========================================================
-- REGISTRAR_CERTIFICADO_RUNT: registra que el certificado RUNT de una venta
-- ya se subió (a `certificado_path`, en el bucket certificados-runt — el
-- archivo en sí lo sube el cliente directo a Storage, esta función solo dev
-- deja la constancia en la fila). Lo puede hacer un admin (cualquier sede de
-- su organización) o un recepcionista (solo su propia sede) — a diferencia
-- de aplicar_descuento_venta, este NO es admin-only: el recepcionista es
-- quien normalmente hace el trámite y tiene el PDF/foto a mano. Igual que
-- antes, solo si la venta ya está paga por completo, y de una sola vía (no
-- hay forma de "quitar" el certificado desde la UI).
--
-- security definer a propósito: un recepcionista no tiene ninguna policy de
-- UPDATE sobre una venta 'pagada' (solo sobre una 'abonada', para completar
-- su propio abono) — este chequeo de arriba (rol + sede + saldo) reemplaza
-- esa policy para este caso puntual. set_config dentro de la función deja
-- una marca de una sola transacción que el trigger de abajo exige para
-- dejar pasar el cambio a estas columnas puntuales.
-- =========================================================
create or replace function public.registrar_certificado_runt(
  p_venta_id uuid,
  p_certificado_path text
)
returns public.ventas
language plpgsql
security definer
set search_path = public
as $$
declare
  v_venta public.ventas;
  v_pagado numeric(12, 2);
begin
  if public.current_role() not in ('admin', 'recepcionista') then
    raise exception 'No autorizado';
  end if;
  if p_certificado_path is null or length(trim(p_certificado_path)) = 0 then
    raise exception 'Falta el archivo del certificado';
  end if;

  select * into v_venta from public.ventas where id = p_venta_id for update;
  if v_venta.id is null then
    raise exception 'Venta no encontrada';
  end if;
  if v_venta.organization_id is distinct from public.current_org_id() then
    raise exception 'No autorizado';
  end if;
  if public.current_role() = 'recepcionista' and v_venta.sede_id is distinct from public.current_sede_id() then
    raise exception 'No autorizado para esta sede';
  end if;
  if v_venta.estado = 'anulada' then
    raise exception 'La venta está anulada';
  end if;
  if v_venta.certificado then
    raise exception 'Esta venta ya tiene el certificado RUNT subido';
  end if;

  select coalesce(sum(monto), 0) into v_pagado from public.venta_pagos where venta_id = p_venta_id;
  if v_pagado < (v_venta.monto - v_venta.descuento) then
    raise exception 'No se puede subir el certificado: todavía queda saldo pendiente por cobrar';
  end if;

  perform set_config('app.allow_certificado_update', 'true', true);

  update public.ventas
  set certificado = true,
      certificado_at = now(),
      certificado_by = auth.uid(),
      certificado_path = p_certificado_path
  where id = p_venta_id
  returning * into v_venta;

  return v_venta;
end;
$$;

-- =========================================================
-- Políticas de storage.objects para el bucket certificados-runt. Ruta de
-- cada archivo: "<organization_id>/<venta_id>/<archivo>" — de ahí se lee
-- directo con storage.foldername(name), sin depender de metadata aparte.
-- Solo INSERT y SELECT: como venta_pagos/venta_items, es un registro de una
-- sola vía — nadie sobreescribe ni borra un certificado ya subido.
-- =========================================================
drop policy if exists "certificados_runt_insert" on storage.objects;
create policy "certificados_runt_insert" on storage.objects
  for insert
  with check (
    bucket_id = 'certificados-runt'
    and (storage.foldername(name))[1] = public.current_org_id()::text
    and exists (
      select 1 from public.ventas v
      where v.id::text = (storage.foldername(name))[2]
        and v.organization_id = public.current_org_id()
        and (public.current_role() = 'admin' or v.sede_id = public.current_sede_id())
    )
  );

drop policy if exists "certificados_runt_select" on storage.objects;
create policy "certificados_runt_select" on storage.objects
  for select
  using (
    bucket_id = 'certificados-runt'
    and (storage.foldername(name))[1] = public.current_org_id()::text
    and exists (
      select 1 from public.ventas v
      where v.id::text = (storage.foldername(name))[2]
        and v.organization_id = public.current_org_id()
        and (public.current_role() = 'admin' or v.sede_id = public.current_sede_id())
    )
  );

-- =========================================================
-- CREAR_COTIZACION: borrador de venta, sin caja ni pago — solo cliente +
-- productos. security invoker: pasa por las policies normales de abajo.
-- =========================================================
create or replace function public.crear_cotizacion(
  p_sede_id uuid,
  p_cliente_id uuid,
  p_items jsonb,
  p_vendedor_id uuid,
  p_referido_nombre text default null,
  p_valida_hasta date default null
)
returns public.cotizaciones
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_cotizacion public.cotizaciones;
  v_org_id uuid;
  v_monto_total numeric(12, 2);
  v_concepto text;
  v_item jsonb;
begin
  if p_items is null or jsonb_typeof(p_items) <> 'array' or jsonb_array_length(p_items) = 0 then
    raise exception 'Debe seleccionar al menos un producto';
  end if;

  select sum((item ->> 'precio')::numeric) into v_monto_total
    from jsonb_array_elements(p_items) as item;
  select string_agg(item ->> 'nombre', ', ' order by ordinality) into v_concepto
    from jsonb_array_elements(p_items) with ordinality as t (item, ordinality);

  v_org_id := public.current_org_id();

  insert into public.cotizaciones (
    organization_id, sede_id, cliente_id, concepto, monto, vendedor_id, referido_nombre, valida_hasta, created_by
  )
  values (
    v_org_id, p_sede_id, p_cliente_id, v_concepto, v_monto_total,
    p_vendedor_id, nullif(trim(p_referido_nombre), ''), p_valida_hasta, auth.uid()
  )
  returning * into v_cotizacion;

  for v_item in select * from jsonb_array_elements(p_items)
  loop
    insert into public.cotizacion_items (cotizacion_id, organization_id, sede_id, producto_id, nombre, precio)
    values (
      v_cotizacion.id, v_org_id, p_sede_id,
      nullif(v_item ->> 'producto_id', '')::uuid, v_item ->> 'nombre', (v_item ->> 'precio')::numeric
    );
  end loop;

  return v_cotizacion;
end;
$$;

-- =========================================================
-- CONVERTIR_COTIZACION: crea la venta real (venta + venta_items +
-- venta_pagos + caja_movimientos, igual que registrar_venta) a partir de
-- una cotización 'pendiente', y la marca 'convertida'. Repite la lógica de
-- registrar_venta en vez de llamarla porque los items ya están guardados
-- en cotizacion_items, no llegan como parámetro.
-- =========================================================
create or replace function public.convertir_cotizacion(
  p_cotizacion_id uuid,
  p_pagos jsonb,
  p_pin text default null
)
returns public.ventas
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_cot public.cotizaciones;
  v_venta public.ventas;
  v_sesion_id uuid;
  v_monto_pagado numeric(12, 2);
  v_pago jsonb;
  v_item record;
begin
  select * into v_cot from public.cotizaciones where id = p_cotizacion_id for update;
  if v_cot.id is null then
    raise exception 'Cotización no encontrada';
  end if;
  if v_cot.estado <> 'pendiente' then
    raise exception 'Esta cotización ya no está pendiente';
  end if;

  if p_pagos is null or jsonb_typeof(p_pagos) <> 'array' or jsonb_array_length(p_pagos) = 0 then
    raise exception 'Debe registrar al menos un pago';
  end if;

  select id into v_sesion_id from public.caja_sesiones
    where sede_id = v_cot.sede_id and estado = 'abierta';
  if v_sesion_id is null then
    raise exception 'Debe abrir caja antes de registrar una venta';
  end if;

  select sum((pago ->> 'monto')::numeric) into v_monto_pagado
    from jsonb_array_elements(p_pagos) as pago;

  if v_monto_pagado > v_cot.monto then
    raise exception 'El pago no puede superar el total de la orden';
  end if;

  if v_monto_pagado < v_cot.monto * 0.5 then
    if not public.verify_org_pin(p_pin) then
      raise exception 'Se requiere el PIN de autorización para ventas con menos del 50%% de pago inicial';
    end if;
  end if;

  insert into public.ventas (
    organization_id, sede_id, cliente_id, concepto, monto, estado, vendedor_id, referido_nombre, created_by
  )
  values (
    v_cot.organization_id, v_cot.sede_id, v_cot.cliente_id, v_cot.concepto, v_cot.monto,
    case when v_monto_pagado >= v_cot.monto then 'pagada' else 'abonada' end,
    v_cot.vendedor_id, v_cot.referido_nombre, auth.uid()
  )
  returning * into v_venta;

  for v_item in select producto_id, nombre, precio from public.cotizacion_items where cotizacion_id = p_cotizacion_id
  loop
    insert into public.venta_items (venta_id, organization_id, sede_id, producto_id, nombre, precio)
    values (v_venta.id, v_cot.organization_id, v_cot.sede_id, v_item.producto_id, v_item.nombre, v_item.precio);
  end loop;

  for v_pago in select * from jsonb_array_elements(p_pagos)
  loop
    insert into public.venta_pagos (venta_id, organization_id, sede_id, monto, metodo_pago, created_by)
    values (
      v_venta.id, v_cot.organization_id, v_cot.sede_id,
      (v_pago ->> 'monto')::numeric, v_pago ->> 'metodo_pago', auth.uid()
    );

    insert into public.caja_movimientos (
      caja_sesion_id, organization_id, sede_id, tipo, concepto, monto, metodo_pago, venta_id, created_by
    )
    values (
      v_sesion_id, v_cot.organization_id, v_cot.sede_id, 'ingreso', v_cot.concepto,
      (v_pago ->> 'monto')::numeric, v_pago ->> 'metodo_pago', v_venta.id, auth.uid()
    );
  end loop;

  update public.cotizaciones set estado = 'convertida', venta_id = v_venta.id where id = p_cotizacion_id;

  return v_venta;
end;
$$;

-- =========================================================
-- CREAR PROFILE AUTOMÁTICO al crear un auth.user (siempre vía
-- admin.createUser + user_metadata, nunca por registro público en v1).
--
-- Si no viene ningún user_metadata (caso: alguien con acceso al dashboard
-- de Supabase crea un usuario a mano, sin pasar por la app) se asume que es
-- el bootstrap del primer platform_owner — es la única situación en la que
-- falta metadata, ya que TODOS los flujos de la app (provisionar org,
-- crear admin, crear recepcionista) siempre mandan role/organization_id/sede_id
-- explícitos. Quien tiene acceso al dashboard para crear un usuario a mano
-- ya tiene el nivel de confianza más alto posible (puede correr SQL
-- arbitrario), así que no es una escalada de privilegios real.
-- =========================================================
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  insert into public.profiles (id, full_name, role, organization_id, sede_id)
  values (
    new.id,
    coalesce(new.raw_user_meta_data ->> 'full_name', ''),
    coalesce(new.raw_user_meta_data ->> 'role', 'platform_owner'),
    nullif(new.raw_user_meta_data ->> 'organization_id', '')::uuid,
    nullif(new.raw_user_meta_data ->> 'sede_id', '')::uuid
  );
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- Defensa en profundidad: RLS no compara OLD vs NEW columna por columna, así
-- que un usuario podría intentar auto-ascenderse de rol vía UPDATE sobre su
-- propia fila (profiles_update_self permite id = auth.uid()). Este trigger
-- bloquea cambios a columnas privilegiadas salvo que los haga platform_owner.
create or replace function public.lock_profile_privileged_columns()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  -- auth.uid() is null cuando la escritura viene del cliente service_role
  -- (createAdminClient()): esas rutas ya re-chequean el rol del caller a
  -- mano en la Server Action antes de llegar acá, así que no aplican este
  -- bloqueo — es exclusivamente para frenar que un usuario autenticado
  -- normal se autoascienda vía la policy profiles_update_self.
  if auth.uid() is not null and not public.is_platform_owner() and (
    new.role is distinct from old.role
    or new.organization_id is distinct from old.organization_id
    or new.sede_id is distinct from old.sede_id
    or new.active is distinct from old.active
  ) then
    raise exception 'No autorizado para modificar rol, organización, sede o estado de la cuenta';
  end if;
  return new;
end;
$$;

drop trigger if exists profiles_lock_privileged_columns on public.profiles;
create trigger profiles_lock_privileged_columns
  before update on public.profiles
  for each row execute function public.lock_profile_privileged_columns();

-- Mismo mecanismo, para ventas: un recepcionista ahora puede actualizar
-- `estado` (registrar_abono la mueve de 'abonada' a 'pagada'), pero nunca
-- concepto/monto/cliente/sede/organización/vendedor — eso solo un admin.
--
-- Las columnas certificado* van aparte: ni admin ni recepcionista pueden
-- tocarlas por su cuenta desde una policy normal de UPDATE — el único
-- camino válido es registrar_certificado_runt(), que antes de escribir deja
-- la marca de sesión 'app.allow_certificado_update' (local a la
-- transacción). Sin esa marca, cualquier intento de cambiarlas se rechaza,
-- venga de quien venga.
create or replace function public.lock_venta_privileged_columns()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  if public.current_role() is distinct from 'admin' and (
    new.concepto is distinct from old.concepto
    or new.monto is distinct from old.monto
    or new.cliente_id is distinct from old.cliente_id
    or new.sede_id is distinct from old.sede_id
    or new.organization_id is distinct from old.organization_id
    or new.vendedor_id is distinct from old.vendedor_id
    or new.referido_nombre is distinct from old.referido_nombre
    or new.descuento is distinct from old.descuento
  ) then
    raise exception 'No autorizado para modificar esos campos de la venta';
  end if;

  if (
    new.certificado is distinct from old.certificado
    or new.certificado_at is distinct from old.certificado_at
    or new.certificado_by is distinct from old.certificado_by
    or new.certificado_path is distinct from old.certificado_path
  ) and coalesce(current_setting('app.allow_certificado_update', true), '') <> 'true' then
    raise exception 'No autorizado para modificar la certificación de esta venta';
  end if;

  return new;
end;
$$;

drop trigger if exists ventas_lock_privileged_columns on public.ventas;
create trigger ventas_lock_privileged_columns
  before update on public.ventas
  for each row execute function public.lock_venta_privileged_columns();

-- =========================================================
-- RLS
-- =========================================================
alter table public.organizations enable row level security;
alter table public.sedes enable row level security;
alter table public.profiles enable row level security;
alter table public.clientes enable row level security;
alter table public.productos enable row level security;
alter table public.ventas enable row level security;
alter table public.venta_items enable row level security;
alter table public.venta_pagos enable row level security;
alter table public.cotizaciones enable row level security;
alter table public.cotizacion_items enable row level security;
alter table public.caja_sesiones enable row level security;
alter table public.caja_movimientos enable row level security;

-- organizations: cada quien lee la suya; platform_owner las lee todas.
-- SIN policy de insert/update/delete a propósito: toda escritura pasa por
-- createAdminClient() desde /platform, después de re-chequear
-- is_platform_owner() con el cliente normal (RLS-bound).
drop policy if exists "organizations_select_own" on public.organizations;
create policy "organizations_select_own" on public.organizations
  for select using (id = public.current_org_id());

drop policy if exists "organizations_select_platform_owner" on public.organizations;
create policy "organizations_select_platform_owner" on public.organizations
  for select using (public.is_platform_owner());

-- profiles
drop policy if exists "profiles_select_self" on public.profiles;
create policy "profiles_select_self" on public.profiles
  for select using (id = auth.uid());

drop policy if exists "profiles_select_org_admin" on public.profiles;
create policy "profiles_select_org_admin" on public.profiles
  for select using (public.current_role() = 'admin' and organization_id = public.current_org_id());

drop policy if exists "profiles_select_sede_recepcionista" on public.profiles;
create policy "profiles_select_sede_recepcionista" on public.profiles
  for select using (
    public.current_role() = 'recepcionista'
    and organization_id = public.current_org_id()
    and sede_id = public.current_sede_id()
  );

drop policy if exists "profiles_select_platform_owner" on public.profiles;
create policy "profiles_select_platform_owner" on public.profiles
  for select using (public.is_platform_owner());

drop policy if exists "profiles_update_self" on public.profiles;
create policy "profiles_update_self" on public.profiles
  for update using (id = auth.uid()) with check (id = auth.uid());

-- sedes
drop policy if exists "sedes_select_org" on public.sedes;
create policy "sedes_select_org" on public.sedes
  for select using (organization_id = public.current_org_id());

drop policy if exists "sedes_insert_admin" on public.sedes;
create policy "sedes_insert_admin" on public.sedes
  for insert with check (public.current_role() = 'admin' and organization_id = public.current_org_id());

drop policy if exists "sedes_update_admin" on public.sedes;
create policy "sedes_update_admin" on public.sedes
  for update
  using (public.current_role() = 'admin' and organization_id = public.current_org_id())
  with check (public.current_role() = 'admin' and organization_id = public.current_org_id());

-- clientes
drop policy if exists "clientes_select_org_admin" on public.clientes;
create policy "clientes_select_org_admin" on public.clientes
  for select using (public.current_role() = 'admin' and organization_id = public.current_org_id());

drop policy if exists "clientes_select_sede_recepcionista" on public.clientes;
create policy "clientes_select_sede_recepcionista" on public.clientes
  for select using (
    public.current_role() = 'recepcionista'
    and organization_id = public.current_org_id()
    and sede_id = public.current_sede_id()
  );

drop policy if exists "clientes_insert_admin" on public.clientes;
create policy "clientes_insert_admin" on public.clientes
  for insert with check (public.current_role() = 'admin' and organization_id = public.current_org_id());

drop policy if exists "clientes_insert_recepcionista" on public.clientes;
create policy "clientes_insert_recepcionista" on public.clientes
  for insert with check (
    public.current_role() = 'recepcionista'
    and organization_id = public.current_org_id()
    and sede_id = public.current_sede_id()
  );

drop policy if exists "clientes_update_admin" on public.clientes;
create policy "clientes_update_admin" on public.clientes
  for update
  using (public.current_role() = 'admin' and organization_id = public.current_org_id())
  with check (public.current_role() = 'admin' and organization_id = public.current_org_id());

-- Sin policy de update para recepcionista a propósito: un recepcionista
-- puede crear clientes (ver clientes_insert_recepcionista) pero no
-- modificar NINGÚN campo después — ni siquiera activar/desactivar. Solo
-- el admin corrige datos de un cliente ya cargado.
drop policy if exists "clientes_update_recepcionista" on public.clientes;

-- productos: catálogo de la organización. Cualquier miembro (admin o
-- recepcionista) puede leerlo para elegir productos al registrar una
-- venta; solo el admin lo mantiene.
drop policy if exists "productos_select_org" on public.productos;
create policy "productos_select_org" on public.productos
  for select using (organization_id = public.current_org_id());

drop policy if exists "productos_insert_admin" on public.productos;
create policy "productos_insert_admin" on public.productos
  for insert with check (public.current_role() = 'admin' and organization_id = public.current_org_id());

drop policy if exists "productos_update_admin" on public.productos;
create policy "productos_update_admin" on public.productos
  for update
  using (public.current_role() = 'admin' and organization_id = public.current_org_id())
  with check (public.current_role() = 'admin' and organization_id = public.current_org_id());

-- ventas: un recepcionista solo puede insertar (y solo a su propio nombre);
-- modificar/anular una venta existente es exclusivo del admin.
drop policy if exists "ventas_select_org_admin" on public.ventas;
create policy "ventas_select_org_admin" on public.ventas
  for select using (public.current_role() = 'admin' and organization_id = public.current_org_id());

drop policy if exists "ventas_select_sede_recepcionista" on public.ventas;
create policy "ventas_select_sede_recepcionista" on public.ventas
  for select using (
    public.current_role() = 'recepcionista'
    and organization_id = public.current_org_id()
    and sede_id = public.current_sede_id()
  );

drop policy if exists "ventas_insert_admin" on public.ventas;
create policy "ventas_insert_admin" on public.ventas
  for insert with check (public.current_role() = 'admin' and organization_id = public.current_org_id());

drop policy if exists "ventas_insert_recepcionista" on public.ventas;
create policy "ventas_insert_recepcionista" on public.ventas
  for insert with check (
    public.current_role() = 'recepcionista'
    and organization_id = public.current_org_id()
    and sede_id = public.current_sede_id()
    and vendedor_id = auth.uid()
  );

drop policy if exists "ventas_update_admin" on public.ventas;
create policy "ventas_update_admin" on public.ventas
  for update
  using (public.current_role() = 'admin' and organization_id = public.current_org_id())
  with check (public.current_role() = 'admin' and organization_id = public.current_org_id());

-- Un recepcionista puede actualizar una venta 'abonada' de su propia
-- sede (para que registrar_abono la pase a 'pagada') — el trigger
-- ventas_lock_privileged_columns de arriba impide que toque cualquier
-- columna que no sea estado/updated_at.
drop policy if exists "ventas_update_recepcionista_abono" on public.ventas;
create policy "ventas_update_recepcionista_abono" on public.ventas
  for update
  using (
    public.current_role() = 'recepcionista'
    and sede_id = public.current_sede_id()
    and estado = 'abonada'
  )
  with check (
    public.current_role() = 'recepcionista'
    and sede_id = public.current_sede_id()
  );

-- venta_pagos: inmutables, sin policy de update/delete para nadie —
-- mismo patrón que venta_items/caja_movimientos.
drop policy if exists "venta_pagos_select_org_admin" on public.venta_pagos;
create policy "venta_pagos_select_org_admin" on public.venta_pagos
  for select using (public.current_role() = 'admin' and organization_id = public.current_org_id());

drop policy if exists "venta_pagos_select_sede_recepcionista" on public.venta_pagos;
create policy "venta_pagos_select_sede_recepcionista" on public.venta_pagos
  for select using (
    public.current_role() = 'recepcionista'
    and organization_id = public.current_org_id()
    and sede_id = public.current_sede_id()
  );

drop policy if exists "venta_pagos_insert_admin" on public.venta_pagos;
create policy "venta_pagos_insert_admin" on public.venta_pagos
  for insert with check (public.current_role() = 'admin' and organization_id = public.current_org_id());

drop policy if exists "venta_pagos_insert_recepcionista" on public.venta_pagos;
create policy "venta_pagos_insert_recepcionista" on public.venta_pagos
  for insert with check (
    public.current_role() = 'recepcionista'
    and organization_id = public.current_org_id()
    and sede_id = public.current_sede_id()
  );

-- venta_items: inmutables, sin policy de update/delete para nadie —
-- misma lógica que caja_movimientos.
drop policy if exists "venta_items_select_org_admin" on public.venta_items;
create policy "venta_items_select_org_admin" on public.venta_items
  for select using (public.current_role() = 'admin' and organization_id = public.current_org_id());

drop policy if exists "venta_items_select_sede_recepcionista" on public.venta_items;
create policy "venta_items_select_sede_recepcionista" on public.venta_items
  for select using (
    public.current_role() = 'recepcionista'
    and organization_id = public.current_org_id()
    and sede_id = public.current_sede_id()
  );

drop policy if exists "venta_items_insert_admin" on public.venta_items;
create policy "venta_items_insert_admin" on public.venta_items
  for insert with check (public.current_role() = 'admin' and organization_id = public.current_org_id());

drop policy if exists "venta_items_insert_recepcionista" on public.venta_items;
create policy "venta_items_insert_recepcionista" on public.venta_items
  for insert with check (
    public.current_role() = 'recepcionista'
    and organization_id = public.current_org_id()
    and sede_id = public.current_sede_id()
  );

-- cotizaciones: a diferencia de ventas, un recepcionista SÍ puede
-- actualizar (rechazar) las de su propia sede — todavía no hay plata de
-- por medio. convertir_cotizacion además pone estado='convertida' y
-- venta_id, lo que también pasa por esta misma policy de update.
drop policy if exists "cotizaciones_select_org_admin" on public.cotizaciones;
create policy "cotizaciones_select_org_admin" on public.cotizaciones
  for select using (public.current_role() = 'admin' and organization_id = public.current_org_id());

drop policy if exists "cotizaciones_select_sede_recepcionista" on public.cotizaciones;
create policy "cotizaciones_select_sede_recepcionista" on public.cotizaciones
  for select using (
    public.current_role() = 'recepcionista'
    and organization_id = public.current_org_id()
    and sede_id = public.current_sede_id()
  );

drop policy if exists "cotizaciones_insert_admin" on public.cotizaciones;
create policy "cotizaciones_insert_admin" on public.cotizaciones
  for insert with check (public.current_role() = 'admin' and organization_id = public.current_org_id());

drop policy if exists "cotizaciones_insert_recepcionista" on public.cotizaciones;
create policy "cotizaciones_insert_recepcionista" on public.cotizaciones
  for insert with check (
    public.current_role() = 'recepcionista'
    and organization_id = public.current_org_id()
    and sede_id = public.current_sede_id()
  );

drop policy if exists "cotizaciones_update_admin" on public.cotizaciones;
create policy "cotizaciones_update_admin" on public.cotizaciones
  for update
  using (public.current_role() = 'admin' and organization_id = public.current_org_id())
  with check (public.current_role() = 'admin' and organization_id = public.current_org_id());

drop policy if exists "cotizaciones_update_sede_recepcionista" on public.cotizaciones;
create policy "cotizaciones_update_sede_recepcionista" on public.cotizaciones
  for update
  using (
    public.current_role() = 'recepcionista'
    and organization_id = public.current_org_id()
    and sede_id = public.current_sede_id()
  )
  with check (
    public.current_role() = 'recepcionista'
    and organization_id = public.current_org_id()
    and sede_id = public.current_sede_id()
  );

-- cotizacion_items: inmutables, mismo patrón que venta_items.
drop policy if exists "cotizacion_items_select_org_admin" on public.cotizacion_items;
create policy "cotizacion_items_select_org_admin" on public.cotizacion_items
  for select using (public.current_role() = 'admin' and organization_id = public.current_org_id());

drop policy if exists "cotizacion_items_select_sede_recepcionista" on public.cotizacion_items;
create policy "cotizacion_items_select_sede_recepcionista" on public.cotizacion_items
  for select using (
    public.current_role() = 'recepcionista'
    and organization_id = public.current_org_id()
    and sede_id = public.current_sede_id()
  );

drop policy if exists "cotizacion_items_insert_admin" on public.cotizacion_items;
create policy "cotizacion_items_insert_admin" on public.cotizacion_items
  for insert with check (public.current_role() = 'admin' and organization_id = public.current_org_id());

drop policy if exists "cotizacion_items_insert_recepcionista" on public.cotizacion_items;
create policy "cotizacion_items_insert_recepcionista" on public.cotizacion_items
  for insert with check (
    public.current_role() = 'recepcionista'
    and organization_id = public.current_org_id()
    and sede_id = public.current_sede_id()
  );

-- caja_sesiones
drop policy if exists "caja_sesiones_select_org_admin" on public.caja_sesiones;
create policy "caja_sesiones_select_org_admin" on public.caja_sesiones
  for select using (public.current_role() = 'admin' and organization_id = public.current_org_id());

drop policy if exists "caja_sesiones_select_sede_recepcionista" on public.caja_sesiones;
create policy "caja_sesiones_select_sede_recepcionista" on public.caja_sesiones
  for select using (
    public.current_role() = 'recepcionista'
    and organization_id = public.current_org_id()
    and sede_id = public.current_sede_id()
  );

drop policy if exists "caja_sesiones_insert_admin" on public.caja_sesiones;
create policy "caja_sesiones_insert_admin" on public.caja_sesiones
  for insert with check (
    public.current_role() = 'admin' and organization_id = public.current_org_id() and opened_by = auth.uid()
  );

drop policy if exists "caja_sesiones_insert_recepcionista" on public.caja_sesiones;
create policy "caja_sesiones_insert_recepcionista" on public.caja_sesiones
  for insert with check (
    public.current_role() = 'recepcionista'
    and organization_id = public.current_org_id()
    and sede_id = public.current_sede_id()
    and opened_by = auth.uid()
  );

drop policy if exists "caja_sesiones_update_admin" on public.caja_sesiones;
create policy "caja_sesiones_update_admin" on public.caja_sesiones
  for update
  using (public.current_role() = 'admin' and organization_id = public.current_org_id())
  with check (public.current_role() = 'admin' and organization_id = public.current_org_id());

drop policy if exists "caja_sesiones_update_recepcionista" on public.caja_sesiones;
create policy "caja_sesiones_update_recepcionista" on public.caja_sesiones
  for update
  using (
    public.current_role() = 'recepcionista'
    and organization_id = public.current_org_id()
    and sede_id = public.current_sede_id()
  )
  with check (
    public.current_role() = 'recepcionista'
    and organization_id = public.current_org_id()
    and sede_id = public.current_sede_id()
  );

-- caja_movimientos: libro inmutable, sin policy de update/delete para nadie.
drop policy if exists "caja_movimientos_select_org_admin" on public.caja_movimientos;
create policy "caja_movimientos_select_org_admin" on public.caja_movimientos
  for select using (public.current_role() = 'admin' and organization_id = public.current_org_id());

drop policy if exists "caja_movimientos_select_sede_recepcionista" on public.caja_movimientos;
create policy "caja_movimientos_select_sede_recepcionista" on public.caja_movimientos
  for select using (
    public.current_role() = 'recepcionista'
    and organization_id = public.current_org_id()
    and sede_id = public.current_sede_id()
  );

drop policy if exists "caja_movimientos_insert_admin" on public.caja_movimientos;
create policy "caja_movimientos_insert_admin" on public.caja_movimientos
  for insert with check (public.current_role() = 'admin' and organization_id = public.current_org_id());

drop policy if exists "caja_movimientos_insert_recepcionista" on public.caja_movimientos;
create policy "caja_movimientos_insert_recepcionista" on public.caja_movimientos
  for insert with check (
    public.current_role() = 'recepcionista'
    and organization_id = public.current_org_id()
    and sede_id = public.current_sede_id()
  );

-- Nota deliberada: ni sedes, ni clientes, ni ventas, ni caja_sesiones, ni
-- caja_movimientos tienen policy alguna para platform_owner. El login del
-- vendedor de la plataforma NO tiene acceso de lectura a los datos de
-- ningún tenant — ver README para el detalle de esta decisión.
