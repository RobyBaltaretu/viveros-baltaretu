import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

// Lee los colores del bloque @theme de global.css: el test falla si alguien cambia un
// color y rompe el contraste mínimo WCAG 2.1 AA.
const css = readFileSync(new URL('../src/styles/global.css', import.meta.url), 'utf8');
const color = (nombre: string): string => {
  if (nombre === 'blanco') return '#ffffff';
  const encontrado = css.match(new RegExp(`--color-${nombre}:\\s*(#[0-9a-f]{6})`, 'i'));
  if (!encontrado) throw new Error(`No existe --color-${nombre}`);
  return encontrado[1]!;
};

function luminancia(hex: string): number {
  const [r, g, b] = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255);
  const canal = (c: number) => (c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4);
  return 0.2126 * canal(r!) + 0.7152 * canal(g!) + 0.0722 * canal(b!);
}
function contraste(a: string, b: string): number {
  const [claro, oscuro] = [luminancia(a), luminancia(b)].sort((x, y) => y - x);
  return (claro! + 0.05) / (oscuro! + 0.05);
}

// [texto, fondo, mínimo]. 4.5 = texto normal (AA).
const combinaciones: [string, string, number][] = [
  ['tinta', 'crema', 4.5],
  ['tinta', 'papel', 4.5],
  ['tinta', 'verdor', 4.5],
  ['gris', 'crema', 4.5],
  ['gris', 'papel', 4.5],
  ['gris', 'verdor', 4.5],
  ['oliva', 'crema', 4.5],
  ['oliva', 'papel', 4.5],
  ['oliva', 'verdor', 4.5],
  ['terracota', 'crema', 4.5],
  ['terracota', 'papel', 4.5],
  ['blanco', 'terracota', 4.5],
  ['crema', 'oliva', 4.5],
  ['verdor', 'oliva', 4.5],
];

describe('contraste de los tokens de color (WCAG 2.1 AA)', () => {
  it.each(combinaciones)('%s sobre %s ≥ %d:1', (texto, fondo, minimo) => {
    expect(contraste(color(texto), color(fondo))).toBeGreaterThanOrEqual(minimo);
  });
});
