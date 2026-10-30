import { readFileSync } from 'node:fs';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { accionesCrear, gruposLateral, pestanasMovil } from '../../src/panel-nuevo/navegacion.ts';
import { cargarCliente } from '../../src/plataforma/cargar.ts';
import { menuDe, zonasDe } from '../../src/server/panel/navegacion.ts';

const cliente = (id: string) => vi.stubEnv('CLIENTE_CONFIG', JSON.stringify(cargarCliente(id)));
afterEach(() => vi.unstubAllEnvs());

describe('diseño nuevo del panel', () => {
  it('lo pide la configuración del cliente: Turia sí, Viveros Baltaretu no', () => {
    expect(cargarCliente('turia').panel?.diseno).toBe('nuevo');
    expect(cargarCliente('baltaretu').panel).toBeUndefined();
  });

  it('Tailwind no mira sus archivos (así no cambia el CSS de la web)', () => {
    const css = readFileSync(new URL('../../src/styles/global.css', import.meta.url), 'utf8');
    expect(css).toContain("@source not '../panel-nuevo';");
  });

  it('barra lateral: todas las secciones a la vista, por grupos, con Inicio arriba', () => {
    cliente('turia');
    const grupos = gruposLateral(zonasDe('propietario'));
    expect(grupos[0]).toMatchObject({ texto: '' });
    expect(grupos[0]!.secciones.map((s) => s.href)).toEqual(['/panel', '/panel/asistente']);
    const ventas = grupos.find((g) => g.texto === 'Ventas');
    expect(ventas?.secciones.map((s) => s.texto)).toEqual(['Presupuestos', 'Facturas', 'Clientes']);
    expect(grupos.find((g) => g.texto === 'Taller')?.secciones.map((s) => s.texto)).toEqual(['Catálogo', 'Pedidos', 'Proveedores', 'Portafolio']);
  });

  it('«Crear» solo ofrece lo que el rol puede usar', () => {
    cliente('turia');
    expect(accionesCrear(menuDe('propietario')).map((a) => a.href)).toEqual([
      '/panel/presupuestos-cliente/nuevo',
      '/panel/facturas/nueva',
      '/panel/gastos/nuevo',
      '/panel/facturas/clientes/nuevo',
      '/panel/pedidos/nuevo',
      '/panel/catalogo/articulos/nuevo',
      '/panel/portafolio/nuevo',
    ]);
    expect(accionesCrear(menuDe('editor')).map((a) => a.href)).not.toContain('/panel/facturas/nueva');
    expect(accionesCrear(menuDe('editor')).map((a) => a.href)).not.toContain('/panel/pedidos/nuevo');
  });

  it('barra del móvil: Inicio, Ventas, Crear, la zona del sector y Más', () => {
    cliente('turia');
    const p = pestanasMovil(zonasDe('propietario'), 'ventas', false, true);
    expect(p.map((x) => (x.tipo === 'crear' ? '+' : x.texto))).toEqual(['Inicio', 'Ventas', '+', 'Taller', 'Más']);
    expect(p.find((x) => x.tipo === 'enlace' && x.activa)).toMatchObject({ texto: 'Ventas' });
    // Una sección que no está en la barra marca «Más».
    expect(pestanasMovil(zonasDe('propietario'), 'cuentas', false, true).at(-1)).toMatchObject({ texto: 'Más', activa: true });
    expect(pestanasMovil(zonasDe('propietario'), 'inicio', false, false).some((x) => x.tipo === 'crear')).toBe(false);
  });
});
