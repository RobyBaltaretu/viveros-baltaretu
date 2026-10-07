import { collection, config, fields } from '@keystatic/core';
import { SLUG_REGEX } from './src/lib/catalogo/schema';

/**
 * Panel del catálogo en /keystatic.
 *
 * - Con PUBLIC_KEYSTATIC_CLOUD_PROJECT definido ("equipo/proyecto"), el panel usa
 *   Keystatic Cloud: el gerente entra con su cuenta de Keystatic Cloud (sin GitHub)
 *   y cada guardado es un commit en la rama principal del repositorio.
 * - Sin esa variable, solo en desarrollo, se edita directamente en disco. Requiere Node:
 *   usa `npm run panel:local` (el modo local de Keystatic no funciona en workerd).
 *
 * Los campos y valores deben coincidir con el esquema Zod de
 * src/lib/catalogo/schema.ts, que es el que valida cada build.
 */
const proyectoCloud = import.meta.env.PUBLIC_KEYSTATIC_CLOUD_PROJECT as `${string}/${string}` | undefined;

const textoBilingue = (etiqueta: string, opciones: { multilinea?: boolean; descripcion?: string } = {}) =>
  fields.object(
    {
      es: fields.text({
        label: `${etiqueta} (español)`,
        multiline: opciones.multilinea,
        validation: { isRequired: true },
      }),
      en: fields.text({
        label: `${etiqueta} (inglés)`,
        description: 'Redactado en inglés, no traducción literal.',
        multiline: opciones.multilinea,
        validation: { isRequired: true },
      }),
    },
    { label: etiqueta, description: opciones.descripcion },
  );

const seoIdioma = (idioma: string) =>
  fields.object(
    {
      titulo: fields.text({
        label: `Título SEO (${idioma})`,
        description: 'Aparece en Google y en la pestaña del navegador. Recomendado: menos de 60 caracteres.',
        validation: { isRequired: true },
      }),
      descripcion: fields.text({
        label: `Descripción SEO (${idioma})`,
        description: 'Texto bajo el título en Google. Recomendado: menos de 155 caracteres.',
        multiline: true,
        validation: { isRequired: true },
      }),
    },
    { label: `SEO (${idioma})` },
  );

export default config({
  storage: proyectoCloud ? { kind: 'cloud' } : import.meta.env.DEV ? { kind: 'local' } : { kind: 'cloud' },
  ...(proyectoCloud ? { cloud: { project: proyectoCloud } } : {}),
  locale: 'es-ES',
  ui: {
    brand: { name: 'Catálogo del vivero' },
  },
  collections: {
    catalogo: collection({
      label: 'Catálogo',
      path: 'src/content/catalogo/*',
      slugField: 'slug',
      format: { contentField: 'contenido' },
      columns: ['nombreCientifico', 'disponibilidad', 'revisado'],
      schema: {
        slug: fields.slug({
          name: {
            label: 'Identificador para la URL',
            description: 'Solo minúsculas, números y guiones. Ejemplo: palmera-canaria. No lo cambies en fichas ya publicadas.',
            validation: {
              isRequired: true,
              pattern: { regex: SLUG_REGEX, message: 'Solo minúsculas sin acentos, números y guiones (ej. palmera-canaria).' },
            },
          },
          slug: {
            label: 'Nombre del archivo',
            description: 'Debe ser igual que el identificador.',
          },
        }),
        familia: fields.select({
          label: 'Familia',
          options: [
            { label: 'Palmeras', value: 'palmeras' },
            { label: 'Olivos', value: 'olivos' },
            { label: 'Higueras', value: 'higueras' },
            { label: 'Otras ornamentales', value: 'otras-ornamentales' },
          ],
          defaultValue: 'palmeras',
        }),
        nombre: textoBilingue('Nombre común'),
        nombreCientifico: fields.text({ label: 'Nombre científico', validation: { isRequired: true } }),
        descripcion: textoBilingue('Descripción', { multilinea: true }),
        alturaMin: fields.number({
          label: 'Altura mínima (m)',
          step: 0.1,
          validation: { isRequired: true, min: 0.1 },
        }),
        alturaMax: fields.number({
          label: 'Altura máxima (m)',
          step: 0.1,
          validation: { isRequired: true, min: 0.1 },
        }),
        perimetroTroncoCm: fields.array(
          fields.integer({ label: 'Perímetro (cm)', validation: { isRequired: true, min: 1 } }),
          {
            label: 'Perímetro de tronco (cm), opcional',
            description: 'Déjalo vacío si no aplica. Si se rellena, añade dos valores: primero el mínimo y después el máximo.',
            itemLabel: (props) => `${props.value ?? '?'} cm`,
            validation: { length: { max: 2 } },
          },
        ),
        formatos: fields.multiselect({
          label: 'Formatos',
          description: 'Marca al menos uno.',
          options: [
            { label: 'Contenedor', value: 'contenedor' },
            { label: 'Cepellón', value: 'cepellon' },
            { label: 'Raíz desnuda', value: 'raiz-desnuda' },
          ],
        }),
        disponibilidad: fields.select({
          label: 'Disponibilidad',
          options: [
            { label: 'Disponible', value: 'disponible' },
            { label: 'Bajo pedido', value: 'bajo-pedido' },
            { label: 'Agotado', value: 'agotado' },
          ],
          defaultValue: 'bajo-pedido',
        }),
        precioDesde: fields.number({
          label: 'Precio desde (€)',
          description: 'Se muestra como "desde X €". Déjalo vacío para mostrar "precio bajo presupuesto".',
          step: 0.01,
          validation: { min: 0.01 },
        }),
        unidadPrecio: fields.select({
          label: 'Unidad del precio',
          options: [{ label: 'Unidad', value: 'unidad' }],
          defaultValue: 'unidad',
        }),
        origen: fields.text({ label: 'Origen', validation: { isRequired: true } }),
        destacada: fields.checkbox({ label: 'Destacada', description: 'Se mostrará en la portada.' }),
        fotos: fields.array(
          fields.object({
            imagen: fields.image({
              label: 'Foto',
              description: 'Fotos reales del vivero. JPG o WebP, idealmente de 2000 px de ancho como máximo.',
              directory: 'src/assets/catalogo',
              // Ruta relativa a src/content/catalogo/ para que Astro optimice la imagen.
              publicPath: '../../assets/catalogo/',
              validation: { isRequired: true },
            }),
            alt: textoBilingue('Texto alternativo', {
              descripcion: 'Describe lo que se ve en la foto, para personas que no pueden verla.',
            }),
          }),
          {
            label: 'Fotos',
            itemLabel: (props) => props.fields.alt.fields.es.value || 'Foto sin descripción',
          },
        ),
        seo: fields.object({ es: seoIdioma('español'), en: seoIdioma('inglés') }, { label: 'SEO' }),
        datosDeEjemplo: fields.checkbox({
          label: 'Datos de ejemplo',
          description: 'Marcado en las fichas de prueba. Desmárcalo cuando los datos sean reales.',
        }),
        revisado: fields.checkbox({
          label: 'Revisado (publicar)',
          description: 'Solo las fichas revisadas aparecen en la web pública. Márcalo cuando todos los datos estén confirmados.',
        }),
        contenido: fields.emptyContent({ extension: 'md' }),
      },
    }),
  },
});
