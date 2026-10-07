import { collection, config, fields, singleton } from '@keystatic/core';
import { SLUG_REGEX } from './src/lib/catalogo/schema';
import { WHATSAPP_REGEX } from './src/lib/empresa/schema';
import { ICONOS_CONFIANZA } from './src/lib/portada/schema';

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

const textosPagina = (etiqueta: string) =>
  fields.object(
    {
      entradilla: textoBilingue('Entradilla', { multilinea: true }),
      seoDescripcion: textoBilingue('Descripción para Google', {
        multilinea: true,
        descripcion: 'Texto bajo el título en los resultados de búsqueda. Recomendado: menos de 155 caracteres.',
      }),
    },
    { label: etiqueta },
  );

const secciones = (etiqueta = 'Secciones') =>
  fields.array(
    fields.object({
      titulo: fields.object(
        {
          es: fields.text({ label: 'Título (español)' }),
          en: fields.text({ label: 'Título (inglés)' }),
        },
        { label: 'Título de la sección (opcional)' },
      ),
      texto: textoBilingue('Texto', {
        multilinea: true,
        descripcion: 'Separa los párrafos con una línea en blanco.',
      }),
    }),
    { label: etiqueta, itemLabel: (props) => props.fields.titulo.fields.es.value || 'Sección sin título' },
  );

const paginaFija = (label: string, clave: string, legal = false) =>
  singleton({
    label,
    path: `src/content/paginas/${clave}`,
    format: { data: 'yaml' },
    schema: {
      titulo: textoBilingue('Título'),
      entradilla: textoBilingue('Entradilla', { multilinea: true }),
      secciones: secciones(),
      seoDescripcion: textoBilingue('Descripción para Google', { multilinea: true }),
      pendienteRevision: fields.checkbox({
        label: 'Pendiente de revisión por el asesor',
        description: 'Muestra un aviso de que el texto no es definitivo.',
        defaultValue: legal,
      }),
    },
  });

const slugEntrada = fields.slug({
  name: {
    label: 'Identificador para la URL',
    description: 'Solo minúsculas, números y guiones. No lo cambies una vez publicado.',
    validation: {
      isRequired: true,
      pattern: { regex: SLUG_REGEX, message: 'Solo minúsculas sin acentos, números y guiones.' },
    },
  },
  slug: { label: 'Nombre del archivo', description: 'Debe ser igual que el identificador.' },
});

const publicacion = {
  datosDeEjemplo: fields.checkbox({ label: 'Datos de ejemplo' }),
  revisado: fields.checkbox({
    label: 'Revisado (publicar)',
    description: 'Solo lo revisado aparece en la web pública.',
  }),
};

