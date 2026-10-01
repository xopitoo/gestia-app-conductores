/**
 * Envío de correos vía Resend (misma cuenta que ya usa el otro proyecto,
 * ceapp-aula-virtual — acá solo hace falta la misma RESEND_API_KEY como
 * variable de entorno). Nunca lanza: un correo que falla no debe tumbar la
 * acción real (cerrar caja, etc.) — solo se deja constancia en los logs.
 */
export async function sendEmail({
  to,
  subject,
  html,
}: {
  to: string;
  subject: string;
  html: string;
}): Promise<void> {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) {
    console.error(`[email] RESEND_API_KEY no configurada — no se pudo enviar "${subject}"`);
    return;
  }

  try {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: process.env.RESEND_FROM_EMAIL || "onboarding@resend.dev",
        to: [to],
        subject,
        html,
      }),
    });

    if (!res.ok) {
      console.error(`[email] Resend respondió ${res.status} para "${subject}":`, await res.text());
    }
  } catch (err) {
    console.error(`[email] Error de red enviando "${subject}":`, err);
  }
}
