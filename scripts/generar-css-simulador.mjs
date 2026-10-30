/**
 * CSS propio del simulador (src/panel-nuevo/simulador.css), generado con
 * Tailwind a partir de las clases de su página. El simulador queda fuera del
 * escaneo de Tailwind de la web (global.css, `@source not`) para que el CSS
 * de Baltaretu no cambie; la página mete este archivo en línea.
 * Solo las utilidades (sin la base ni los componentes, que ya están) y las
 * variables de tema que usan. Uso: `node scripts/generar-css-simulador.mjs`
 * (y `--comprobar` en los tests, para avisar si está desactualizado).
 */
import { compile, optimize } from '@tailwindcss/node';
import { Scanner } from '@tailwindcss/oxide';
import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const raiz = resolve(dirname(fileURLToPath(import.meta.url)), '..');
export const FUENTES = ['src/pages/panel/simulador.astro'];
const SALIDA = resolve(raiz, 'src/panel-nuevo/simulador.css');

export async function generarCssSimulador() {
  // El tema de la web (colores, letras, radios) sin emitir la base ni los componentes.
  const tema = readFileSync(resolve(raiz, 'src/styles/global.css'), 'utf8').match(/@theme \{[\s\S]*?\n\}/)[0];
  const entrada = `@layer theme, base, components, utilities;\n@import 'tailwindcss/theme.css' layer(theme);\n@import 'tailwindcss/utilities.css' layer(utilities);\n${tema}\n`;
  const compilador = await compile(entrada, { base: resolve(raiz, 'src/styles'), onDependency: () => {} });
  const candidatos = new Scanner({ sources: FUENTES.map((f) => ({ base: raiz, pattern: f, negated: false })) }).scan();
  const css = optimize(compilador.build(candidatos), { minify: true }).code;
  return `/* Generado por scripts/generar-css-simulador.mjs: no editar a mano. */\n${css}\n`;
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const css = await generarCssSimulador();
  if (process.argv.includes('--comprobar')) {
    if (readFileSync(SALIDA, 'utf8') !== css) {
      console.error('src/panel-nuevo/simulador.css está desactualizado: ejecuta node scripts/generar-css-simulador.mjs');
      process.exit(1);
    }
  } else writeFileSync(SALIDA, css);
}
