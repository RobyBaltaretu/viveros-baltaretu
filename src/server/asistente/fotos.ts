import type { Propuesta, Repositorios, Usuario } from '../data/tipos.ts';
import { PREFIJO_FOTO } from '../contenido/validacion.ts';
import { altPropuesto, fotosDeFicha, MAXIMO_FOTO, tipoDeImagen } from '../panel/fotos.ts';
import { puede } from '../panel/permisos.ts';
import { guardarPlanta, type DatosPlanta } from '../panel/plantas.ts';

/**
 * Fotos enviadas en el chat de AgricolAI: cada una va a la planta que la persona
 * elige. Se guardan al enviarlas, pero no se ponen en ninguna ficha hasta que
 * pulsa «Sí» (con «No» se borran). Nada pasa por el modelo de IA.
 */
export const HERRAMIENTA_FOTOS = '__fotos';
export const MAXIMO_FOTOS_CHAT = 10;

export interface FotoChat {
  planta: string;
  ruta: string;
}

const nombreDe = (d: DatosPlanta, id: string) => String(d.nombre?.es ?? id);
/** Solo rutas creadas aquí para esa planta (los argumentos nunca vienen de fuera, pero se comprueba igual). */
const rutaValida = (f: FotoChat) => /^[a-z0-9-]+$/.test(f.planta) && new RegExp(`^catalogo/${f.planta}/foto-[a-z0-9]+-\\d+\\.(jpg|png|webp)$`).test(f.ruta);

function resumenFotos(fotos: FotoChat[], nombres: Map<string, string>): string {
  const porPlanta = new Map<string, number>();
  for (const f of fotos) porPlanta.set(f.planta, (porPlanta.get(f.planta) ?? 0) + 1);
  const partes = [...porPlanta].map(([id, n]) => `${n} a ${nombres.get(id) ?? id}`);
  return `Añadir ${fotos.length === 1 ? '1 foto' : `${fotos.length} fotos`}: ${partes.join(', ')}. Saldrán en la web al publicar.`;
}

export type ResultadoEnvio = { ok: true; propuesta: Propuesta } | { ok: false; error: string };

/** Guarda las fotos enviadas y deja la propuesta para confirmar con «Sí». */
export async function prepararFotos(repos: Repositorios, usuario: Usuario, conversacion: string, archivos: { bytes: Uint8Array; planta: string }[]): Promise<ResultadoEnvio> {
  if (!puede(usuario.rol, 'editar')) return { ok: false, error: 'Tu usuario no puede añadir fotos.' };
  if (!archivos.length) return { ok: false, error: 'No ha llegado ninguna foto.' };
  if (archivos.length > MAXIMO_FOTOS_CHAT) return { ok: false, error: `Como mucho ${MAXIMO_FOTOS_CHAT} fotos de una vez.` };
  const nombres = new Map<string, string>();
  for (const a of archivos) {
    if (!a.planta) return { ok: false, error: 'Elige de qué planta es cada foto.' };
    if (!nombres.has(a.planta)) {
      const e = await repos.contenido.obtener('catalogo', a.planta);
      if (!e) return { ok: false, error: 'Una de las plantas elegidas ya no está en el catálogo.' };
      nombres.set(a.planta, nombreDe(e.borrador.datos as DatosPlanta, a.planta));
    }
    if (!a.bytes.byteLength) return { ok: false, error: 'Una de las fotos está vacía.' };
    if (a.bytes.byteLength > MAXIMO_FOTO) return { ok: false, error: 'Una de las fotos es demasiado grande. Prueba con otra o hazla de nuevo con el móvil.' };
    if (!tipoDeImagen(a.bytes)) return { ok: false, error: 'Uno de los archivos no es una foto. Usa fotos JPG, PNG o WebP.' };
  }
  const marca = Date.now().toString(36);
  const fotos: FotoChat[] = [];
  for (const [i, a] of archivos.entries()) {
    const tipo = tipoDeImagen(a.bytes)!;
    const ruta = `catalogo/${a.planta}/foto-${marca}-${i}.${tipo.ext}`;
    await repos.fotos.guardar({ ruta, tipo: tipo.tipo, bytes: a.bytes }, usuario.email);
    fotos.push({ planta: a.planta, ruta });
  }
  const propuesta: Propuesta = {
    id: crypto.randomUUID(),
    conversacion,
    email: usuario.email,
    herramienta: HERRAMIENTA_FOTOS,
    argumentos: { fotos },
    resumen: resumenFotos(fotos, nombres),
    estado: 'pendiente',
    resultado: '',
    creada: new Date().toISOString(),
  };
  await repos.conversaciones.guardarPropuesta(propuesta);
  return { ok: true, propuesta };
}

const fotosDe = (p: Pick<Propuesta, 'argumentos'>) => ((p.argumentos.fotos as FotoChat[] | undefined) ?? []).filter(rutaValida);

/** «Sí»: pone cada foto en su ficha (con su texto alternativo propuesto) y valida como el panel. */
export async function aplicarFotos(repos: Repositorios, usuario: Usuario, p: Pick<Propuesta, 'argumentos'>): Promise<{ ok: boolean; texto: string }> {
  if (!puede(usuario.rol, 'editar')) return { ok: false, texto: 'Tu usuario no puede añadir fotos.' };
  const porPlanta = new Map<string, string[]>();
  for (const f of fotosDe(p)) porPlanta.set(f.planta, [...(porPlanta.get(f.planta) ?? []), f.ruta]);
  let puestas = 0;
  const fallos: string[] = [];
  for (const [planta, rutas] of porPlanta) {
    const e = await repos.contenido.obtener('catalogo', planta);
    if (!e) {
      fallos.push(`${planta} ya no está`);
      continue;
    }
    const d = e.borrador.datos as DatosPlanta;
    const nuevas = [];
    for (const ruta of rutas) if (await repos.fotos.obtener(ruta)) nuevas.push({ imagen: PREFIJO_FOTO + ruta, alt: altPropuesto(d) });
    const r = await guardarPlanta(repos, planta, { ...d, fotos: [...fotosDeFicha(d), ...nuevas] }, { email: usuario.email, origen: 'asistente' });
    if (r.ok) puestas += nuevas.length;
    else fallos.push(`${nombreDe(d, planta)}: ${r.errores[0]?.mensaje ?? 'no vale'}`);
  }
  if (!puestas) return { ok: false, texto: fallos.join('. ') || 'No se ha podido añadir ninguna foto.' };
  return { ok: true, texto: `${puestas === 1 ? 'Foto añadida' : `${puestas} fotos añadidas`} como borrador: revisa su texto en «Fotos» y publica para que salgan en la web.${fallos.length ? ` No se pudo con ${fallos.join(', ')}.` : ''}` };
}

/** «No»: las fotos no se quedan guardadas. */
export async function descartarFotos(repos: Repositorios, p: Pick<Propuesta, 'argumentos'>) {
  for (const f of fotosDe(p)) await repos.fotos.borrar(f.ruta);
}

/** Rutas para enseñar las miniaturas en la conversación. */
export const miniaturas = (p: Pick<Propuesta, 'argumentos' | 'herramienta'>) => (p.herramienta === HERRAMIENTA_FOTOS ? fotosDe(p).map((f) => `/api/panel/foto?ruta=${encodeURIComponent(f.ruta)}`) : []);
