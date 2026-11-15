-- Seguridad: bloqueo de login solo desde el servidor.
--
-- check_login_lockout y record_login_attempt eran ejecutables por cualquiera
-- con la anon key (que es publica, va en el navegador). Eso permitia:
--   * bloquear a cualquier usuario: 5 llamadas con success=false al email
--     de otra persona lo dejaban sin poder entrar 15 minutos, una y otra vez;
--   * saltarse el bloqueo: una llamada con success=true entre intento e
--     intento borra la cuenta de fallos y permite adivinar contrasenas.
-- La app ahora las llama con service role (src/app/login/actions.ts), asi que
-- se les quita el permiso a anon y authenticated.
--
-- ORDEN: correr esto DESPUES de que el cambio de codigo este desplegado en
-- Vercel. Si se corre antes, el login falla hasta que se despliegue.
-- Para volver atras: grant execute on function ... to anon, authenticated;

revoke execute on function public.check_login_lockout(text) from public, anon, authenticated;
revoke execute on function public.record_login_attempt(text, boolean) from public, anon, authenticated;
grant execute on function public.check_login_lockout(text) to service_role;
grant execute on function public.record_login_attempt(text, boolean) to service_role;

-- Verificacion: anon y authenticated deben dar false; service_role true.
select
  has_function_privilege('anon', 'public.check_login_lockout(text)', 'execute')          as anon_check,
  has_function_privilege('authenticated', 'public.record_login_attempt(text, boolean)', 'execute') as auth_record,
  has_function_privilege('service_role', 'public.check_login_lockout(text)', 'execute')  as service_check;
