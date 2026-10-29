import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { CLIENTE_POR_DEFECTO, validarCliente, type ConfiguracionCliente } from './configuracion.ts';

/**
 * Carga la configuración del cliente del build (Node: astro.config.mjs, scripts
 * y tests; nunca en el Worker). Sin `CLIENTE_ID`, Viveros Baltaretu. Un id
 * desconocido o una configuración no válida paran el build.
 */
export function cargarCliente(id: string | undefined = process.env.CLIENTE_ID, raiz = process.cwd()): ConfiguracionCliente {
  const elegido = id?.trim() || CLIENTE_POR_DEFECTO;
  if (!/^[a-z0-9][a-z0-9-]{1,40}$/.test(elegido)) throw new Error(`CLIENTE_ID no válido: «${elegido}»`);
  let texto: string;
  try {
    texto = readFileSync(join(raiz, 'clientes', elegido, 'cliente.config.json'), 'utf8');
  } catch {
    throw new Error(`No existe el cliente «${elegido}» (falta clientes/${elegido}/cliente.config.json)`);
  }
  return validarCliente(elegido, JSON.parse(texto));
}
