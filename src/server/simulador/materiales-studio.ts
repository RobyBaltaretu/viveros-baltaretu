import type { ArticuloCatalogo, VarianteCatalogo } from '../data/tipos.ts';

/**
 * Materiales que se pueden poner en una pieza de Turia Studio: las variantes
 * activas del catálogo y, además, cada artículo que no tiene variantes (los del
 * catálogo de partida o dados de alta a mano), como una «variante» con id
 * `articulo:<id>` y los datos del artículo. Sin mano de obra ni servicios.
 * Lo usan el selector, la generación de la imagen y el despiece: así todos ven lo mismo.
 */
export const PREFIJO_ARTICULO = 'articulo:';
/**
 * Una variante vale para Studio si no está descatalogada. Las «pendientes» son
 * las que crean el importador de PDF y «Crear familias y variantes»: están en el
 * catálogo y se usan en presupuestos, así que también se pueden elegir aquí
 * (antes se ocultaban y, como el artículo ya tenía variante, no salía ningún material).
 */
export const varianteUsable = (v: Pick<VarianteCatalogo, 'estado'>) => v.estado !== 'descatalogado';
const NO_MATERIAL = new Set(['mano-obra', 'servicios']);

export function variantesStudio(articulos: ArticuloCatalogo[], variantes: VarianteCatalogo[]): VarianteCatalogo[] {
  const vivos = new Map(articulos.filter((a) => !a.archivado && !NO_MATERIAL.has(a.categoria)).map((a) => [a.id, a]));
  const reales = variantes.filter((v) => vivos.has(v.articuloId) && varianteUsable(v));
  // Un artículo cuyas variantes están todas descatalogadas sigue saliendo por sí mismo.
  const conVariante = new Set(reales.map((v) => v.articuloId));
  const sueltos = [...vivos.values()]
    .filter((a) => !conVariante.has(a.id))
    .map(
      (a): VarianteCatalogo => ({
        id: PREFIJO_ARTICULO + a.id,
        familiaId: '',
        articuloId: a.id,
        referencia: a.referencia,
        codigo: '',
        codigoDecorativo: '',
        soporte: '',
        dimensiones: { largoMm: null, anchoMm: null, altoMm: null, fondoMm: null, espesorMm: a.espesor ?? null, textoOriginal: '', unidadOriginal: '' },
        acabado: a.acabado,
        tratamiento: '',
        calidad: '',
        propiedades: {},
        unidadCompra: a.unidad,
        unidadConsumo: a.unidad,
        unidadPresupuesto: a.unidad,
        unidadesPaquete: null,
        factorConversion: 1,
        disponibilidad: 'desconocida',
        estado: 'activo',
        decorativoIds: [],
        origen: { proveedor: a.proveedor, documento: '', pagina: null, metodo: 'manual', confianza: null, revision: 'verificado' },
        actualizado: a.actualizado,
      }),
    );
  return [...reales, ...sueltos];
}
