import { esquemaCliente, moduloActivo, type ConfiguracionCliente, type Modulo } from './configuracion.ts';

/**
 * Cliente del build, inyectado por astro.config.mjs (ya validado allí). En el
 * prerender y en el Worker no hay sistema de archivos: se lee de la constante.
 */
let cache: ConfiguracionCliente | null = null;
export function clienteActual(): ConfiguracionCliente {
  return (cache ??= esquemaCliente.parse(JSON.parse(import.meta.env.CLIENTE_CONFIG)));
}

export const moduloActivoAhora = (m: Modulo) => moduloActivo(clienteActual(), m);
