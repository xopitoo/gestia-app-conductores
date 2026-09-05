import { redirect } from "next/navigation";

/**
 * Cotizaciones desactivado por ahora (a pedido del cliente) — el código
 * queda intacto para reactivarlo más adelante, este layout solo corta el
 * acceso: ni el link del sidebar ni una URL directa llegan a renderizar
 * nada de la sección.
 */
export default function CotizacionesLayout() {
  redirect("/dashboard");
}
