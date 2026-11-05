import { describe, expect, it } from 'vitest';
import type { ArticuloCatalogo, VarianteCatalogo } from '../../src/server/data/tipos.ts';
import { PREFIJO_ARTICULO, variantesStudio } from '../../src/server/simulador/materiales-studio.ts';

const art = (id: string, extra: Partial<ArticuloCatalogo> = {}) => ({ id, nombre: id, categoria: 'tableros', unidad: 'm²', referencia: 'R-' + id, acabado: 'mate', espesor: 19, proveedor: '', archivado: false, actualizado: '2026-11-05', ...extra }) as ArticuloCatalogo;

describe('materiales de Turia Studio', () => {
  it('incluye los artículos sin variantes y no repite los que ya tienen', () => {
    const variante = { id: 'v1', articuloId: 'con', estado: 'activo' } as VarianteCatalogo;
    const lista = variantesStudio([art('con'), art('sin'), art('obra', { categoria: 'mano-obra' }), art('viejo', { archivado: true })], [variante]);
    expect(lista.map((v) => v.id)).toEqual(['v1', PREFIJO_ARTICULO + 'sin']);
    expect(lista[1]).toMatchObject({ articuloId: 'sin', referencia: 'R-sin', acabado: 'mate', estado: 'activo', unidadPresupuesto: 'm²', dimensiones: { espesorMm: 19 } });
  });
});
