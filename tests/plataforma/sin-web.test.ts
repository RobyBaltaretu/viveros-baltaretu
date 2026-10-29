import { mkdir, mkdtemp, readdir, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { cargarCliente } from '../../src/plataforma/cargar.ts';
import { quitarWebPublica } from '../../src/plataforma/sin-web.ts';

let dist: string;
afterEach(async () => {
  if (dist) await rm(dist, { recursive: true, force: true });
});

/** Un build como el de Astro con el adaptador de Cloudflare: dist/client (estático) y dist/server (Worker). */
async function build() {
  dist = await mkdtemp(join(tmpdir(), 'sin-web-'));
  for (const d of ['client/_astro', 'client/catalogo/olivo', 'client/en', 'server']) await mkdir(join(dist, d), { recursive: true });
  const archivos = ['client/index.html', 'client/404.html', 'client/sitemap.xml', 'client/robots.txt', 'client/indice-especies.json', 'client/favicon.png', 'client/_headers', 'client/_astro/panel.css', 'client/catalogo/olivo/index.html', 'client/en/index.html', 'server/entry.mjs'];
  for (const a of archivos) await writeFile(join(dist, a), 'x');
}

describe('cliente sin web pública', () => {
  it('Baltaretu tiene web pública y Turia no', () => {
    expect(cargarCliente('baltaretu').webPublica).toBe(true);
    expect(cargarCliente('turia').webPublica).toBe(false);
  });

  it('deja solo el panel: sin páginas, sitemap ni índice; portada hacia /panel; robots lo bloquea todo; el Worker intacto', async () => {
    await build();
    await quitarWebPublica(dist);
    expect((await readdir(join(dist, 'client'))).sort()).toEqual(['404.html', '_astro', '_headers', 'favicon.png', 'index.html', 'robots.txt']);
    expect(await readdir(join(dist, 'client/_astro'))).toEqual(['panel.css']);
    expect(await readdir(join(dist, 'server'))).toEqual(['entry.mjs']);
    expect(await readFile(join(dist, 'client/robots.txt'), 'utf8')).toBe('User-agent: *\nDisallow: /\n');
    const portada = await readFile(join(dist, 'client/index.html'), 'utf8');
    expect(portada).toContain('url=/panel');
    expect(portada).toContain('noindex');
    expect(portada).toContain('lang="es"');
    expect(await readFile(join(dist, 'client/404.html'), 'utf8')).toContain('Esta página no existe');
  });

  it('nunca toca una carpeta que no sea la estática del build', async () => {
    dist = await mkdtemp(join(tmpdir(), 'sin-web-'));
    await mkdir(join(dist, 'server'), { recursive: true });
    await expect(quitarWebPublica(dist)).rejects.toThrow(/No es la carpeta estática/);
    expect(await readdir(dist)).toEqual(['server']);
  });
});
