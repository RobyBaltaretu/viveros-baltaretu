import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { generarCssSimulador } from '../../scripts/generar-css-simulador.mjs';

describe('CSS del simulador', () => {
  it('está al día con las clases de su página (si falla: node scripts/generar-css-simulador.mjs)', async () => {
    expect(readFileSync(new URL('../../src/panel-nuevo/simulador.css', import.meta.url), 'utf8')).toBe(await generarCssSimulador());
  }, 30_000);

  it('el simulador queda fuera del Tailwind de la web, para que Baltaretu no cambie', () => {
    const global = readFileSync(new URL('../../src/styles/global.css', import.meta.url), 'utf8');
    for (const r of ['../pages/panel/simulador.astro', '../pages/api/panel/simulador.ts', '../services', '../server/simulador']) expect(global).toContain(`@source not '${r}';`);
  });
});
