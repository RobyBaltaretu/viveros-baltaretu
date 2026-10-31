import type { IaCliente } from '../../plataforma/configuracion.ts';
import type { RepositorioUsoSimulador } from '../data/tipos.ts';
import { generateRenovationImage, type RenovationAiResult } from '../../services/renovationAiService.ts';
import type { RenovationConfig } from './materiales.ts';

/**
 * Tope mensual del simulador: cada simulación se aparta en D1 antes de llamar
 * a la IA (de pago) y se devuelve si falla, así el gasto nunca pasa del tope
 * aunque haya peticiones a la vez.
 */

/** Mes de España («2026-10»): el contador se renueva el día 1 a medianoche. */
export function mesDe(ahora = new Date()): string {
  return ahora.toLocaleDateString('sv-SE', { timeZone: 'Europe/Madrid' }).slice(0, 7);
}

/** A partir del 80 % se avisa; al 100 %, no se puede simular hasta el mes que viene. */
export const AVISO_DESDE = 0.8;

export interface EstadoCuota {
  usos: number;
  limite: number;
  quedan: number;
  porcentaje: number;
  aviso: boolean;
  agotada: boolean;
}

export function estadoCuota(usos: number, limite: number): EstadoCuota {
  const quedan = Math.max(0, limite - usos);
  const porcentaje = limite > 0 ? Math.min(100, Math.round((usos / limite) * 100)) : 100;
  return { usos, limite, quedan, porcentaje, aviso: limite > 0 && usos >= Math.ceil(limite * AVISO_DESDE), agotada: usos >= limite };
}

export const AVISO_AGOTADA = 'Has llegado al tope de simulaciones de este mes. El servicio se reactiva el día 1 del mes que viene.';

/** Tamaño máximo de cada imagen que llega (en base64): de sobra para 1024 px. */
export const MAXIMO_IMAGEN = 3_000_000;

export interface Simulacion {
  estado: number;
  cuerpo: RenovationAiResult & { cuota?: EstadoCuota };
}

/** Atiende una simulación: comprueba el tope, aparta una, llama a la IA y la devuelve si falla. */
export async function simular(
  entrada: { cliente: string; ia: Pick<IaCliente, 'simulador' | 'modelos' | 'simulacionesMes'>; apiKey?: string; uso: RepositorioUsoSimulador; ahora?: Date },
  peticion: { image: string; mascara?: string; config: RenovationConfig },
  generar: typeof generateRenovationImage = generateRenovationImage,
): Promise<Simulacion> {
  const { cliente, ia, uso } = entrada;
  if (ia.simulador !== 'gemini') return { estado: 404, cuerpo: { ok: false, error: 'El simulador no está activo.' } };
  if (!entrada.apiKey) return { estado: 503, cuerpo: { ok: false, error: 'Falta configurar la IA del simulador (el secreto GEMINI_API_KEY del Worker). Avisa a quien lleva el panel.' } };
  for (const img of [peticion.image, peticion.mascara]) {
    if (img !== undefined && (typeof img !== 'string' || img.length > MAXIMO_IMAGEN || !/^data:image\/(jpeg|webp|png);base64,/.test(img)))
      return { estado: 400, cuerpo: { ok: false, error: 'La foto tiene que ser JPEG, WebP o PNG y de 1024 px como mucho.' } };
  }
  const mes = mesDe(entrada.ahora);
  const limite = ia.simulacionesMes;
  if (!(await uso.reservar(cliente, mes, limite))) return { estado: 403, cuerpo: { ok: false, error: AVISO_AGOTADA, cuota: estadoCuota(await uso.usos(cliente, mes), limite) } };

  let r: RenovationAiResult;
  try {
    r = await generar(peticion.image, peticion.config, { apiKey: entrada.apiKey, modelo: ia.modelos.gemini, mascara: peticion.mascara });
  } catch {
    r = { ok: false, error: 'La IA no ha podido generar la imagen. Vuelve a intentarlo en un rato.' };
  }
  // Si no hay imagen no se cobra al cliente: la simulación vuelve al cupo.
  if (!r.ok) await uso.devolver(cliente, mes);
  const cuota = estadoCuota(await uso.usos(cliente, mes), limite);
  const estado = r.ok ? 200 : r.estado === 429 || r.estado === 402 ? r.estado : 502;
  return { estado, cuerpo: { ...r, estado: undefined, promptUsed: undefined, cuota } };
}
