# Gestia App Conductores

SaaS de ventas, caja y clientes para escuelas de conducción. Multi-tenant:
cada organización (escuela) tiene sus propias sedes, usuarios, clientes,
ventas y caja, aisladas a nivel de RLS en Postgres.

Proyecto 100% independiente de `ceapp-aula-virtual` — repo propio, proyecto
Supabase propio, sin código ni base de datos compartida.

## Setup

1. Copiar `.env.local.example` a `.env.local` y completar con los datos de
   un proyecto Supabase nuevo (Project Settings → API):
   ```
   NEXT_PUBLIC_SUPABASE_URL=
   NEXT_PUBLIC_SUPABASE_ANON_KEY=
   SUPABASE_SERVICE_ROLE_KEY=
   ```
2. Correr `supabase/schema.sql` completo en el SQL Editor del proyecto
   (tablas, funciones, triggers y policies de RLS — es idempotente, se puede
   volver a correr sin romper nada).
3. **Bootstrap del primer `platform_owner`** (paso manual único, no hay UI
   para esto todavía — es la cuenta con la que vos, el dueño del producto,
   entrás a `/platform` a provisionar organizaciones nuevas):
   - Dashboard de Supabase → Authentication → Add user → creá el usuario con
     email/contraseña.
   - En el SQL Editor, actualizá su perfil a `platform_owner` (el trigger
     `handle_new_user` ya le creó un `profiles` con role `ejecutivo` por
     default):
     ```sql
     update public.profiles
     set role = 'platform_owner', organization_id = null, sede_id = null, full_name = 'Tu nombre'
     where id = '<uuid del usuario creado>';
     ```
4. `npm install && npm run dev`, entrar en `/login` con esa cuenta → te
   redirige a `/platform`.

Desde `/platform` se provisiona cada organización cliente nueva (nombre,
primera sede, y la cuenta admin de esa escuela) — no hay registro público.

## Roles

- `platform_owner`: el vendedor del producto. Solo administra el listado de
  organizaciones — **no tiene acceso a los datos de ningún tenant** (ni
  clientes, ni ventas, ni caja). Es una decisión de seguridad deliberada.
- `admin`: dueño/administrador de una organización. Ve y gestiona todas las
  sedes de su organización: clientes, ventas, caja, sedes y usuarios.
- `ejecutivo`: usuario de una sede específica. Solo ve/opera clientes,
  ventas y caja de su propia sede.

## Alcance v1

Ventas simples (pago completo al momento, sin abonos ni comisiones de
asesor), caja (abrir/cerrar, ingresos/egresos), clientes (CRUD). Huellas
biométricas: solo el campo reservado en la base (`fingerprints_enrolled`),
sin integración de hardware todavía. Ver comentarios en
`supabase/schema.sql` para el detalle de qué queda pospuesto a una fase 2
(abonos, comisiones, conciliación de cartera, huellas, registro público).

## Verificación de aislamiento multi-tenant

Antes de dar por buena cualquier versión de este proyecto, seguir el
checklist de aislamiento del plan original (provisionar 2 organizaciones,
confirmar que ninguna ve datos de la otra ni por UI ni pegándole directo al
REST de Supabase con el token de un usuario, confirmar que un `ejecutivo`
no ve otra sede de su misma organización, confirmar que `platform_owner` no
tiene acceso de lectura a tablas de tenant).

## Stack

Next.js (App Router) + Tailwind CSS + Supabase (`@supabase/ssr`,
`@supabase/supabase-js`). Server Components + Server Actions,
`createClient()` (RLS-bound) vs `createAdminClient()` (service-role,
server-only) — ver `src/lib/supabase/`.
