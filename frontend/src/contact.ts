import { Linking } from 'react-native';

const WHATSAPP_NUMBER = '528714633372';

export function openWhatsApp(message: string) {
  const url = `https://wa.me/${WHATSAPP_NUMBER}?text=${encodeURIComponent(message)}`;
  Linking.openURL(url).catch(() => {});
}

export function openPhone(phone = '+528714633372') {
  Linking.openURL(`tel:${phone}`).catch(() => {});
}

export function openEmail(email = 'Suarezmaiky25@gmail.com', subject = 'Consulta') {
  Linking.openURL(`mailto:${email}?subject=${encodeURIComponent(subject)}`).catch(() => {});
}

export function openSms(phone = '+528714633372') {
  Linking.openURL(`sms:${phone}`).catch(() => {});
}

export const waMessages = {
  general: 'Hola, Miguel. Me gustaría hacer una consulta sobre tu servicio de barbería a domicilio.',
  weekday: `Hola, Miguel. Me interesa solicitar una cita entre semana.\n\nNombre:\nServicio:\nColonia:\nDirección aproximada:\nDía deseado:\nHorario deseado:\nNota:\n\nEntiendo que el horario está sujeto a disponibilidad y confirmación.`,
  zoneCheck: (zone = '') => `Hola, Miguel. Quisiera consultar la disponibilidad y si aplica algún recargo de traslado en la colonia ${zone || '____'} en Torreón.`,
  group: 'Hola, Miguel. Me interesa cotizar un servicio para varias personas.\n\nNombre:\nFecha:\nUbicación:\nNúmero de personas:\nServicios requeridos:\nHora en la que todos deben estar listos:\nInformación adicional:',
  service: (name: string) => `Hola, Miguel. Me interesa el servicio de ${name}. ¿Podrías darme más información?`,
};
