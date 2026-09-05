import { createClient } from "@supabase/supabase-js";
import type { Database } from "./types";

/**
 * Cliente con la service_role key: ignora RLS por completo. Nunca importar
 * esto desde un componente cliente ni exponer su resultado sin antes
 * verificar el rol de quien hace la llamada con el cliente normal
 * (`@/lib/supabase/server`).
 */
export function createAdminClient() {
  return createClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } },
  );
}
