import { readdirSync, readFileSync } from 'node:fs';
import { describe, expect, it, vi } from 'vitest';
import { IVA_POR_DEFECTO } from '../../src/server/facturas/importes.ts';
import { IDIOMA_POR_DEFECTO, IDIOMAS } from '../../src/i18n/ui.ts';
import { clienteActual, moduloActivoAhora } from '../../src/plataforma/actual.ts';
import { cargarCliente } from '../../src/plataforma/cargar.ts';
import { MODULOS, TOKENS_COLOR, validarCliente } from '../../src/plataforma/configuracion.ts';

const leer = (ruta: string) => readFileSync(new URL(`../../${ruta}`, import.meta.url), 'utf8');
// wrangler.jsonc lleva comentarios de línea: se quitan antes de leerlo.
const wrangler = JSON.parse(
  leer('wrangler.jsonc')
    .split('\n')
    .filter((l) => !/^\s*\/\//.test(l))
    .join('\n'),
);
const css = leer('src/styles/global.css');

describe('configuración de clientes', () => {
  it('todas las configuraciones de clientes/ son válidas', () => {
    const ids = readdirSync(new URL('../../clientes/', import.meta.url), { withFileTypes: true })
      .filter((e) => e.isDirectory())
      .map((e) => e.name);
    expect(ids).toEqual(expect.arrayContaining(['baltaretu', 'turia']));
    for (const id of ids) expect(cargarCliente(id).id).toBe(id);
  });

  it('sin CLIENTE_ID es Viveros Baltaretu, con exactamente lo que hoy está fijo en el código', () => {
    const c = cargarCliente('');
    expect(cargarCliente(undefined).id).toBe('baltaretu');
    expect(c).toMatchObject({ id: 'baltaretu', nombre: 'Viveros Baltaretu', sector: 'vivero' });
    expect(c.idiomas).toEqual([...IDIOMAS]);
    expect(c.idiomaPorDefecto).toBe(IDIOMA_POR_DEFECTO);
    expect(c.iva).toEqual({ general: IVA_POR_DEFECTO, fijo: false });
    // Mismo Worker y misma D1 que wrangler.jsonc, que no cambia.
    expect(c.cloudflare).toEqual({ worker: wrangler.name, d1: wrangler.d1_databases[0].database_name });
    // Mismos colores que el @theme actual.
    for (const t of TOKENS_COLOR) expect(c.tema?.[t], t).toBe(css.match(new RegExp(`--color-${t}:\\s*(#[0-9a-f]{6})`, 'i'))?.[1]);
    // Los módulos de hoy, activos; los nuevos, apagados.
    expect(MODULOS.filter((m) => c.modulos[m])).toEqual(['catalogo', 'presupuestosWeb', 'facturas', 'gastos', 'informes', 'asistente', 'whatsapp']);
  });

  it('Creaciones Turia: solo español e IVA del 21 % sin elegir', () => {
    const c = cargarCliente('turia');
    expect(c).toMatchObject({ sector: 'carpinteria', idiomas: ['es'], idiomaPorDefecto: 'es', iva: { general: 21, fijo: true } });
    expect(c.cloudflare.d1).not.toBe(wrangler.d1_databases[0].database_name);
  });

  it('un cliente desconocido o una configuración mal hecha paran el build', () => {
    expect(() => cargarCliente('no-existe')).toThrow(/No existe el cliente/);
    expect(() => cargarCliente('../baltaretu')).toThrow(/no válido/);
    const base = JSON.parse(leer('clientes/baltaretu/cliente.config.json'));
    expect(() => validarCliente('otro', base)).toThrow(/tiene que ser «otro»/);
    expect(() => validarCliente('baltaretu', { ...base, idiomaPorDefecto: 'en', idiomas: ['es'] })).toThrow(/idioma por defecto/);
    expect(() => validarCliente('baltaretu', { ...base, modulos: { catalogo: true } })).toThrow(/modulos\.presupuestosWeb/);
    expect(() => validarCliente('baltaretu', { ...base, tema: { crema: '#fff' } })).toThrow(/tema\.crema/);
    expect(() => validarCliente('baltaretu', { ...base, iva: { general: 7, fijo: false, otro: 1 } })).toThrow();
    expect(() => validarCliente('baltaretu', { ...base, secreto: 'x' })).toThrow();
  });

  it('en el prerender y el Worker se lee de la constante que inyecta astro.config.mjs', () => {
    vi.stubEnv('CLIENTE_CONFIG', JSON.stringify(cargarCliente('turia')));
    try {
      expect(clienteActual().id).toBe('turia');
      expect(moduloActivoAhora('obras')).toBe(true);
    } finally {
      vi.unstubAllEnvs();
    }
  });
});
