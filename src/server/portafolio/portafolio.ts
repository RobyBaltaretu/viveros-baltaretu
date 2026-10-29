import { z } from 'astro/zod';
import type { ProyectoPortafolio, Repositorios } from '../data/tipos.ts';
import { MAXIMO_FOTO, tipoDeImagen } from '../panel/fotos.ts';

/**
 * Portafolio privado (carpintería): proyectos con sus fotos de antes y de
 * después de la reforma. Es del negocio, no de la web: las fotos van a
 * `adjuntos`, nunca a `fotos` (que se publican), y no pasan por el build.
 */
export const AMBITO = 'portafolio';
export const MAXIMO_FOTOS_POR_LADO = 8;
export type Lado = 'antes' | 'despues';

const texto = (max: number) => z.string().trim().max(max, `Como mucho ${max} letras.`);
export const esquemaProyecto = z.object({
  titulo: texto(120).min(1, 'Escribe un título.'),
  categoria: texto(60).default(''),
  descripcion: texto(2000).default(''),
  materiales: texto(500).default(''),
  anio: z.coerce.number().int('Escribe un año, por ejemplo 2025.').min(1950, 'Escribe un año, por ejemplo 2025.').max(2100, 'Escribe un año, por ejemplo 2025.').nullable().default(null),
  localidad: texto(80).default(''),
  destacado: z.boolean().default(false),
});
export type EntradaProyecto = z.input<typeof esquemaProyecto>;

type Resultado<T> = { ok: true } & T | { ok: false; error: string };

const sinTildes = (t: string) =>
  t
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase();
const slug = (t: string) =>
  sinTildes(t)
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 50) || 'proyecto';
const sufijo = () => Math.random().toString(36).slice(2, 7);

/** Crea un proyecto (id nuevo) o cambia sus datos (con `id`). Las fotos se cambian aparte. */
export async function guardarProyecto(repos: Repositorios, entrada: EntradaProyecto & { id?: string }, email: string): Promise<Resultado<{ proyecto: ProyectoPortafolio }>> {
  const r = esquemaProyecto.safeParse(entrada);
  if (!r.success) return { ok: false, error: r.error.issues[0]?.message ?? 'Revisa los datos.' };
  const previo = entrada.id ? await repos.portafolio.obtener(entrada.id) : null;
  if (entrada.id && !previo) return { ok: false, error: 'Ese proyecto no existe.' };
  const id = previo?.id ?? `${slug(r.data.titulo)}-${sufijo()}`;
  const orden = previo?.orden ?? (await repos.portafolio.listar({ incluirArchivados: true })).length;
  await repos.portafolio.guardar({ id, ...r.data, antes: previo?.antes ?? [], despues: previo?.despues ?? [], orden }, email);
  return { ok: true, proyecto: (await repos.portafolio.obtener(id))! };
}

/** Añade una foto de antes o de después. Comprueba que es una foto de verdad (por sus bytes), su tamaño y cuántas hay. */
export async function anadirFoto(repos: Repositorios, id: string, lado: Lado, bytes: Uint8Array, email: string): Promise<Resultado<{ adjunto: string }>> {
  const p = await repos.portafolio.obtener(id);
  if (!p) return { ok: false, error: 'Ese proyecto no existe.' };
  if (bytes.byteLength === 0) return { ok: false, error: 'Elige una foto.' };
  if (bytes.byteLength > MAXIMO_FOTO) return { ok: false, error: 'La foto es demasiado grande. Prueba con otra o hazla de nuevo con el móvil.' };
  const tipo = tipoDeImagen(bytes);
  if (!tipo) return { ok: false, error: 'Ese archivo no es una foto. Usa una foto JPG, PNG o WebP.' };
  if (p[lado].length >= MAXIMO_FOTOS_POR_LADO) return { ok: false, error: `Ya hay ${MAXIMO_FOTOS_POR_LADO} fotos de ${lado === 'antes' ? 'antes' : 'después'}. Quita alguna para añadir otra.` };
  const adjunto = `${id}-${lado}-${Date.now().toString(36)}${sufijo()}`;
  await repos.adjuntos.guardar({ id: adjunto, ambito: AMBITO, ref: id, tipo: tipo.tipo, bytes }, email);
  await repos.portafolio.guardar({ ...p, [lado]: [...p[lado], adjunto] }, email);
  return { ok: true, adjunto };
}

/** Quita una foto del proyecto y borra el archivo. */
export async function quitarFoto(repos: Repositorios, id: string, adjunto: string, email: string): Promise<boolean> {
  const p = await repos.portafolio.obtener(id);
  if (!p || (!p.antes.includes(adjunto) && !p.despues.includes(adjunto))) return false;
  await repos.portafolio.guardar({ ...p, antes: p.antes.filter((a) => a !== adjunto), despues: p.despues.filter((a) => a !== adjunto) }, email);
  await repos.adjuntos.borrar(adjunto);
  return true;
}

/** Foto de un proyecto para enseñarla en el panel (solo si es de ese ámbito). */
export async function fotoDeProyecto(repos: Repositorios, adjunto: string) {
  const a = await repos.adjuntos.obtener(adjunto);
  return a && a.ambito === AMBITO ? a : null;
}

/** Categorías usadas, para el filtro (por orden alfabético). */
export const categorias = (proyectos: ProyectoPortafolio[]) => [...new Set(proyectos.map((p) => p.categoria).filter(Boolean))].sort((a, b) => a.localeCompare(b, 'es'));