export default config({
  storage: proyectoCloud ? { kind: 'cloud' } : import.meta.env.DEV ? { kind: 'local' } : { kind: 'cloud' },
  ...(proyectoCloud ? { cloud: { project: proyectoCloud } } : {}),
  locale: 'es-ES',
  ui: {
    brand: { name: 'Catálogo del vivero' },
  },
  singletons: {
    empresa: singleton({
      label: 'Empresa',
      path: 'src/content/ajustes/empresa',
      format: { data: 'yaml' },
      schema: {
        nombre: fields.text({
          label: 'Nombre de la empresa',
          description: 'Tal como debe aparecer en la web.',
          validation: { isRequired: true },
        }),
        telefono: fields.text({ label: 'Teléfono', description: 'Con prefijo, ej. +34 600 000 000.' }),
        whatsapp: fields.text({
          label: 'WhatsApp',
          description:
            'Número con prefijo de país, solo dígitos, sin "+" ni espacios (ej. 34600000000). Si se deja vacío, no se muestra el botón de WhatsApp.',
          validation: { pattern: { regex: WHATSAPP_REGEX, message: 'Solo dígitos con prefijo de país, ej. 34600000000' } },
        }),
        email: fields.text({ label: 'Email de contacto' }),
        direccion: fields.text({ label: 'Dirección', multiline: true }),
      },
    }),
    textosCatalogo: singleton({
      label: 'Textos del catálogo',
      path: 'src/content/ajustes/catalogo',
      format: { data: 'yaml' },
      schema: {
        catalogo: textosPagina('Catálogo completo'),
        palmeras: textosPagina('Palmeras'),
        olivos: textosPagina('Olivos'),
        higueras: textosPagina('Higueras'),
        'otras-ornamentales': textosPagina('Otras ornamentales'),
      },
    }),
    nosotros: paginaFija('Página: Nosotros', 'nosotros'),
    reparto: paginaFija('Página: Reparto', 'reparto'),
    avisoLegal: paginaFija('Legal: Aviso legal', 'aviso-legal', true),
    privacidad: paginaFija('Legal: Privacidad', 'privacidad', true),
    cookies: paginaFija('Legal: Cookies', 'cookies', true),
    portada: singleton({
      label: 'Portada',
      path: 'src/content/ajustes/portada',
      format: { data: 'yaml' },
      schema: {
        titular: textoBilingue('Titular', { descripcion: 'Primera parte del titular principal.' }),
        titularDestacado: textoBilingue('Final del titular (resaltado)', {
          descripcion: 'Se muestra en color lima justo después del titular.',
        }),
        entradilla: textoBilingue('Entradilla', { multilinea: true }),
        tituloFranja: textoBilingue('Título de la franja de especies'),
        confianza: fields.array(
          fields.object({
            icono: fields.select({
              label: 'Icono',
              options: [
                { label: 'Origen', value: 'origen' },
                { label: 'Documentación', value: 'documentacion' },
                { label: 'Reparto', value: 'reparto' },
                { label: 'Calidad', value: 'calidad' },
              ] satisfies { label: string; value: (typeof ICONOS_CONFIANZA)[number] }[],
              defaultValue: 'origen',
            }),
            titulo: textoBilingue('Título'),
            texto: textoBilingue('Texto', { multilinea: true }),
          }),
          {
            label: 'Bloque de confianza',
            description: 'Hasta 6 puntos (origen, documentación, reparto…). No pongas nada que no esté confirmado.',
            itemLabel: (props) => props.fields.titulo.fields.es.value || 'Punto sin título',
            validation: { length: { max: 6 } },
          },
        ),
        mision: textoBilingue('Misión', { multilinea: true }),
        vision: textoBilingue('Visión', { multilinea: true }),
        llamadaTitulo: textoBilingue('Llamada a presupuesto: título'),
        llamadaTexto: textoBilingue('Llamada a presupuesto: texto', { multilinea: true }),
      },
    }),
  },
  collections: {
    proyectos: collection({
      label: 'Proyectos',
      path: 'src/content/proyectos/*',
      slugField: 'slug',
      format: { data: 'yaml' },
      columns: ['ubicacion', 'revisado'],
      schema: {
        slug: slugEntrada,
        titulo: textoBilingue('Título'),
        resumen: textoBilingue('Resumen', { multilinea: true }),
        ubicacion: fields.text({ label: 'Ubicación', validation: { isRequired: true } }),
        especies: fields.array(fields.relationship({ label: 'Especie', collection: 'catalogo', validation: { isRequired: true } }), {
          label: 'Especies utilizadas',
          itemLabel: (props) => props.value ?? 'Elige una especie',
        }),
        fotos: fields.array(
          fields.object({
            imagen: fields.image({
              label: 'Foto',
              directory: 'src/assets/proyectos',
              publicPath: '../../assets/proyectos/',
              validation: { isRequired: true },
            }),
            alt: textoBilingue('Texto alternativo'),
          }),
          { label: 'Fotos', itemLabel: (props) => props.fields.alt.fields.es.value || 'Foto sin descripción' },
        ),
        secciones: secciones(),
        seoDescripcion: textoBilingue('Descripción para Google', { multilinea: true }),
        ...publicacion,
      },
    }),
    guias: collection({
      label: 'Guías',
      path: 'src/content/guias/*',
      slugField: 'slug',
      format: { data: 'yaml' },
      columns: ['revisado'],
      schema: {
        slug: slugEntrada,
        titulo: textoBilingue('Título'),
        resumen: textoBilingue('Resumen', { multilinea: true }),
        secciones: secciones(),
        seoDescripcion: textoBilingue('Descripción para Google', { multilinea: true }),
        ...publicacion,
      },
    }),
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
        silueta: fields.select({
          label: 'Dibujo provisional',
          description: 'Silueta que se muestra mientras no haya fotos y en el comparador de escala.',
          options: [
            { label: 'Según la familia', value: '' },
            { label: 'Palmera', value: 'palmera' },
            { label: 'Árbol de copa alargada (olivo)', value: 'olivo' },
            { label: 'Árbol de copa redonda (higuera, cítricos)', value: 'higuera' },
            { label: 'Planta baja en roseta (cica, yuca)', value: 'cica' },
          ],
          defaultValue: '',
        }),
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
