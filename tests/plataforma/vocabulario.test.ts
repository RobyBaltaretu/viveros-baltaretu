import { afterEach, describe, expect, it, vi } from 'vitest';
import { herramientasDe } from '../../src/server/asistente/herramientas.ts';
import { menuDe, zonasDe } from '../../src/server/panel/navegacion.ts';
import { clienteActual, rutaDisponible } from '../../src/plataforma/actual.ts';
import { cargarCliente } from '../../src/plataforma/cargar.ts';
import { vocabularioPanel } from '../../src/plataforma/vocabulario.ts';

const comoCliente = (id: string) => vi.stubEnv('CLIENTE_CONFIG', JSON.stringify(cargarCliente(id)));
afterEach(() => vi.unstubAllEnvs());

describe('vocabulario y marca por sector', () => {
  it('Baltaretu (vivero): los textos de siempre', () => {
    expect(vocabularioPanel()).toMatchObject({ tituloPanel: 'Panel del vivero', nombreAsistente: 'AgricolAI' });
    expect(clienteActual().marca).toEqual({ nombreCorto: 'Baltaretu', monograma: '/monograma.png' });
    expect(zonasDe('propietario').find((z) => z.zona === 'plantas')).toMatchObject({ texto: 'Plantas', descripcion: 'Catálogo, inventario y fotos' });
    for (const r of ['/panel/plantas', '/panel/plantas/olivo', '/panel/inventario', '/panel/fotos', '/api/panel/foto']) expect(rutaDisponible(r), r).toBe(true);
    for (const r of ['/panel/portafolio', '/api/panel/adjunto']) expect(rutaDisponible(r), r).toBe(false);
  });

  it('Turia (carpintería): su nombre, sin las pantallas ni las herramientas de plantas', () => {
    comoCliente('turia');
    expect(vocabularioPanel()).toMatchObject({ tituloPanel: 'Panel de la carpintería', nombreAsistente: 'Asistente' });
    expect(clienteActual().marca).toEqual({ nombreCorto: 'Creaciones Turia', monograma: null });
    for (const r of ['/panel/plantas', '/panel/inventario', '/panel/fotos', '/api/panel/foto']) expect(rutaDisponible(r), r).toBe(false);
    expect(rutaDisponible('/panel/facturas')).toBe(true);
    // La zona del catálogo es el portafolio privado, con su única pantalla.
    expect(zonasDe('propietario').find((z) => z.zona === 'plantas')).toMatchObject({ texto: 'Portafolio', href: '/panel/portafolio', secciones: [expect.objectContaining({ href: '/panel/portafolio' })] });
    expect(rutaDisponible('/panel/portafolio/abc/fotos')).toBe(true);
    expect(zonasDe('editor').map((z) => z.zona)).not.toContain('plantas');
    expect(zonasDe('propietario').find((z) => z.zona === 'asistente')?.texto).toBe('Asistente');
    expect(menuDe('propietario').find((s) => s.href === '/panel/asistente')?.texto).toBe('Asistente');
    const nombres = herramientasDe('propietario').map((h) => h.nombre);
    for (const n of ['buscar_plantas', 'cambiar_plantas', 'crear_planta', 'ver_inventario', 'mover_inventario']) expect(nombres, n).not.toContain(n);
    expect(nombres).toContain('crear_factura');
  });
});
