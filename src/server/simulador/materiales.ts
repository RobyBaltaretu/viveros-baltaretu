export interface MaterialOption {
  id: string;
  nombre: string;
  descripcion: string;
  promptDescriptor: string;
  finish: string;
  grainDirection?: string;
  previewColor?: string;
  categoria: 'mueble' | 'encimera' | 'suelo';
}

export interface RenovationConfig {
  spaceType: string;
  cabinetStyle?: string;
  openingSystem?: string;
  floorToCeiling?: boolean;
  zones: {
    cabinets: boolean;
    countertop: boolean;
    flooring: boolean;
    lighting: boolean;
  };
  upperMaterial: MaterialOption;
  lowerMaterial: MaterialOption;
  countertopMaterial: MaterialOption;
  includeBacksplash?: boolean;
  flooringMaterial: MaterialOption;
  lighting: {
    underCabinetLed: boolean;
    colorTemp: string;
  };
}

export interface RenovationRequestPayload {
  spaceType: string;
  cabinetStyle?: string;
  floorToCeiling?: boolean;
  zones: {
    cabinets: boolean;
    countertop: boolean;
    flooring: boolean;
    lighting: boolean;
  };
  upperMaterialId: string;
  lowerMaterialId: string;
  countertopMaterialId: string;
  includeBacksplash?: boolean;
  flooringMaterialId: string;
  lighting: {
    underCabinetLed: boolean;
    colorTemp: string;
  };
}

export const MATERIALES_MUEBLE: MaterialOption[] = [
  {
    id: 'roble-maya',
    nombre: 'Roble Natural Maya',
    descripcion: 'Beta vertical con veteado realista y acabado mate poro de madera.',
    promptDescriptor: 'natural Maya Oak wood veneer with realistic vertical wood grain texture',
    finish: 'matte wood-pore finish',
    grainDirection: 'vertical grain alignment',
    previewColor: '#B89772',
    categoria: 'mueble',
  },
  {
    id: 'nogal-americano',
    nombre: 'Nogal Americano Cálido',
    descripcion: 'Veteado catedral elegante y tono cálido atemporal.',
    promptDescriptor: 'warm American Walnut wood veneer with rich cathedral grain patterns',
    finish: 'satin smooth wood finish',
    grainDirection: 'vertical cathedral grain alignment',
    previewColor: '#5C4033',
    categoria: 'mueble',
  },
  {
    id: 'blanco-softtouch',
    nombre: 'Blanco Grisáceo Soft-Touch',
    descripcion: 'Laqueado anti-huella minimalista y luminoso.',
    promptDescriptor: 'soft off-white ultra-matte anti-fingerprint lacquer',
    finish: 'silky soft-touch matte finish',
    grainDirection: 'smooth seamless surface',
    previewColor: '#F0EFEA',
    categoria: 'mueble',
  },
  {
    id: 'verde-oliva',
    nombre: 'Verde Oliva Suave Mate',
    descripcion: 'Tendencia mediterránea con elegante acabado sedoso.',
    promptDescriptor: 'soft olive green muted matte lacquer',
    finish: 'smooth silky matte finish',
    grainDirection: 'smooth uniform surface',
    previewColor: '#708238',
    categoria: 'mueble',
  },
  {
    id: 'gris-antracita',
    nombre: 'Gris Antracita Texturizado',
    descripcion: 'Efecto microtexturizado moderno símil metal/cemento.',
    promptDescriptor: 'dark charcoal anthracite micro-textured architectural finish',
    finish: 'subtle fine textured matte finish',
    grainDirection: 'uniform micro-texture',
    previewColor: '#36454F',
    categoria: 'mueble',
  },
];

export const MATERIALES_ENCIMERA: MaterialOption[] = [
  {
    id: 'calacatta-gold',
    nombre: 'Calacatta Gold',
    descripcion: 'Mármol blanco sintetizado con vetas doradas y grisáceas refinadas.',
    promptDescriptor: 'polished Calacatta Gold sintered stone countertop with elegant gold and soft grey veining',
    finish: 'polished glossy marble sheen with realistic reflections',
    previewColor: '#F5F5F0',
    categoria: 'encimera',
  },
  {
    id: 'negro-marquina',
    nombre: 'Negro Marquina Pulido',
    descripcion: 'Mármol negro profundo con vetas blancas drásticas y contraste sofisticado.',
    promptDescriptor: 'polished deep Black Marquina marble with striking crisp white veining',
    finish: 'high-gloss polished marble finish',
    previewColor: '#1C1C1C',
    categoria: 'encimera',
  },
  {
    id: 'granito-volcanico',
    nombre: 'Granito Gris / Piedra Volcánica',
    descripcion: 'Acabado mate abujardado natural y altamente resistente.',
    promptDescriptor: 'dark volcanic stone granite with bush-hammered matte tactile finish',
    finish: 'subtle matte stone texture',
    previewColor: '#4A4E51',
    categoria: 'encimera',
  },
  {
    id: 'roble-listonado',
    nombre: 'Madera Maciza Roble Listonado',
    descripcion: 'Tratado con aceites naturales contra humedad, tono sumamente cálido.',
    promptDescriptor: 'solid oiled butcher-block oak wood countertop with warm natural grain planking',
    finish: 'satin oil-treated wood finish',
    previewColor: '#C49A6C',
    categoria: 'encimera',
  },
];

