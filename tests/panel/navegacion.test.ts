import { describe, expect, it } from 'vitest';
import { barraDe, gruposDe, menuDe, seccionActual } from '../../src/server/panel/navegacion.ts';

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

  it('la barra del móvil lleva cuatro accesos con el asistente en el centro', () => {
    expect(barraDe('propietario').map((s) => s.href)).toEqual(['/panel', '/panel/plantas', '/panel/asistente', '/panel/facturas']);
    expect(barraDe('editor').map((s) => s.href)).toEqual(['/panel', '/panel/plantas', '/panel/asistente', '/panel/textos']);
    expect(gruposDe('editor').map((g) => g.grupo)).toEqual(['dia', 'vivero', 'ajustes']);
  });
});
