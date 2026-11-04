import { clienteActual } from '../../plataforma/actual.ts';

/** Cloudflare Workers AI Free: 10.000 neuronas/día por cuenta. Reparto interno objetivo. */
export const NEURONAS_FREE_DIA = 10_000;
export const LIMITE_NEURONAS_DIA = 4_000; // Baltaretu: 40%
export const LIMITE_NEURONAS_TURIA = 6_000; // Turia: 60%
/** Estimación de consumo por ticket a partir de la línea base existente; no es una lectura de Cloudflare. */
export const NEURONAS_RESERVA_TICKET = 70;

export function limiteNeuronasCliente(cliente: string = clienteActual().id): number {
  return cliente === 'turia' ? LIMITE_NEURONAS_TURIA : LIMITE_NEURONAS_DIA;
}
