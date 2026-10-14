import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

const archivos = (dir: string): string[] =>
  readdirSync(dir).flatMap((n) => {
    const r = join(dir, n);
    return statSync(r).isDirectory() ? archivos(r) : [r];
  });

describe('arquitectura', () => {
  it('solo la capa de datos consulta la base de datos', () => {
    const fuera = archivos('src')
      .filter((r) => !r.startsWith(join('src', 'server', 'data')))
      .filter((r) => /\.prepare\(|\bSELECT\s|\bINSERT\s+INTO\b|\bUPDATE\s+\w+\s+SET\b/.test(readFileSync(r, 'utf8')));
    expect(fuera).toEqual([]);
  });
});
