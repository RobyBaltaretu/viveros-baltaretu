import { describe, expect, it } from 'vitest';
import { formatearPrecio } from '../src/lib/catalogo/formato';
import { filtrarPublicables, mostrarNoRevisadas } from '../src/lib/catalogo/publicacion';

describe('formatearPrecio', () => {
  it('muestra "desde X €" en español', () => {
    expect(formatearPrecio(12, 'unidad', 'es')).toBe('desde 12 € / unidad');
  });

  it('muestra "from €X" en inglés', () => {
    expect(formatearPrecio(450, 'unidad', 'en')).toBe('from €450 per unit');
  });

  it('sin precio muestra "precio bajo presupuesto"', () => {
    expect(formatearPrecio(undefined, 'unidad', 'es')).toBe('precio bajo presupuesto');
    expect(formatearPrecio(null, 'unidad', 'en')).toBe('price on request');
  });
});

describe('publicación de fichas', () => {
  const entradas = [{ data: { revisado: true } }, { data: { revisado: false } }];

  it('en producción solo se publican las fichas revisadas', () => {
    expect(filtrarPublicables(entradas, { dev: false, ramaCi: 'main' })).toHaveLength(1);
    expect(filtrarPublicables(entradas, { dev: false, ramaCi: 'produccion', ramaProduccion: 'produccion' })).toHaveLength(1);
  });

  it('un build fuera de Workers Builds (por ejemplo, la CI) también las excluye', () => {
    expect(mostrarNoRevisadas({ dev: false })).toBe(false);
  });

  it('en desarrollo y en builds de otras ramas se muestran todas', () => {
    expect(filtrarPublicables(entradas, { dev: true })).toHaveLength(2);
    expect(filtrarPublicables(entradas, { dev: false, ramaCi: 'claude/rama-de-prueba' })).toHaveLength(2);
  });
});
