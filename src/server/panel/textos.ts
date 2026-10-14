import type { z } from 'astro/zod';
import { ICONOS_CONFIANZA } from '../../lib/portada/schema';
import { esquemaDe, type ErrorCampo } from '../contenido/validacion.ts';
import type { Autor, Coleccion, Documento, Repositorios } from '../data/tipos.ts';
import { numero, slugDesde } from './plantas.ts';

/**
 * Textos de la web en el panel: empresa, condiciones, portada, textos del
 * catálogo, páginas fijas, proyectos y guías. El formulario se dibuja a partir
 * de los datos que ya hay (texto, sí/no, número, español + inglés, listas) y se
 * valida con el mismo esquema que el build antes de guardar como borrador.
 */
export interface Seccion {
  coleccion: Coleccion;
  id: string;
  titulo: string;
  ayuda: string;
  /** Partes para no meter toda la portada en una sola pantalla. */
  partes?: { clave: string; titulo: string; campos: string[] }[];
}

export const SECCIONES: Seccion[] = [
  { coleccion: 'ajustes', id: 'empresa', titulo: 'Datos de la empresa', ayuda: 'Teléfono, WhatsApp, correo y dirección.' },
  { coleccion: 'ajustes', id: 'condiciones', titulo: 'Condiciones de venta', ayuda: 'Pedido mínimo, plazos y envío por unidad.' },
  {
    coleccion: 'ajustes',
    id: 'portada',
    titulo: 'Portada',
    ayuda: 'Los textos de la primera página.',
    partes: [
      { clave: 'arriba', titulo: 'Lo primero que se ve', campos: ['titular', 'titularDestacado', 'entradilla'] },
      { clave: 'familias', titulo: 'Qué cultivamos', campos: ['familiasTitulo', 'familiasTexto'] },
      { clave: 'comprar', titulo: 'Formas de comprar', campos: ['comprarTitulo', 'mayorTitulo', 'mayorTexto', 'unidadTitulo', 'unidadTexto'] },
      { clave: 'pasos', titulo: 'Pasos para pedir', campos: ['pasosTitulo', 'pasos'] },
      { clave: 'confianza', titulo: 'Por qué confiar en nosotros', campos: ['confianzaTitulo', 'confianza'] },
      { clave: 'nosotros', titulo: 'Misión y visión', campos: ['mision', 'vision'] },
      { clave: 'final', titulo: 'Llamada final', campos: ['llamadaTitulo', 'llamadaTexto'] },
    ],
  },
  { coleccion: 'ajustes', id: 'catalogo', titulo: 'Textos del catálogo', ayuda: 'La entrada del catálogo y de cada familia.' },
  { coleccion: 'paginas', id: 'nosotros', titulo: 'Página «Nosotros»', ayuda: 'Quiénes sois.' },
  { coleccion: 'paginas', id: 'reparto', titulo: 'Página «Reparto»', ayuda: 'Zonas, plazos y envíos.' },
  { coleccion: 'paginas', id: 'aviso-legal', titulo: 'Aviso legal', ayuda: 'Lo revisa el asesor.' },
  { coleccion: 'paginas', id: 'privacidad', titulo: 'Privacidad', ayuda: 'Lo revisa el asesor.' },
  { coleccion: 'paginas', id: 'cookies', titulo: 'Cookies', ayuda: 'Lo revisa el asesor.' },
];

/** Colecciones con varias entradas que se pueden crear y quitar. */
export const LISTAS = {
  proyectos: { titulo: 'Proyectos', singular: 'proyecto', ayuda: 'Trabajos hechos, con las plantas usadas.' },
  guias: { titulo: 'Guías', singular: 'guía', ayuda: 'Consejos para tus clientes.' },
} as const;
export type ColeccionLista = keyof typeof LISTAS;
export const esLista = (c: string): c is ColeccionLista => c in LISTAS;

export const seccionDe = (coleccion: string, id: string) => SECCIONES.find((s) => s.coleccion === coleccion && s.id === id);

