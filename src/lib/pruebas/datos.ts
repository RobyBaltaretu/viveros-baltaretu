/**
 * Datos de prueba para ver la web completa en local y en las vistas previas de
 * rama. Solo rellenan huecos pendientes y nunca se usan en producción: allí se
 * siguen viendo los [PLACEHOLDER] hasta que se metan los datos reales en el panel.
 *
 * Los contactos usan valores que no llevan a nadie: email en example.com
 * (dominio reservado) y teléfonos ficticios.
 */
import type { Condiciones } from '../condiciones/schema';
import type { Empresa } from '../empresa/schema';
import type { ClavePagina, Pagina } from '../paginas/schema';
import type { Portada } from '../portada/schema';
import type { Parcial } from './rellenar';

export const empresaDePrueba: Parcial<Empresa> = {
  telefono: '+34 960 000 000',
  whatsapp: '34600000000',
  email: 'pedidos@example.com',
  direccion: 'Camino de prueba, s/n\n46000 Valencia',
};

export const condicionesDePrueba: Parcial<Condiciones> = {
  pedidoMinimo: {
    es: 'Pedido mínimo al por mayor: 300 € o un palet completo, combinando especies.',
    en: 'Minimum wholesale order: €300 or a full pallet, mixing species as you like.',
  },
  plazosMayor: {
    es: 'Entrega en 3 a 7 días laborables según la zona, en camión con plataforma.',
    en: 'Delivered in 3 to 7 working days depending on the area, by flatbed lorry.',
  },
  envioUnidad: {
    es: 'Envío por unidad desde 12 € a la península, en 48 a 72 h laborables, con embalaje protegido.',
    en: 'Single plants ship from €12 to mainland Spain, in 48 to 72 working hours, in protective packaging.',
  },
};

const texto = (es: string, en: string) => ({ es, en });

export const portadaDePrueba: Parcial<Portada> = {
  pasos: [
    undefined,
    undefined,
    {
      texto: texto(
        'A tu obra, tu tienda o tu casa, en toda España. Al por mayor en 3 a 7 días laborables; por unidad, en 48 a 72 h.',
        'To your site, shop or home, anywhere in Spain. Wholesale in 3 to 7 working days; single plants in 48 to 72 hours.',
      ),
    },
  ],
  confianza: [
    {
      texto: texto(
        'Cultivo propio en la provincia de Valencia: cada planta crece en el vivero hasta su formato de venta.',
        'Grown in our own nursery in the province of Valencia, each plant is raised to its sale size on site.',
      ),
    },
    {
      texto: texto(
        'Cada envío sale con su pasaporte fitosanitario y el albarán con especies, alturas y cantidades.',
        'Every shipment leaves with its plant passport and a delivery note listing species, heights and quantities.',
      ),
    },
    {
      texto: texto(
        'Desde la provincia de Valencia: al por mayor en 3 a 7 días laborables y por unidad en 48 a 72 h.',
        'From the province of Valencia: wholesale in 3 to 7 working days, single plants in 48 to 72 hours.',
      ),
    },
  ],
  mision: texto(
    'Que jardinerías, paisajistas y particulares tengan la planta que necesitan, con la medida exacta y sin sorpresas.',
    'To get garden centres, landscapers and home gardeners the plants they need, at the exact size, with no surprises.',
  ),
  vision: texto(
    'Ser el vivero de referencia del Mediterráneo para planta ornamental de hasta 4 m.',
    'To be the go-to Mediterranean nursery for ornamental plants up to 4 m.',
  ),
};

const legal = texto(
  'Texto de prueba para maquetar la página. El texto definitivo lo redacta y lo revisa un asesor legal.',
  'Placeholder copy to lay out the page. The final text is drafted and reviewed by a legal adviser.',
);
const paginaLegal: Parcial<Pagina> = { secciones: [{ texto: legal }, { texto: legal }, { texto: legal }] };

export const paginasDePrueba: Partial<Record<ClavePagina, Parcial<Pagina>>> = {
  nosotros: {
    entradilla: texto(
      'Viveros Baltaretu cultiva palmeras, olivos, higueras y ornamentales de hasta 4 m en la provincia de Valencia.',
      'Viveros Baltaretu grows palms, olive trees, fig trees and ornamentals up to 4 m in the province of Valencia.',
    ),
    secciones: [
      {
        texto: texto(
          'Somos un vivero familiar dedicado a la venta al por mayor para jardinerías, paisajistas y obra.\n\nEn algunas especies vendemos también por unidad y enviamos la planta a casa.',
          'We are a family-run nursery selling wholesale to garden centres, landscapers and contractors.\n\nFor some species we also sell single plants and ship them to your door.',
        ),
      },
      {
        texto: texto(
          'Cultivamos en contenedor y en tierra, con riego por goteo y planta adaptada al clima mediterráneo.',
          'We grow in containers and in the ground, on drip irrigation, with plants suited to the Mediterranean climate.',
        ),
      },
    ],
  },
  reparto: {
    secciones: [
      {
        texto: texto(
          'Repartimos en toda la península. Baleares y Canarias, bajo consulta.',
          'We deliver across mainland Spain. Balearic and Canary Islands on request.',
        ),
      },
      {
        texto: texto(
          'Pedido mínimo de 300 € o un palet completo. Entrega en 3 a 7 días laborables, en camión con plataforma, con la planta en contenedor o con cepellón protegido.',
          'Minimum order €300 or a full pallet. Delivered in 3 to 7 working days by flatbed lorry, with plants in containers or with wrapped root balls.',
        ),
      },
      {
        texto: texto(
          'Las especies marcadas "También por unidad" se envían por mensajería, desde 12 € a la península, en 48 a 72 h laborables.',
          'Species marked "Single plants too" ship by courier, from €12 to mainland Spain, in 48 to 72 working hours.',
        ),
      },
      {
        texto: texto(
          'Para pedidos al por mayor, hace falta acceso para camión y personal para la descarga. Los envíos por unidad se entregan en puerta.',
          'Wholesale deliveries need lorry access and people to help unload. Single plants are delivered to the door.',
        ),
      },
      {
        texto: texto(
          'Cada envío lleva su pasaporte fitosanitario y el albarán.',
          'Every shipment carries its plant passport and delivery note.',
        ),
      },
    ],
  },
  'aviso-legal': paginaLegal,
  privacidad: paginaLegal,
  cookies: paginaLegal,
};
