import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { TEMAS } from '../../src/server/panel/ayuda.ts';

describe('ayuda del panel', () => {
  it('la guía del gerente está al día con la ayuda del panel (npx tsx scripts/guia-gerente.ts)', () => {
    const guia = readFileSync('docs/panel-propio/guia-gerente.md', 'utf8');
    for (const t of TEMAS) for (const p of t.pasos) expect(guia).toContain(p);
  });
  it('no usa palabras técnicas', () => {
    const texto = JSON.stringify(TEMAS).toLowerCase();
    for (const palabra of ['slug', 'seo', 'commit', 'build', 'deploy', 'github', 'd1']) expect(texto).not.toMatch(new RegExp(`\\b${palabra}\\b`));
  });
});
