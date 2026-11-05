import type { ArticuloCatalogo, VarianteCatalogo } from "../data/tipos.ts";

/**
 * Materiales que se pueden poner en una pieza de Turia Studio: las variantes
 * activas del catálogo y, además, cada artículo que no tiene variantes (los del
 * catálogo de partida o dados de alta a mano), como una «variante» con id
 * `articulo:<id>` y los datos del artículo. Sin mano de obra ni servicios.
 * Lo usan el selector, la generación de la imagen y el despiece: así todos ven lo mismo.
 */
export const PREFIJO_ARTICULO = "articulo:";
/**
 * Una variante vale para Studio si no está descatalogada. Las «pendientes» son
 * las que crean el importador de PDF y «Crear familias y variantes»: están en el
 * catálogo y se usan en presupuestos, así que también se pueden elegir aquí
 * (antes se ocultaban y, como el artículo ya tenía variante, no salía ningún material).
 */
export const varianteUsable = (v: Pick<VarianteCatalogo, "estado">) =>
  v.estado !== "descatalogado";
const NO_MATERIAL = new Set(["mano-obra", "servicios"]);

export function variantesStudio(
  articulos: ArticuloCatalogo[],
  variantes: VarianteCatalogo[],
): VarianteCatalogo[] {
  const vivos = new Map(
    articulos
      .filter((a) => !a.archivado && !NO_MATERIAL.has(a.categoria))
      .map((a) => [a.id, a]),
  );
  const reales = variantes.filter(
    (v) => vivos.has(v.articuloId) && varianteUsable(v),
  );
  // Un artículo cuyas variantes están todas descatalogadas sigue saliendo por sí mismo.
  const conVariante = new Set(reales.map((v) => v.articuloId));
  const sueltos = [...vivos.values()]
    .filter((a) => !conVariante.has(a.id))
    .map(comoVariante);
  return [...reales, ...sueltos];
}

/** Un artículo como «variante» de Studio (id `articulo:<id>`). */
const comoVariante = (a: ArticuloCatalogo): VarianteCatalogo => ({
  id: PREFIJO_ARTICULO + a.id,
  familiaId: "",
  articuloId: a.id,
  referencia: a.referencia,
  codigo: "",
  codigoDecorativo: "",
  soporte: "",
  dimensiones: {
    largoMm: null,
    anchoMm: null,
    altoMm: null,
    fondoMm: null,
    espesorMm: a.espesor ?? null,
    textoOriginal: "",
    unidadOriginal: "",
  },
  acabado: a.acabado,
  tratamiento: "",
  calidad: "",
  propiedades: {},
  unidadCompra: a.unidad,
  unidadConsumo: a.unidad,
  unidadPresupuesto: a.unidad,
  unidadesPaquete: null,
  factorConversion: 1,
  disponibilidad: "desconocida",
  estado: "activo",
  decorativoIds: [],
  origen: {
    proveedor: a.proveedor,
    documento: "",
    pagina: null,
    metodo: "manual",
    confianza: null,
    revision: "verificado",
  },
  actualizado: a.actualizado,
});

/**
 * Para buscar por id lo que se eligió: lo del selector y, además, cada artículo
 * vivo como `articulo:<id>` aunque ahora ya tenga variantes (se eligió cuando no
 * las tenía, p. ej. antes de «Crear familias y variantes»). Sin esto, el boceto
 * dejaba de guardarse con «La referencia del material no existe en el catálogo».
 */
export function materialesStudioPorId(
  articulos: ArticuloCatalogo[],
  variantes: VarianteCatalogo[],
): Map<string, VarianteCatalogo> {
  const mapa = new Map(
    variantesStudio(articulos, variantes).map((v) => [v.id, v]),
  );
  for (const a of articulos)
    if (
      !a.archivado &&
      !NO_MATERIAL.has(a.categoria) &&
      !mapa.has(PREFIJO_ARTICULO + a.id)
    )
      mapa.set(PREFIJO_ARTICULO + a.id, comoVariante(a));
  return mapa;
}