export const MATERIALES_SUELO: MaterialOption[] = [
  {
    id: 'roble-espiga',
    nombre: 'Tarima Roble Espiga (Herringbone)',
    descripcion: 'Parquet de roble claro natural instalado en patrón espiga.',
    promptDescriptor: 'light natural oak herringbone parquet flooring with subtle bevels and realistic texture',
    finish: 'satin natural wood sheen with contact shadows',
    previewColor: '#D2B48C',
    categoria: 'suelo',
  },
  {
    id: 'porcelanico-microcemento',
    nombre: 'Porcelánico Microcemento Gris',
    descripcion: 'Formato continuo 120x120 cm con estética industrial limpia.',
    promptDescriptor: 'large-format 120x120 cm neutral grey microcement porcelain floor tiles with minimal joint lines',
    finish: 'smooth matte architectural concrete finish',
    previewColor: '#9E9E9E',
    categoria: 'suelo',
  },
  {
    id: 'hidraulico-mediterraneo',
    nombre: 'Hidráulico Artesanal Tradicional',
    descripcion: 'Patrones geométricos mediterráneos en tonos azul y tierra.',
    promptDescriptor: 'traditional handmade Spanish hydraulic cement tiles with soft Mediterranean blue and terracotta geometric patterns',
    finish: 'satin matte artisan tile sheen',
    previewColor: '#5B7C8D',
    categoria: 'suelo',
  },
];

export const ESTILOS_MUEBLE = [
  { id: 'moderno-gola', nombre: 'Moderno sin tirador (Gola)', descripcion: 'Perfiles integrados continuos de aspecto limpio y minimalista' },
  { id: 'unero-integrado', nombre: 'Uñero integrado', descripcion: 'Mecanizado discreto en el propio canto de la puerta' },
  { id: 'push-open', nombre: 'Pulsador Push-to-Open', descripcion: 'Frentes totalmente lisos sin hendiduras' },
  { id: 'marco-fino', nombre: 'Marco fino (Shaker moderno)', descripcion: 'Elegante moldura perimetral ultra-delgada de 12 mm' },
  { id: 'tirador-negro', nombre: 'Tirador lineal negro mate', descripcion: 'Contraste moderno con tiradores metálicos alargados' },
];

export const TIPOS_ESTANCIA = [
  { id: 'cocina', nombre: 'Cocina' },
  { id: 'armario', nombre: 'Armario Empotrado' },
  { id: 'vestidor', nombre: 'Vestidor' },
  { id: 'puertas', nombre: 'Puertas de Paso' },
  { id: 'salon', nombre: 'Salón / Mueble TV' },
];

/**
 * La configuración que llega del navegador, rehecha solo con lo del catálogo:
 * materiales, estilos y estancias por su id o nombre, y el resto como sí/no.
 * Así ningún texto libre de la petición llega a la IA.
 */
export function resolveRenovationConfig(payload: RenovationRequestPayload | RenovationConfig): RenovationConfig {
  const p = (payload ?? {}) as Partial<RenovationRequestPayload> & Partial<Pick<RenovationConfig, 'upperMaterial' | 'lowerMaterial' | 'countertopMaterial' | 'flooringMaterial'>>;
  const de = (lista: MaterialOption[], id: unknown, material?: MaterialOption) => lista.find((m) => m.id === id || m.id === material?.id) ?? lista[0]!;
  const si = (v: unknown) => v === true;
  const zonas = (p.zones ?? {}) as Partial<RenovationConfig['zones']>;
  const luz = (p.lighting ?? {}) as Partial<RenovationConfig['lighting']>;
  return {
    spaceType: TIPOS_ESTANCIA.find((e) => e.nombre === p.spaceType || e.id === p.spaceType)?.nombre ?? TIPOS_ESTANCIA[0]!.nombre,
    cabinetStyle: ESTILOS_MUEBLE.find((e) => e.nombre === p.cabinetStyle || e.id === p.cabinetStyle)?.nombre ?? ESTILOS_MUEBLE[0]!.nombre,
    floorToCeiling: si(p.floorToCeiling),
    zones: { cabinets: si(zonas.cabinets), countertop: si(zonas.countertop), flooring: si(zonas.flooring), lighting: si(zonas.lighting) },
    upperMaterial: de(MATERIALES_MUEBLE, p.upperMaterialId, p.upperMaterial),
    lowerMaterial: de(MATERIALES_MUEBLE, p.lowerMaterialId, p.lowerMaterial),
    countertopMaterial: de(MATERIALES_ENCIMERA, p.countertopMaterialId, p.countertopMaterial),
    includeBacksplash: si(p.includeBacksplash),
    flooringMaterial: de(MATERIALES_SUELO, p.flooringMaterialId, p.flooringMaterial),
    lighting: { underCabinetLed: si(luz.underCabinetLed), colorTemp: TEMPERATURAS_LED.includes(luz.colorTemp as never) ? luz.colorTemp! : TEMPERATURAS_LED[1] },
  };
}

export const TEMPERATURAS_LED = ['2700K warm white', '3000K neutral white'] as const;
