import type { z } from 'astro/zod';

/**
 * Algunos modelos (GLM) a veces escriben la llamada a una herramienta como texto
 * («<tool_call>nombre<arg_key>k</arg_key><arg_value>v</arg_value></tool_call>»)
 * en vez de hacerla. Aquí se leen esas llamadas para ejecutarlas igual y no
 * enseñar nunca ese texto a la persona.
 */
export interface LlamadaEnTexto {
  nombre: string;
  /** Valores leídos como JSON cuando se puede (números, sí/no, listas). */
  argumentos: Record<string, unknown>;
  /** Los mismos valores tal cual, como texto. */
  textos: Record<string, string>;
}

const BLOQUE = /<tool_call>([\s\S]*?)(?:<\/tool_call>|$)/g;

export const tieneLlamadas = (texto: string) => texto.includes('<tool_call>');
export const sinLlamadas = (texto: string) => texto.replace(BLOQUE, '').replace(/<\/?(tool_call|arg_key|arg_value)>/g, '').trim();

export function llamadasEnTexto(texto: string): LlamadaEnTexto[] {
  const llamadas: LlamadaEnTexto[] = [];
  for (const [, dentro] of texto.matchAll(BLOQUE)) {
    const interior = dentro.trim();
    // Forma JSON: {"name": "...", "arguments": {...}}
    if (interior.startsWith('{')) {
      try {
        const j = JSON.parse(interior) as { name?: string; arguments?: Record<string, unknown> | string };
        const args = typeof j.arguments === 'string' ? (JSON.parse(j.arguments) as Record<string, unknown>) : (j.arguments ?? {});
        if (j.name) llamadas.push({ nombre: j.name, argumentos: args, textos: Object.fromEntries(Object.entries(args).map(([k, v]) => [k, typeof v === 'string' ? v : JSON.stringify(v)])) });
      } catch {
        // No se entiende: se ignora.
      }
      continue;
    }
    const nombre = interior.match(/^([a-z_]+)/)?.[1];
    if (!nombre) continue;
    const argumentos: Record<string, unknown> = {};
    const textos: Record<string, string> = {};
    for (const [, k, v] of interior.matchAll(/<arg_key>([\s\S]*?)<\/arg_key>\s*<arg_value>([\s\S]*?)<\/arg_value>/g)) {
      const clave = k.trim();
      textos[clave] = v.trim();
      try {
        argumentos[clave] = JSON.parse(v.trim());
      } catch {
        argumentos[clave] = v.trim();
      }
    }
    llamadas.push({ nombre, argumentos, textos });
  }
  return llamadas;
}

/** Los argumentos que valen para el esquema: leídos como JSON y, donde no encajan, como texto (p. ej. un código postal). */
export function argumentosValidos(esquema: z.ZodType, l: LlamadaEnTexto): unknown {
  const primero = esquema.safeParse(l.argumentos);
  if (primero.success) return primero.data;
  const mezcla = { ...l.argumentos };
  for (const i of primero.error.issues) {
    const clave = String(i.path[0] ?? '');
    if (clave in l.textos) mezcla[clave] = l.textos[clave];
  }
  const segundo = esquema.safeParse(mezcla);
  return segundo.success ? segundo.data : l.argumentos;
}
