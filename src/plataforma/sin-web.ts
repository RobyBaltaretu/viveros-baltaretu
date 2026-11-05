import { existsSync } from 'node:fs';
import { readdir, rm, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import type { AstroIntegration } from 'astro';
import { moduloActivo, type ConfiguracionCliente } from './configuracion.ts';

/**
 * Clientes sin web pública (`webPublica: false`, como Creaciones Turia): del
 * build solo queda el panel. Se quitan las páginas públicas, el sitemap y el
 * índice del catálogo; la portada lleva a /panel y robots.txt lo bloquea todo.
 * Quedan los recursos que usa el panel (`_astro/`, iconos) y `_headers`.
 * Con web pública (Baltaretu) no hace nada.
 */
const PORTADA = `<!doctype html>
<html lang="es">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <meta name="robots" content="noindex, nofollow" />
    <meta http-equiv="refresh" content="0; url=/panel" />
    <title>Panel</title>
  </head>
  <body>
    <p><a href="/panel">Ir al panel</a></p>
  </body>
</html>
`;
const NO_ENCONTRADA = PORTADA.replace('<meta http-equiv="refresh" content="0; url=/panel" />\n    ', '').replace('<title>Panel</title>', '<title>No encontrada</title>').replace('<p><a', '<h1>Esta página no existe</h1>\n    <p><a');

export async function quitarWebPublica(salida: string): Promise<string[]> {
  // Solo la parte estática (`dist/client`); nunca la carpeta del Worker.
  const cliente = existsSync(join(salida, 'client')) ? join(salida, 'client') : salida;
  if (existsSync(join(cliente, 'server')) || !existsSync(join(cliente, '_astro'))) throw new Error(`No es la carpeta estática del build: ${cliente}`);
  const quitados: string[] = [];
  for (const e of await readdir(cliente, { withFileTypes: true })) {
    if (e.name === '_astro') continue;
    const ruta = join(cliente, e.name);
    if (e.isDirectory() || /\.(html|xml)$/.test(e.name) || e.name === 'indice-especies.json' || e.name === 'og-imagen.png') {
      await rm(ruta, { recursive: true, force: true });
      quitados.push(e.name);
    }
  }
  await writeFile(join(cliente, 'index.html'), PORTADA);
  await writeFile(join(cliente, '404.html'), NO_ENCONTRADA);
  await writeFile(join(cliente, 'robots.txt'), 'User-agent: *\nDisallow: /\n');
  return quitados.sort();
}

/**
 * Scripts empaquetados de pantallas de un módulo que el cliente no tiene: se
 * quitan del build (sus rutas dan 404 en ese cliente). Así Turia Studio no deja
 * su JS en la web de Baltaretu (línea base).
 */
const SCRIPTS_DE_MODULO = [{ modulo: 'simulador', patron: /^studio-bocetos\.astro_astro_type_script_.*\.js$/ }] as const;
export async function quitarScriptsDeModulos(salida: string, c: ConfiguracionCliente): Promise<string[]> {
  const astro = existsSync(join(salida, 'client', '_astro')) ? join(salida, 'client', '_astro') : join(salida, '_astro');
  if (!existsSync(astro)) return [];
  const quitados: string[] = [];
  for (const nombre of await readdir(astro)) {
    if (SCRIPTS_DE_MODULO.some((x) => !moduloActivo(c, x.modulo) && x.patron.test(nombre))) {
      await rm(join(astro, nombre), { force: true });
      quitados.push(nombre);
    }
  }
  return quitados;
}

/** Integración de Astro: al acabar el build, deja solo el panel si el cliente no tiene web pública. */
export const sinWebPublica = (c: ConfiguracionCliente): AstroIntegration => ({
  name: 'plataforma-sin-web-publica',
  hooks: {
    'astro:build:done': async ({ dir, logger }) => {
      const sinUso = await quitarScriptsDeModulos(fileURLToPath(dir), c);
      if (sinUso.length) logger.info(`${c.nombre}: sin los scripts de módulos apagados (${sinUso.join(', ')})`);
      if (c.webPublica) return;
      const quitados = await quitarWebPublica(fileURLToPath(dir));
      logger.info(`${c.nombre}: sin web pública (quitado ${quitados.join(', ')})`);
    },
  },
});
