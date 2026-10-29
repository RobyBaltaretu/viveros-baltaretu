import baltaretu from '../../clientes/baltaretu/cliente.config.json';
import { esquemaCliente, moduloActivo, type ConfiguracionCliente, type Modulo } from './configuracion.ts';

/**
 * Cliente del build, inyectado por astro.config.mjs (ya validado allí). En el
 * prerender y en el Worker no hay sistema de archivos: se lee de la constante.
 * Sin ella (tests sin build), el cliente por defecto: Viveros Baltaretu.
 */
let leido: { texto: string; cliente: ConfiguracionCliente } | null = null;
export function clienteActual(): ConfiguracionCliente {
  const texto = import.meta.env.CLIENTE_CONFIG || JSON.stringify(baltaretu);
  if (leido?.texto !== texto) leido = { texto, cliente: esquemaCliente.parse(JSON.parse(texto)) };
  return leido.cliente;
}

export const moduloActivoAhora = (m: Modulo) => moduloActivo(clienteActual(), m);

/** Un módulo apagado no existe; null (núcleo) siempre está. */
export const permitido = (m: Modulo | null) => m === null || moduloActivoAhora(m);
