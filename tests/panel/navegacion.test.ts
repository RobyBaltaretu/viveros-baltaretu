import { describe, expect, it } from 'vitest';
import { menuDe, seccionActual } from '../../src/server/panel/navegacion.ts';

describe('menú del panel', () => {
  it('marca la sección de cada ruta', () => {
    expect(seccionActual('/panel')).toBe('/panel');
    expect(seccionActual('/panel/plantas/olivo/precio')).toBe('/panel/plantas');
    expect(seccionActual('/panel/presupuestos/')).toBe('/panel/presupuestos');
    expect(seccionActual('/panel/ayuda')).toBeNull();
  });

  it('solo enseña lo que el rol puede usar', () => {
    const editor = menuDe('editor').map((s) => s.href);
    expect(editor).toContain('/panel/plantas');
    expect(editor).not.toContain('/panel/presupuestos');
    expect(editor).not.toContain('/panel/publicar');
  });
});
