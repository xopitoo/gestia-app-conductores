import { bogotaTodayYMD } from "./bogota-date";

export type ClienteCumpleanos = {
  id: string;
  nombreCompleto: string;
  telefonoPais: string | null;
  telefono: string | null;
  correoElectronico: string | null;
  fechaNacimiento: string;
  /** 0 = hoy, 1 = mañana, etc. */
  diasParaCumplir: number;
  /** Edad que cumple en esa fecha (no la edad actual). */
  edadQueCumple: number;
};

/**
 * De una lista de clientes, arma los que cumplen años hoy o dentro de los
 * próximos `diasAdelante` días (por defecto una semana) — para la campana
 * de notificaciones, que sirve de recordatorio hasta que exista un módulo
 * de marketing que automatice el envío. Ignora año de nacimiento para el
 * cálculo del "próximo cumpleaños" (solo mes/día); si ya pasó este año,
 * cae en el mismo día del año siguiente.
 */
export function calcularProximosCumpleanos(
  clientes: {
    id: string;
    nombre_completo: string;
    fecha_nacimiento: string | null;
    telefono_pais: string | null;
    telefono: string | null;
    correo_electronico: string | null;
  }[],
  diasAdelante = 7,
): ClienteCumpleanos[] {
  const hoy = bogotaTodayYMD();
  const hoyUTC = Date.UTC(hoy.year, hoy.month - 1, hoy.day);

  const resultado: ClienteCumpleanos[] = [];

  for (const c of clientes) {
    if (!c.fecha_nacimiento) continue;
    const [nacYear, nacMonth, nacDay] = c.fecha_nacimiento.split("-").map(Number);
    if (!nacYear || !nacMonth || !nacDay) continue;

    let proximoAnio = hoy.year;
    let proximoUTC = Date.UTC(proximoAnio, nacMonth - 1, nacDay);
    if (proximoUTC < hoyUTC) {
      proximoAnio += 1;
      proximoUTC = Date.UTC(proximoAnio, nacMonth - 1, nacDay);
    }

    const diasParaCumplir = Math.round((proximoUTC - hoyUTC) / (1000 * 60 * 60 * 24));
    if (diasParaCumplir > diasAdelante) continue;

    resultado.push({
      id: c.id,
      nombreCompleto: c.nombre_completo,
      telefonoPais: c.telefono_pais,
      telefono: c.telefono,
      correoElectronico: c.correo_electronico,
      fechaNacimiento: c.fecha_nacimiento,
      diasParaCumplir,
      edadQueCumple: proximoAnio - nacYear,
    });
  }

  return resultado.sort((a, b) => a.diasParaCumplir - b.diasParaCumplir);
}

function mensajeCumpleanos(nombre: string) {
  return `¡Feliz cumpleaños, ${nombre.split(" ")[0]}! 🎉 Te deseamos un excelente día de parte de todo el equipo.`;
}

/** Link de WhatsApp con un saludo de cumpleaños pre-armado — wa.me solo
 * acepta dígitos, sin "+" ni espacios. */
export function whatsappCumpleanosUrl(nombre: string, telefonoPais: string | null, telefono: string | null) {
  if (!telefono) return null;
  const numero = `${telefonoPais ?? ""}${telefono}`.replace(/\D/g, "");
  if (!numero) return null;
  return `https://wa.me/${numero}?text=${encodeURIComponent(mensajeCumpleanos(nombre))}`;
}

/** Link sms: con un saludo de cumpleaños pre-armado — a diferencia de wa.me,
 * el esquema sms: sí acepta el "+" del indicativo de país. */
export function smsCumpleanosUrl(nombre: string, telefonoPais: string | null, telefono: string | null) {
  if (!telefono) return null;
  const numero = `${telefonoPais ?? ""}${telefono}`.trim();
  if (!numero) return null;
  return `sms:${numero}?body=${encodeURIComponent(mensajeCumpleanos(nombre))}`;
}

/** mailto: con un saludo de cumpleaños pre-armado. */
export function emailCumpleanosUrl(nombre: string, correo: string | null) {
  if (!correo) return null;
  const asunto = "¡Feliz cumpleaños!";
  return `mailto:${correo}?subject=${encodeURIComponent(asunto)}&body=${encodeURIComponent(mensajeCumpleanos(nombre))}`;
}
