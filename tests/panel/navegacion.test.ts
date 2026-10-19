import { describe, expect, it } from 'vitest';
import { barraDe, menuDe, seccionActual, zonaActual, zonasDe } from '../../src/server/panel/navegacion.ts';

describe('menú del panel', () => {
  it('marca la sección de cada ruta', () => {
    expect(seccionActual('/panel')).toBe('/panel');
    expect(seccionActual('/panel/plantas/olivo/precio')).toBe('/panel/plantas');
    expect(seccionActual('/panel/presupuestos/')).toBe('/panel/presupuestos');
    expect(seccionActual('/panel/ayuda')).toBe('/panel/ayuda');
    expect(seccionActual('/panel/otra-cosa')).toBeNull();
  });

  it('solo enseña lo que el rol puede usar', () => {
    const editor = menuDe('editor').map((s) => s.href);
    expect(editor).toContain('/panel/plantas');
    expect(editor).not.toContain('/panel/presupuestos');
    expect(editor).not.toContain('/panel/publicar');
  });

  it('pocas zonas en el menú y la barra del móvil con AgricolAI en el centro', () => {
    expect(zonasDe('propietario').map((z) => z.texto)).toEqual(['Inicio', 'AgricolAI', 'Ventas', 'Plantas', 'Cuentas', 'Web', 'Ajustes']);
    expect(barraDe('propietario').map((z) => z.href)).toEqual(['/panel', '/panel/plantas', '/panel/asistente', '/panel/presupuestos']);
    expect(barraDe('editor').map((z) => z.href)).toEqual(['/panel', '/panel/plantas', '/panel/asistente', '/panel/textos']);
    expect(zonasDe('editor').map((z) => z.zona)).toEqual(['inicio', 'asistente', 'plantas', 'web', 'ajustes']);
    expect(zonaActual('/panel/facturas/clientes/nuevo')).toBe('ventas');
    expect(zonaActual('/panel/inventario/olivo')).toBe('plantas');
    expect(seccionActual('/panel/inventario/resumen')).toBe('/panel/inventario/resumen');
  });
});
