/**
 * Últimos límites que Groq ha devuelto en sus cabeceras, por modelo.
 * Es orientativo: vive en la memoria del Worker (se pierde al reiniciarse) y
 * solo se rellena después de una respuesta de Groq. La cuenta propia del panel
 * (`usoGroq`, en D1) es la que no se pierde.
 */
export interface LimitesGroq {
  peticionesRestantes: number | null;
  peticionesLimite: number | null;
  tokensRestantesMinuto: number | null;
  tokensLimiteMinuto: number | null;
  /** Cuándo se leyó (ISO). */
  leido: string;
}

/** Mensajes por persona y día (aquí para que las herramientas lo lean sin importar el agente). */
export const LIMITE_MENSAJES_PERSONA = 80;

const ultimos = new Map<string, LimitesGroq>();

const numero = (v: string | null | undefined) => {
  const n = v == null || v === '' ? NaN : Number(v);
  return Number.isFinite(n) ? n : null;
};

/** Guarda las cabeceras `x-ratelimit-*` de una respuesta de Groq (si las trae). */
export function anotarLimitesGroq(modelo: string, cabeceras: Record<string, string> | undefined, ahora = new Date()) {
  if (!cabeceras) return;
  const c = (k: string) => cabeceras[k] ?? cabeceras[k.toLowerCase()];
  const l: LimitesGroq = {
    peticionesRestantes: numero(c('x-ratelimit-remaining-requests')),
    peticionesLimite: numero(c('x-ratelimit-limit-requests')),
    tokensRestantesMinuto: numero(c('x-ratelimit-remaining-tokens')),
    tokensLimiteMinuto: numero(c('x-ratelimit-limit-tokens')),
    leido: ahora.toISOString(),
  };
  if (l.peticionesRestantes === null && l.tokensRestantesMinuto === null) return;
  ultimos.set(modelo, l);
}

export const limitesGroq = (modelo: string): LimitesGroq | null => ultimos.get(modelo) ?? null;

/** Presupuesto diario de Groq del panel (lo comparten Gubia y el importador). */
export const PRESUPUESTO_GROQ_DIA = 1000;

/** Peticiones de Groq que le quedan hoy a Gubia, con la misma regla que `reservarGroq`. */
export function quedanParaGubia(uso: { importador: number; asistente: number }, limite = PRESUPUESTO_GROQ_DIA) {
  const total = uso.importador + uso.asistente;
  const libres = Math.max(0, limite - total);
  if (uso.importador === 0) return libres;
  return Math.max(0, Math.min(limite - Math.floor(limite * 0.7) - uso.asistente, libres));
}
