import baltaretu from '../../clientes/baltaretu/cliente.config.json';
import { esquemaCliente, moduloActivo, type ConfiguracionCliente, type Modulo } from './configuracion.ts';
import { moduloDeHerramienta, parteDeRuta, sectorDeHerramienta } from './modulos.ts';

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

/** Una ruta existe si su módulo está activo y, si es de un sector, el cliente es de ese sector. */
export function rutaDisponible(ruta: string): boolean {
  const { modulo, sector } = parteDeRuta(ruta);
  return permitido(modulo) && (!sector || sector === clienteActual().sector);
}

/** Lo mismo para una herramienta del asistente (que además necesita el módulo `asistente`). */
export function herramientaDisponible(h: { nombre: string; permiso: string }): boolean {
  const sector = sectorDeHerramienta(h);
  return moduloActivoAhora('asistente') && permitido(moduloDeHerramienta(h)) && (!sector || sector === clienteActual().sector);
}
