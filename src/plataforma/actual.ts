import baltaretu from '../../clientes/baltaretu/cliente.config.json';
import { esquemaCliente, moduloActivo, type ConfiguracionCliente, type Modulo } from './configuracion.ts';
import { esDeLaWeb, herramientaDeLaWeb, moduloDeHerramienta, parteDeRuta, sectorDeHerramienta } from './modulos.ts';

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

/**
 * Una ruta existe si su módulo está activo, si es de un sector el cliente es de
 * ese sector y, si es de la web pública, el cliente tiene web pública.
 */
export function rutaDisponible(ruta: string): boolean {
  const { modulo, sector } = parteDeRuta(ruta);
  const c = clienteActual();
  return permitido(modulo) && (!sector || sector === c.sector) && (c.webPublica || !esDeLaWeb(ruta));
}

/** Lo mismo para una herramienta del asistente (que además necesita el módulo `asistente`). */
export function herramientaDisponible(h: { nombre: string; permiso: string }): boolean {
  const sector = sectorDeHerramienta(h);
  const c = clienteActual();
  return moduloActivoAhora('asistente') && permitido(moduloDeHerramienta(h)) && (!sector || sector === c.sector) && (c.webPublica || !herramientaDeLaWeb(h));
}