/** Nombres en español llano de cada dato. */
export const ETIQUETAS: Record<string, string> = {
  nombre: 'Nombre de la empresa',
  telefono: 'Teléfono',
  whatsapp: 'WhatsApp (solo números, con 34 delante)',
  email: 'Correo electrónico',
  direccion: 'Dirección',
  pedidoMinimo: 'Pedido mínimo',
  plazosMayor: 'Plazos de entrega al por mayor',
  envioUnidad: 'Envío de plantas sueltas',
  titular: 'Titular',
  titularDestacado: 'Final del titular (se ve resaltado)',
  entradilla: 'Texto de entrada',
  familiasTitulo: 'Título',
  familiasTexto: 'Texto',
  comprarTitulo: 'Título',
  mayorTitulo: 'Al por mayor: título',
  mayorTexto: 'Al por mayor: texto',
  unidadTitulo: 'Por unidad: título',
  unidadTexto: 'Por unidad: texto',
  pasosTitulo: 'Título',
  pasos: 'Pasos',
  confianzaTitulo: 'Título',
  confianza: 'Motivos',
  icono: 'Dibujo',
  mision: 'Misión',
  vision: 'Visión',
  llamadaTitulo: 'Título',
  llamadaTexto: 'Texto',
  titulo: 'Título',
  texto: 'Texto',
  resumen: 'Resumen',
  secciones: 'Apartados',
  seoDescripcion: 'Resumen para Google (una o dos frases)',
  ubicacion: 'Dónde se hizo',
  especies: 'Plantas usadas',
  pendienteRevision: 'Pendiente de revisar por el asesor',
  revisado: 'Está revisado y se puede publicar',
  datosDeEjemplo: 'Es un ejemplo (no se publica)',
  catalogo: 'Catálogo completo',
  palmeras: 'Palmeras',
  olivos: 'Olivos',
  higueras: 'Higueras',
  'otras-ornamentales': 'Otras ornamentales',
};

export const OPCIONES: Record<string, readonly string[]> = { icono: ICONOS_CONFIANZA };
export const NOMBRES_ICONO: Record<string, string> = { origen: 'Origen', documentacion: 'Documentación', reparto: 'Reparto', calidad: 'Calidad' };

/** Campos que no se editan con el formulario genérico. */
export const OCULTOS = new Set(['slug', 'fotos']);

/** Campos con texto largo (área de texto). */
export const LARGOS = new Set(['texto', 'entradilla', 'resumen', 'mayorTexto', 'unidadTexto', 'familiasTexto', 'llamadaTexto', 'mision', 'vision', 'seoDescripcion', 'pedidoMinimo', 'plazosMayor', 'envioUnidad', 'direccion']);

export const etiqueta = (ruta: string) => {
  const partes = ruta.split('.').filter((p) => !/^\d+$/.test(p) && p !== 'es' && p !== 'en');
  return ETIQUETAS[partes[partes.length - 1]] ?? partes[partes.length - 1];
};

type Valor = unknown;
const esBilingue = (v: Valor): v is { es: string; en: string } =>
  !!v && typeof v === 'object' && !Array.isArray(v) && Object.keys(v).sort().join() === 'en,es';

/** Copia vacía de un elemento de lista, para "Añadir otro". */
export function vacio(v: Valor): Valor {
  if (typeof v === 'string') return '';
  if (typeof v === 'number') return null;
  if (typeof v === 'boolean') return false;
  if (Array.isArray(v)) return [];
  if (v && typeof v === 'object') return Object.fromEntries(Object.entries(v).map(([k, x]) => [k, k === 'icono' ? x : vacio(x)]));
  return v;
}

function poner(objeto: Record<string, unknown>, ruta: string[], valor: unknown) {
  let actual: Record<string, unknown> | unknown[] = objeto;
  for (let i = 0; i < ruta.length - 1; i++) actual = (actual as Record<string, unknown>)[ruta[i]] as Record<string, unknown>;
  (actual as Record<string, unknown>)[ruta[ruta.length - 1]] = valor;
}
function leer(objeto: unknown, ruta: string[]): unknown {
  return ruta.reduce<unknown>((o, k) => (o == null ? undefined : (o as Record<string, unknown>)[k]), objeto);
}

/**
 * Aplica el formulario a los datos. Los campos van como `d:ruta.con.puntos`;
 * las casillas declaradas en `casillas` valen `false` si no llegan.
 * `accion` puede añadir (`agregar:ruta`) o quitar (`quitar:ruta.indice`) elementos de una lista.
 */
