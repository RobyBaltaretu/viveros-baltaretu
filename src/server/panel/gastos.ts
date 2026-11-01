import type { Gasto, Repositorios } from '../data/tipos.ts';
import { avisosDe, gastoVacio, hoy } from '../gastos/gastos.ts';
import { LIMITE_DIARIO_TICKETS, type LectorTickets } from '../gastos/lector.ts';
import { MAXIMO_FOTO, tipoDeImagen } from './fotos.ts';

/**
 * Alta de un gasto desde la foto de un ticket: guarda la foto, la lee si hay
 * lector y cupo, y deja el gasto «por revisar» con lo leído. Nunca se da por
 * bueno sin que una persona lo revise y lo guarde.
 */
export type ResultadoTicket =
  | { ok: true; gasto: Gasto; leido: 'si' | 'no' | 'sin-lector' | 'sin-cupo' }
  | { ok: false; mensaje: string };

export async function gastoDesdeTicket(repos: Repositorios, email: string, bytes: Uint8Array, lector: LectorTickets | null): Promise<ResultadoTicket> {
  if (bytes.byteLength === 0) return { ok: false, mensaje: 'Elige la foto del ticket.' };
  if (bytes.byteLength > MAXIMO_FOTO) return { ok: false, mensaje: 'La foto es demasiado grande. Hazla de nuevo con el móvil o elige otra.' };
  const tipo = tipoDeImagen(bytes);
  if (!tipo) return { ok: false, mensaje: 'Ese archivo no es una foto. Usa una foto JPG, PNG o WebP.' };

  const gasto = gastoVacio(email);
  gasto.ticketId = crypto.randomUUID();
  await repos.tickets.guardar({ id: gasto.ticketId, tipo: tipo.tipo, bytes }, email);

  let leido: 'si' | 'no' | 'sin-lector' | 'sin-cupo' = 'sin-lector';
  if (lector) {
    // Mismo contador diario que el asistente, con su propia clave.
    const usos = await repos.usoAsistente.sumar(`tickets:${email}`, hoy());
    if (usos > LIMITE_DIARIO_TICKETS) leido = 'sin-cupo';
    else {
      const l = await lector.leer(bytes, tipo.tipo);
      leido = l ? 'si' : 'no';
      if (l) {
        Object.assign(gasto, {
          proveedor: l.proveedor,
          nifProveedor: l.nifProveedor,
          fecha: l.fecha || gasto.fecha,
          lineas: l.lineas,
          base: l.base,
          iva: l.iva,
          total: l.total ?? 0,
          formaPago: l.formaPago || gasto.formaPago,
          categoria: l.categoria,
          leidoAutomaticamente: true,
          ...(l.contactoProveedor ? { contactoProveedor: l.contactoProveedor } : {}),
        });
        gasto.avisos = [...(l.fecha ? [] : ['No se ha podido leer la fecha: se ha puesto la de hoy.']), ...avisosDe(gasto)];
      }
    }
  }
  await repos.gastos.guardar(gasto);
  await repos.auditoria.registrar(email, 'gasto desde ticket', `${gasto.id} (${leido})`);
  return { ok: true, gasto, leido };
}

export const MENSAJE_LECTURA: Record<string, string> = {
  si: 'He leído el ticket. Revisa que todo esté bien y pulsa «Guardar el gasto».',
  no: 'No he podido leer bien el ticket. Escribe los datos mirando la foto.',
  'sin-lector': 'La lectura automática no está activada. Escribe los datos mirando la foto.',
  'sin-cupo': 'Hoy ya se han leído muchos tickets (el límite gratuito). Escribe los datos mirando la foto; mañana vuelve a leerlos solo.',
};
