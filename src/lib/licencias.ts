import { bogotaTodayYMD } from "./bogota-date";

export type CategoriaLicencia = "particular" | "publico";

export type ClienteLicencia = {
  id: string;
  nombreCompleto: string;
  telefonoPais: string | null;
  telefono: string | null;
  correoElectronico: string | null;
  categoria: CategoriaLicencia;
  fechaVencimiento: string;
  /** Negativo = ya venció hace esos días; 0 = vence hoy; positivo = faltan esos días. */
  diasParaVencer: number;
  /** true si el cliente es de C.R.C. Valorar — ahí aplica el descuento por volver a renovar (ver whatsappLicenciaUrl). */
  esValorar: boolean;
};

/**
 * De una lista de clientes, arma los que tienen la licencia vencida o por
 * vencer dentro de los próximos `diasAdelante` días (por defecto un mes) —
 * para la campana de notificaciones, mismo criterio que
 * calcularProximosCumpleanos. A diferencia de los cumpleaños (que siempre
 * recurren a futuro), acá también se incluyen las ya vencidas
 * (diasParaVencer negativo) porque nadie las recalcula solas: alguien tiene
 * que llamar al cliente a renovar.
 */
export function calcularProximosVencimientosLicencia(
  clientes: {
    id: string;
    nombre_completo: string;
    licencia_particular_vence: string | null;
    licencia_publico_vence: string | null;
    telefono_pais: string | null;
    telefono: string | null;
    correo_electronico: string | null;
    /** true si el cliente es de C.R.C. Valorar. */
    es_valorar: boolean;
  }[],
  diasAdelante = 30,
): ClienteLicencia[] {
  const hoy = bogotaTodayYMD();
  const hoyUTC = Date.UTC(hoy.year, hoy.month - 1, hoy.day);

  const resultado: ClienteLicencia[] = [];

  function agregar(c: (typeof clientes)[number], categoria: CategoriaLicencia, fecha: string | null) {
    if (!fecha) return;
    const [year, month, day] = fecha.split("-").map(Number);
    if (!year || !month || !day) return;
    const fechaUTC = Date.UTC(year, month - 1, day);
    const diasParaVencer = Math.round((fechaUTC - hoyUTC) / (1000 * 60 * 60 * 24));
    if (diasParaVencer > diasAdelante) return;

    resultado.push({
      id: c.id,
      nombreCompleto: c.nombre_completo,
      telefonoPais: c.telefono_pais,
      telefono: c.telefono,
      correoElectronico: c.correo_electronico,
      categoria,
      fechaVencimiento: fecha,
      diasParaVencer,
      esValorar: c.es_valorar,
    });
  }

  for (const c of clientes) {
    agregar(c, "particular", c.licencia_particular_vence);
    agregar(c, "publico", c.licencia_publico_vence);
  }

  return resultado.sort((a, b) => a.diasParaVencer - b.diasParaVencer);
}

/** Monto del descuento por volver a renovar en C.R.C. Valorar (fijado por el usuario). */
const DESCUENTO_RENOVACION_VALORAR = "$20.000";

function mensajeLicencia(nombre: string, esValorar: boolean) {
  const base = `Hola ${nombre.split(" ")[0]}, te escribimos porque tu licencia de conducción está por vencer (o ya venció).`;
  if (esValorar) {
    return `${base} Te esperamos en C.R.C. Valorar para renovarla — por ser cliente que vuelve tenés ${DESCUENTO_RENOVACION_VALORAR} de descuento en el trámite. ¡Contáctanos!`;
  }
  return `${base} ¡Contáctanos para renovarla a tiempo!`;
}

/** Link de WhatsApp con un recordatorio de renovación pre-armado (con el
 * descuento por volver si es de C.R.C. Valorar) — wa.me solo acepta dígitos,
 * sin "+" ni espacios. */
export function whatsappLicenciaUrl(
  nombre: string,
  telefonoPais: string | null,
  telefono: string | null,
  esValorar: boolean,
) {
  if (!telefono) return null;
  const numero = `${telefonoPais ?? ""}${telefono}`.replace(/\D/g, "");
  if (!numero) return null;
  return `https://wa.me/${numero}?text=${encodeURIComponent(mensajeLicencia(nombre, esValorar))}`;
}

/** Link sms: con un recordatorio de renovación pre-armado (con el descuento
 * por volver si es de C.R.C. Valorar) — a diferencia de wa.me, el esquema
 * sms: sí acepta el "+" del indicativo de país. */
export function smsLicenciaUrl(
  nombre: string,
  telefonoPais: string | null,
  telefono: string | null,
  esValorar: boolean,
) {
  if (!telefono) return null;
  const numero = `${telefonoPais ?? ""}${telefono}`.trim();
  if (!numero) return null;
  return `sms:${numero}?body=${encodeURIComponent(mensajeLicencia(nombre, esValorar))}`;
}

/** mailto: con un recordatorio de renovación pre-armado (con el descuento
 * por volver si es de C.R.C. Valorar). */
export function emailLicenciaUrl(nombre: string, correo: string | null, esValorar: boolean) {
  if (!correo) return null;
  const asunto = "Recordatorio: renovación de tu licencia de conducción";
  return `mailto:${correo}?subject=${encodeURIComponent(asunto)}&body=${encodeURIComponent(mensajeLicencia(nombre, esValorar))}`;
}