export function aplicarFormulario(form: FormData, base: Record<string, unknown>): Record<string, unknown> {
  const d = structuredClone(base);
  for (const [nombre, valor] of form.entries()) {
    if (!nombre.startsWith('d:') || typeof valor !== 'string') continue;
    const ruta = nombre.slice(2).split('.');
    const anterior = leer(d, ruta);
    if (ruta.includes('__proto__') || ruta.includes('constructor')) continue;
    if (anterior === undefined) continue;
    if (typeof anterior === 'number' || (anterior === null && ruta[ruta.length - 1] !== 'titulo')) poner(d, ruta, numero(valor));
    else poner(d, ruta, valor.trim());
  }
  for (const ruta of form.getAll('casilla').map(String)) {
    if (leer(d, ruta.split('.')) !== undefined) poner(d, ruta.split('.'), form.get(`d:${ruta}`) === '1');
  }
  // Listas de opciones marcadas (por ejemplo, las plantas de un proyecto).
  for (const ruta of form.getAll('lista').map(String)) {
    if (Array.isArray(leer(d, ruta.split('.')))) poner(d, ruta.split('.'), form.getAll(`l:${ruta}`).map(String));
  }
  const accion = String(form.get('accion') ?? '');
  const [tipo, rutaLista] = accion.split(':');
  if (rutaLista && (tipo === 'agregar' || tipo === 'quitar')) {
    const ruta = rutaLista.split('.');
    if (tipo === 'agregar') {
      const lista = leer(d, ruta);
      if (Array.isArray(lista)) lista.push(vacio(lista[0] ?? { titulo: { es: '', en: '' }, texto: { es: '', en: '' } }));
    } else {
      const indice = Number(ruta.pop());
      const lista = leer(d, ruta);
      if (Array.isArray(lista) && Number.isInteger(indice)) lista.splice(indice, 1);
    }
  }
  return d;
}

/** Errores del esquema en español llano, con la ruta del campo. */
export function validarTextos(coleccion: Coleccion, id: string, datos: Record<string, unknown>): ErrorCampo[] {
  const esquema = esquemaDe(coleccion, id) as z.ZodType | null;
  if (!esquema) return [{ campo: '', mensaje: 'Esta parte de la web no existe.' }];
  const r = esquema.safeParse(datos);
  if (r.success) return [];
  return r.error.issues.map((i) => {
    const campo = i.path.join('.');
    const nombre = etiqueta(campo);
    const idioma = i.path.at(-1) === 'en' ? ' (en inglés)' : i.path.at(-1) === 'es' ? ' (en español)' : '';
    const mensaje =
      i.code === 'too_small' ? `Falta: ${nombre}${idioma}.` : i.code === 'too_big' ? `${nombre}: hay demasiados.` : `${nombre}${idioma}: revisa este dato.`;
    return { campo, mensaje };
  });
}

export async function guardarTextos(repos: Repositorios, coleccion: Coleccion, id: string, datos: Record<string, unknown>, cuerpo: string, autor: Autor) {
  const errores = validarTextos(coleccion, id, datos);
  if (errores.length) return { ok: false as const, errores };
  const documento: Documento = { datos, cuerpo };
  await repos.contenido.guardarBorrador(coleccion, id, documento, autor);
  return { ok: true as const, errores: [] };
}

const bil = () => ({ es: '', en: '' });

/** Plantilla para crear un proyecto o una guía nuevos. */
export function plantilla(coleccion: ColeccionLista): Record<string, unknown> {
  const comun = { titulo: bil(), resumen: bil(), secciones: [{ titulo: bil(), texto: bil() }], seoDescripcion: bil(), datosDeEjemplo: false, revisado: false };
  return coleccion === 'proyectos' ? { ...comun, ubicacion: '', especies: [], fotos: [] } : comun;
}

/** Identificador libre a partir del título. */
export async function idNuevo(repos: Repositorios, coleccion: Coleccion, titulo: string) {
  const raiz = slugDesde(titulo) || coleccion.slice(0, -1);
  let id = raiz;
  for (let i = 2; await repos.contenido.obtener(coleccion, id); i++) id = `${raiz}-${i}`;
  return id;
}

export { esBilingue };
