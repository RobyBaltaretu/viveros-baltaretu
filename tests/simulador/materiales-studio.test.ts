import { describe, expect, it } from 'vitest';
import type { ArticuloCatalogo, VarianteCatalogo } from '../../src/server/data/tipos.ts';
import { materialesStudioPorId, PREFIJO_ARTICULO, variantesStudio } from '../../src/server/simulador/materiales-studio.ts';

const art = (id: string, extra: Partial<ArticuloCatalogo> = {}) => ({ id, nombre: id, categoria: 'tableros', unidad: 'm²', referencia: 'R-' + id, acabado: 'mate', espesor: 19, proveedor: '', archivado: false, actualizado: '2026-11-05', ...extra }) as ArticuloCatalogo;

describe('materiales de Turia Studio', () => {
  it('lo elegido como artículo se sigue encontrando aunque después le hayan creado variantes', () => {
    const nueva = { id: 'v-nueva', articuloId: 'a', estado: 'pendiente' } as VarianteCatalogo;
    const mapa = materialesStudioPorId([art('a'), art('viejo', { archivado: true })], [nueva]);
    expect(mapa.get(PREFIJO_ARTICULO + 'a')).toMatchObject({ articuloId: 'a', referencia: 'R-a' });
    expect(mapa.get('v-nueva')).toBe(nueva);
    expect(mapa.has(PREFIJO_ARTICULO + 'viejo')).toBe(false);
    expect(variantesStudio([art('a')], [nueva]).map((v) => v.id)).toEqual(['v-nueva']);
  });
  it('incluye los artículos sin variantes y no repite los que ya tienen', () => {
    const variante = { id: 'v1', articuloId: 'con', estado: 'activo' } as VarianteCatalogo;
    const lista = variantesStudio([art('con'), art('sin'), art('obra', { categoria: 'mano-obra' }), art('viejo', { archivado: true })], [variante]);
    expect(lista.map((v) => v.id)).toEqual(['v1', PREFIJO_ARTICULO + 'sin']);
    expect(lista[1]).toMatchObject({ articuloId: 'sin', referencia: 'R-sin', acabado: 'mate', estado: 'activo', unidadPresupuesto: 'm²', dimensiones: { espesorMm: 19 } });
  });
  it('las variantes pendientes de revisar (importador de PDF, «Crear familias y variantes») también se pueden elegir', () => {
    const pendiente = { id: 'v-pend', articuloId: 'imp', estado: 'pendiente' } as VarianteCatalogo;
    const lista = variantesStudio([art('imp')], [pendiente]);
    expect(lista.map((v) => v.id)).toEqual(['v-pend']);
  });
  it('un artículo con todas sus variantes descatalogadas sale por sí mismo', () => {
    const vieja = { id: 'v-vieja', articuloId: 'a', estado: 'descatalogado' } as VarianteCatalogo;
    expect(variantesStudio([art('a')], [vieja]).map((v) => v.id)).toEqual([PREFIJO_ARTICULO + 'a']);
  });
});
