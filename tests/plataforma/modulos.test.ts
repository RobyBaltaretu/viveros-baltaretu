import { readdirSync } from 'node:fs';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { HERRAMIENTAS, herramienta, herramientasDe } from '../../src/server/asistente/herramientas.ts';
import { menuDe, zonasDe } from '../../src/server/panel/navegacion.ts';
import { permitido, rutaDisponible } from '../../src/plataforma/actual.ts';
import { cargarCliente } from '../../src/plataforma/cargar.ts';
import type { Modulo } from '../../src/plataforma/configuracion.ts';
import { moduloDeHerramienta, moduloDeRuta } from '../../src/plataforma/modulos.ts';

/** Configura el cliente del «build» como lo haría astro.config.mjs. */
function cliente(id: string, apagados: Modulo[] = []) {
  const c = cargarCliente(id);
  for (const m of apagados) c.modulos[m] = false;
  vi.stubEnv('CLIENTE_CONFIG', JSON.stringify(c));
}
afterEach(() => vi.unstubAllEnvs());

const hrefs = () => menuDe('propietario').map((s) => s.href);

describe('módulos', () => {
  it('cada ruta del panel y de la API es de un módulo o del núcleo', () => {
    expect(moduloDeRuta('/panel/facturas/clientes/nuevo')).toBe('facturas');
    expect(moduloDeRuta('/panel/plantas/olivo/precio')).toBe('catalogo');
    expect(moduloDeRuta('/api/presupuesto')).toBe('presupuestosWeb');
    expect(moduloDeRuta('/api/panel/ticket')).toBe('gastos');
    expect(moduloDeRuta('/panel/presupuestosx')).toBeNull();
    expect(moduloDeRuta('/panel')).toBeNull();
    expect(moduloDeRuta('/catalogo/olivo/')).toBeNull();
    // Una pantalla o API nueva tiene que decir de qué módulo es (o entrar aquí como núcleo).
    const NUCLEO = ['ayuda.astro', 'cambios.astro', 'index.astro', 'mas.astro', 'personas.astro', 'pruebas.astro', 'publicar.astro', 'textos'];
    for (const e of readdirSync(new URL('../../src/pages/panel/', import.meta.url))) {
      if (!NUCLEO.includes(e)) expect(moduloDeRuta(`/panel/${e.replace(/\.astro$/, '')}`), e).not.toBeNull();
    }
    for (const e of readdirSync(new URL('../../src/pages/api/panel/', import.meta.url))) expect(moduloDeRuta(`/api/panel/${e.replace(/\.ts$/, '')}`), e).not.toBeNull();
  });

  it('Baltaretu (sin CLIENTE_CONFIG) tiene todo lo de hoy', () => {
    expect(hrefs()).toEqual(expect.arrayContaining(['/panel/presupuestos', '/panel/facturas', '/panel/plantas', '/panel/inventario', '/panel/gastos', '/panel/informes', '/panel/asistente']));
    expect(herramientasDe('propietario')).toHaveLength(HERRAMIENTAS.length);
    expect(permitido(moduloDeRuta('/api/presupuesto'))).toBe(true);
  });

  it('un módulo apagado no sale en el menú, no se puede abrir y no tiene herramientas', () => {
    cliente('baltaretu', ['facturas', 'presupuestosWeb']);
    expect(hrefs()).not.toEqual(expect.arrayContaining(['/panel/facturas']));
    expect(hrefs().filter((h) => h.startsWith('/panel/facturas') || h.startsWith('/panel/presupuestos'))).toEqual([]);
    expect(hrefs()).toContain('/panel/plantas');
    for (const r of ['/panel/facturas', '/panel/facturas/datos', '/api/panel/factura-pdf', '/panel/presupuestos/abc', '/api/presupuesto']) expect(permitido(moduloDeRuta(r)), r).toBe(false);
    const nombres = herramientasDe('propietario').map((h) => h.nombre);
    expect(nombres).not.toContain('crear_factura');
    expect(nombres).not.toContain('ver_presupuestos');
    expect(nombres).toContain('cambiar_planta');
    // Tampoco se puede aplicar una propuesta guardada de ese módulo.
    expect(herramienta('crear_factura')).toBeUndefined();
    expect(herramienta('cambiar_planta')).toBeDefined();
  });

  it('sin el módulo asistente no hay herramientas ni pantalla', () => {
    cliente('baltaretu', ['asistente']);
    expect(herramientasDe('propietario')).toEqual([]);
    expect(hrefs()).not.toContain('/panel/asistente');
  });

  it('Turia: sin peticiones de la web', () => {
    cliente('turia');
    expect(hrefs()).not.toContain('/panel/presupuestos');
    expect(permitido(moduloDeRuta('/api/presupuesto'))).toBe(false);
    expect(hrefs()).toContain('/panel/facturas');
  });

  it('todas las herramientas tienen módulo salvo las del núcleo', () => {
    const nucleo = HERRAMIENTAS.filter((h) => moduloDeHerramienta(h) === null).map((h) => h.nombre);
    expect(nucleo.sort()).toEqual(['cambiar_texto_web', 'cambiar_textos_web', 'cambios_recientes', 'deshacer_cambio', 'publicar_cambios', 'resumen_vivero', 'ver_textos_web']);
  });

  it('la zona «Web» (textos, publicar, cambios) y la API de contenido solo existen con web pública', () => {
    for (const r of ['/panel/textos', '/panel/textos/ajustes/empresa', '/panel/publicar', '/panel/cambios', '/api/contenido/exportacion']) expect(rutaDisponible(r), r).toBe(true);
    expect(zonasDe('propietario').map((z) => z.zona)).toContain('web');
    cliente('turia');
    for (const r of ['/panel/textos', '/panel/textos/ajustes/empresa', '/panel/publicar', '/panel/cambios', '/api/contenido/exportacion', '/api/contenido/importacion']) expect(rutaDisponible(r), r).toBe(false);
    expect(rutaDisponible('/panel/personas')).toBe(true);
    expect(zonasDe('propietario').map((z) => z.zona)).not.toContain('web');
    const nombres = herramientasDe('propietario').map((h) => h.nombre);
    for (const n of ['ver_textos_web', 'cambiar_textos_web', 'publicar_cambios', 'deshacer_cambio']) expect(nombres, n).not.toContain(n);
    expect(herramienta('publicar_cambios')).toBeUndefined();
  });
});
