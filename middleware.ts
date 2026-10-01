import { type NextRequest } from "next/server";
import { updateSession } from "@/lib/supabase/middleware";

export async function middleware(request: NextRequest) {
  return updateSession(request);
}

export const config = {
  // "api" afuera a propósito: las rutas /api/* (ej. el cron de cierre de
  // caja) no tienen cookie de sesión — las llama Vercel Cron server-to-
  // server, no un usuario logueado — y manejan su propia autorización
  // (ver /api/cron/cerrar-cajas, que valida CRON_SECRET a mano). Dejarlas
  // acá adentro las mandaría siempre a /login y el cron nunca se dispararía.
  matcher: [
    "/((?!api|_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
