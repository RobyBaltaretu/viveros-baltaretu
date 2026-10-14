/**
 * Lo mínimo que usamos de una base D1. Tipado propio para no depender de los
 * tipos de Cloudflare fuera de esta carpeta (ver docs/panel-propio/plan-tecnico.md).
 */
export interface ResultadoD1<T> {
  results: T[];
  meta?: { changes?: number; last_row_id?: number };
}

export interface SentenciaD1 {
  bind(...valores: unknown[]): SentenciaD1;
  first<T = Record<string, unknown>>(): Promise<T | null>;
  all<T = Record<string, unknown>>(): Promise<ResultadoD1<T>>;
  run(): Promise<ResultadoD1<unknown>>;
}

export interface BaseD1 {
  prepare(sql: string): SentenciaD1;
  batch(sentencias: SentenciaD1[]): Promise<ResultadoD1<unknown>[]>;
}
