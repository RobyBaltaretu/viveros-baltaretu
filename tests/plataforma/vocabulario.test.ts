import { afterEach, describe, expect, it, vi } from 'vitest';
import { herramientasDe } from '../../src/server/asistente/herramientas.ts';
import { menuDe, zonasDe } from '../../src/server/panel/navegacion.ts';
import { clienteActual, rutaDisponible } from '../../src/plataforma/actual.ts';
import { cargarCliente } from '../../src/plataforma/cargar.ts';
import { vocabularioPanel } from '../../src/plataforma/vocabulario.ts';
import { instruccionesDe } from '../../src/server/asistente/instrucciones.ts';
import { readFileSync } from 'node:fs';

const comoCliente = (id: string) => vi.stubEnv('CLIENTE_CONFIG', JSON.stringify(cargarCliente(id)));
afterEach(() => vi.unstubAllEnvs());

describe('vocabulario y marca por sector', () => {
  it('Baltaretu (vivero): los textos de siempre', () => {
    expect(vocabularioPanel()).toMatchObject({ tituloPanel: 'Panel del vivero', nombreAsistente: 'AgricolAI' });
    expect(clienteActual().marca).toEqual({ nombreCorto: 'Baltaretu', monograma: '/monograma.png' });
    expect(zonasDe('propietario').find((z) => z.zona === 'plantas')).toMatchObject({ texto: 'Plantas', descripcion: 'Catálogo, inventario y fotos' });
    for (const r of ['/panel/plantas', '/panel/plantas/olivo', '/panel/inventario', '/panel/fotos', '/api/panel/foto']) expect(rutaDisponible(r), r).toBe(true);
    for (const r of ['/panel/portafolio', '/api/panel/adjunto', '/panel/proveedores', '/api/panel/proveedores.csv', '/panel/pedidos', '/panel/pedidos/nuevo']) expect(rutaDisponible(r), r).toBe(false);
  });

  it('Turia (carpintería): su nombre, sin las pantallas ni las herramientas de plantas', () => {
    comoCliente('turia');
    expect(vocabularioPanel()).toMatchObject({ tituloPanel: 'Panel de la carpintería', nombreAsistente: 'Gubia' });
    expect(clienteActual().marca).toEqual({ nombreCorto: 'Creaciones Turia', monograma: null });
    for (const r of ['/panel/plantas', '/panel/inventario', '/panel/fotos', '/api/panel/foto']) expect(rutaDisponible(r), r).toBe(false);
    expect(rutaDisponible('/panel/facturas')).toBe(true);
    // La zona del sector es el taller: el catálogo con precios y el portafolio privado.
    expect(zonasDe('propietario').find((z) => z.zona === 'plantas')).toMatchObject({ texto: 'Taller', href: '/panel/catalogo', secciones: [expect.objectContaining({ href: '/panel/catalogo' }), expect.objectContaining({ href: '/panel/pedidos' }), expect.objectContaining({ href: '/panel/proveedores' }), expect.objectContaining({ href: '/panel/portafolio' }), expect.objectContaining({ href: '/panel/simulador' })] });
    expect(rutaDisponible('/panel/catalogo/plantillas/armario-correderas')).toBe(true);
    expect(rutaDisponible('/panel/portafolio/abc/fotos')).toBe(true);
    expect(zonasDe('editor').map((z) => z.zona)).toContain('plantas');
    expect(zonasDe('propietario').find((z) => z.zona === 'asistente')?.texto).toBe('Gubia');
    expect(menuDe('propietario').find((s) => s.href === '/panel/asistente')?.texto).toBe('Gubia');
    const nombres = herramientasDe('propietario').map((h) => h.nombre);
    for (const n of ['buscar_plantas', 'cambiar_plantas', 'crear_planta', 'ver_inventario', 'mover_inventario']) expect(nombres, n).not.toContain(n);
    expect(nombres).toContain('crear_factura');
  });

  it('el asistente de Turia es Gubia, de la carpintería: ni AgricolAI, ni el vivero, ni plantas', () => {
    const ctx = { usuario: { email: 'ana@example.com', nombre: 'Ana', rol: 'gerente' as const, activo: true }, hoy: '2026-10-31' } as never;
    const vivero = instruccionesDe(ctx);
    expect(vivero.startsWith('Eres AgricolAI, el asistente del panel interno de Viveros Baltaretu')).toBe(true);
    comoCliente('turia');
    const turia = instruccionesDe(ctx);
    expect(turia.startsWith('Eres Gubia, el asistente del panel interno de Creaciones Turia, una carpintería')).toBe(true);
    expect(turia).not.toMatch(/AgricolAI|Baltaretu|vivero|planta|palmera|olivo/i);
    expect(turia).toContain('llevan el 21 %');
    expect(vocabularioPanel().sugerencias.join(' ')).not.toMatch(/palmera|planta/i);
    const pagina = readFileSync('src/pages/panel/asistente.astro', 'utf8');
    expect(pagina).not.toMatch(/const NOMBRE = 'AgricolAI';\nconst s =/);
  });
});
