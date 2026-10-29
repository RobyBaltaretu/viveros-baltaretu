import type { ArticuloCatalogo, ComponentePlantilla, OpcionPlantilla, ParametroPlantilla, PlantillaCatalogo, Repositorios } from '../data/tipos.ts';
import { categoria, MARGEN_PROPUESTO } from './catalogo.ts';

/**
 * Catálogo de partida de una carpintería a medida: los artículos habituales y
 * las plantillas de los trabajos más comunes, con su escandallo (qué piezas,
 * cantos, herrajes, acabados, horas y servicios lleva cada uno). Es
 * conocimiento del sector, no datos de ningún negocio:
 * - Los artículos llegan **sin precio** (coste 0): cada negocio pone los suyos.
 * - Las fórmulas (horas por m², bisagras por puerta…) son una estimación de
 *   partida que cada negocio ajusta a su forma de trabajar.
 * Los precios de ejemplo solo se usan en los «Datos de prueba».
 */

type Partida = [id: string, categoria: string, nombre: string, unidad: string, espesor: number | null, acabado: string, costeEjemplo: number];

const ARTICULOS: Partida[] = [
  ['tablero-melamina-blanca-19', 'tableros', 'Melamina blanca 19 mm', 'm²', 19, 'Blanco', 9.5],
  ['tablero-melamina-madera-19', 'tableros', 'Melamina efecto madera 19 mm', 'm²', 19, 'Roble', 12],
  ['tablero-fondo-3', 'tableros', 'Tablero de fondo 3 mm (traseras)', 'm²', 3, 'Blanco', 3.5],
  ['tablero-mdf-lacar-19', 'tableros', 'MDF para lacar 19 mm', 'm²', 19, '', 14],
  ['tablero-mdf-hidrofugo-19', 'tableros', 'MDF hidrófugo 19 mm', 'm²', 19, '', 17],
  ['tablero-contrachapado-18', 'tableros', 'Contrachapado de abedul 18 mm', 'm²', 18, '', 32],
  ['tablero-rechapado-roble-19', 'tableros', 'Tablero rechapado de roble 19 mm', 'm²', 19, 'Roble natural', 38],
  ['macizo-roble-20', 'macizos', 'Roble macizo 20 mm', 'm²', 20, 'Roble', 95],
  ['macizo-pino-marco', 'macizos', 'Pino para precerco y marco', 'ml', null, '', 6],
  ['macizo-tapajuntas', 'macizos', 'Tapajuntas de MDF lacado 70 mm', 'ml', null, 'Blanco', 3.2],
  ['macizo-rastrel', 'macizos', 'Rastrel de pino 40 × 20 mm', 'ml', null, '', 1.1],
  ['macizo-tarima-roble', 'macizos', 'Tarima de roble 14 mm', 'm²', 14, 'Roble natural', 42],
  ['macizo-rodapie', 'macizos', 'Rodapié de MDF lacado 7 cm', 'ml', null, 'Blanco', 2.8],
  ['chapa-laminado-hpl', 'chapas', 'Laminado HPL 0,8 mm', 'm²', 0.8, '', 18],
  ['canto-pvc-1', 'cantos', 'Canto de PVC 1 mm', 'ml', 1, 'A juego', 0.35],
  ['canto-pvc-2', 'cantos', 'Canto de PVC 2 mm', 'ml', 2, 'A juego', 0.6],
  ['canto-chapa-roble', 'cantos', 'Canto de chapa de roble', 'ml', 0.5, 'Roble', 0.9],
  ['encimera-laminada', 'encimeras', 'Encimera laminada 38 mm', 'ml', 38, '', 45],
  ['encimera-compacta', 'encimeras', 'Encimera compacta 12 mm', 'ml', 12, '', 180],
  ['cristal-espejo-4', 'cristal', 'Espejo 4 mm', 'm²', 4, '', 35],
  ['cristal-templado-6', 'cristal', 'Cristal templado 6 mm', 'm²', 6, '', 60],
  ['herraje-bisagra-cierre-suave', 'herrajes', 'Bisagra de cazoleta con cierre suave', 'ud', null, '', 2.8],
  ['herraje-kit-corredera', 'herrajes', 'Kit de correderas de armario (por puerta)', 'ud', null, '', 28],
  ['herraje-perfil-corredera', 'herrajes', 'Perfil de guía para correderas', 'ml', null, 'Aluminio', 9],
  ['herraje-guia-cajon', 'herrajes', 'Guías de cajón de extracción total con cierre suave (par)', 'ud', null, '', 18],
  ['herraje-soporte-balda', 'herrajes', 'Soporte de balda', 'ud', null, '', 0.15],
  ['herraje-pata-regulable', 'herrajes', 'Pata regulable de mueble de cocina', 'ud', null, '', 0.9],
  ['herraje-bisagra-puerta', 'herrajes', 'Bisagra de puerta de paso', 'ud', null, '', 2.5],
  ['herraje-manivela-cerradura', 'herrajes', 'Manivela y cerradura de puerta de paso', 'ud', null, '', 22],
  ['herraje-colgador-mueble', 'herrajes', 'Colgadores de mueble suspendido (par)', 'ud', null, '', 6],
  ['tirador-estandar', 'tiradores', 'Tirador estándar', 'ud', null, '', 3.5],
  ['tirador-perfil-unero', 'tiradores', 'Perfil uñero de aluminio', 'ml', null, 'Aluminio', 7],
  ['accesorio-barra-colgar', 'accesorios', 'Barra de colgar con soportes', 'ml', null, '', 6],
  ['accesorio-pantalonero', 'accesorios', 'Pantalonero extraíble', 'ud', null, '', 45],
  ['accesorio-zapatero', 'accesorios', 'Zapatero extraíble', 'ud', null, '', 38],
  ['luz-tira-led', 'iluminacion', 'Tira LED con perfil de aluminio', 'ml', null, 'Luz cálida', 14],
  ['luz-driver', 'iluminacion', 'Transformador y sensor de apertura', 'ud', null, '', 25],
  ['consumible-tornilleria', 'consumibles', 'Tornillería, colas y pequeño material (por trabajo)', 'ud', null, '', 15],
  ['consumible-manta', 'consumibles', 'Manta aislante para tarima', 'm²', null, '', 1.5],
  ['acabado-lacado', 'acabados', 'Lacado de poliuretano mate (por cara)', 'm²', null, 'Color a elegir', 18],
  ['acabado-barniz', 'acabados', 'Barnizado (por cara)', 'm²', null, 'Satinado', 12],
  ['acabado-aceite', 'acabados', 'Aceitado (por cara)', 'm²', null, 'Natural', 9],
  ['mano-taller', 'mano-obra', 'Hora de taller', 'h', null, '', 22],
  ['mano-montaje', 'mano-obra', 'Hora de montaje en obra', 'h', null, '', 22],
  ['servicio-transporte', 'servicios', 'Transporte y descarga', 'ud', null, '', 40],
  ['servicio-desplazamiento', 'servicios', 'Desplazamiento', 'ud', null, '', 15],
  ['servicio-retirada', 'servicios', 'Retirada de muebles viejos', 'ud', null, '', 30],
  ['servicio-medicion', 'servicios', 'Visita y toma de medidas', 'ud', null, '', 20],
];

const medida = (id: string, nombre: string, defecto: number, min: number, max: number): ParametroPlantilla => ({ id, nombre, tipo: 'medida', defecto, min, max });
const cuantos = (id: string, nombre: string, defecto: number, min: number, max: number): ParametroPlantilla => ({ id, nombre, tipo: 'numero', defecto, min, max });
const opcion = (id: string, nombre: string, categorias: string[], defecto: string): OpcionPlantilla => ({ id, nombre, categorias, defecto });
const fijo = (concepto: string, id: string, cantidad: string): ComponentePlantilla => ({ concepto, articulo: { id }, cantidad });
const elegido = (concepto: string, opcion: string, cantidad: string): ComponentePlantilla => ({ concepto, articulo: { opcion }, cantidad });

type DatosPlantilla = Omit<PlantillaCatalogo, 'orden' | 'archivado' | 'actualizado'>;

const PLANTILLAS: DatosPlantilla[] = [
  {
    id: 'armario-correderas',
    nombre: 'Armario empotrado de puertas correderas',
    tipoTrabajo: 'Armarios',
    descripcion: 'Casco con divisiones, baldas, cajones y barras, y puertas correderas con su perfil de guía.',
    parametros: [medida('ancho', 'Ancho', 200, 60, 600), medida('alto', 'Alto', 240, 100, 300), medida('fondo', 'Fondo', 60, 30, 80), cuantos('puertas', 'Puertas', 2, 1, 6), cuantos('baldas', 'Baldas', 2, 0, 20), cuantos('cajones', 'Cajones', 0, 0, 12), cuantos('barras', 'Barras de colgar', 1, 0, 6)],
    opciones: [opcion('cuerpo', 'Material del cuerpo', ['tableros'], 'tablero-melamina-blanca-19'), opcion('frentes', 'Material de las puertas', ['tableros', 'chapas', 'macizos'], 'tablero-melamina-blanca-19')],
    componentes: [
      elegido('Costados', 'cuerpo', '2 * alto * fondo'),
      elegido('Techo y suelo', 'cuerpo', '2 * ancho * fondo'),
      elegido('Divisiones', 'cuerpo', 'max(puertas - 1; 0) * alto * fondo'),
      elegido('Baldas', 'cuerpo', 'baldas * ancho / puertas * fondo'),
      elegido('Cajones (frente, laterales y fondo)', 'cuerpo', 'cajones * (ancho / puertas * 0,2 + 2 * fondo * 0,15 + ancho / puertas * fondo)'),
      elegido('Hojas de las puertas', 'frentes', 'ancho * alto * 1,05'),
      fijo('Canto de las piezas del cuerpo', 'canto-pvc-1', '2 * alto + 2 * ancho + max(puertas - 1; 0) * alto + baldas * ancho / puertas'),
      fijo('Canto de las puertas', 'canto-pvc-2', 'puertas * 2 * alto + 2 * ancho * 1,05'),
      fijo('Kit de correderas', 'herraje-kit-corredera', 'puertas'),
      fijo('Perfiles de guía superior e inferior', 'herraje-perfil-corredera', '2 * ancho'),
      fijo('Guías de cajón', 'herraje-guia-cajon', 'cajones'),
      fijo('Tiradores', 'tirador-estandar', 'puertas + cajones'),
      fijo('Barras de colgar', 'accesorio-barra-colgar', 'barras * ancho / puertas'),
      fijo('Soportes de balda', 'herraje-soporte-balda', 'baldas * 4'),
      fijo('Tornillería y colas', 'consumible-tornilleria', '1'),
      fijo('Fabricación en taller', 'mano-taller', '2 + 1,2 * ancho * alto + 0,5 * cajones'),
      fijo('Montaje en obra', 'mano-montaje', '2 + 0,75 * puertas + 0,3 * cajones'),
      fijo('Transporte', 'servicio-transporte', '1'),
    ],
  },
  {
    id: 'armario-abatible',
    nombre: 'Armario empotrado de puertas abatibles',
    tipoTrabajo: 'Armarios',
    descripcion: 'Casco con divisiones, baldas, cajones y barras, y puertas abatibles con bisagras de cierre suave.',
    parametros: [medida('ancho', 'Ancho', 180, 40, 600), medida('alto', 'Alto', 240, 60, 300), medida('fondo', 'Fondo', 60, 30, 80), cuantos('puertas', 'Puertas', 4, 1, 12), cuantos('baldas', 'Baldas', 3, 0, 30), cuantos('cajones', 'Cajones', 0, 0, 12), cuantos('barras', 'Barras de colgar', 1, 0, 6)],
    opciones: [opcion('cuerpo', 'Material del cuerpo', ['tableros'], 'tablero-melamina-blanca-19'), opcion('frentes', 'Material de las puertas', ['tableros', 'chapas', 'macizos'], 'tablero-melamina-blanca-19')],
    componentes: [
      elegido('Costados', 'cuerpo', '2 * alto * fondo'),
      elegido('Techo y suelo', 'cuerpo', '2 * ancho * fondo'),
      elegido('Divisiones', 'cuerpo', 'max(arriba(puertas / 2) - 1; 0) * alto * fondo'),
      elegido('Baldas', 'cuerpo', 'baldas * ancho / max(arriba(puertas / 2); 1) * fondo'),
      elegido('Cajones (frente, laterales y fondo)', 'cuerpo', 'cajones * (0,5 * 0,2 + 2 * fondo * 0,15 + 0,5 * fondo)'),
      elegido('Puertas', 'frentes', 'ancho * alto'),
      fijo('Canto de las piezas del cuerpo', 'canto-pvc-1', '2 * alto + 2 * ancho + baldas * ancho / max(arriba(puertas / 2); 1)'),
      fijo('Canto de las puertas', 'canto-pvc-2', 'puertas * 2 * (alto + ancho / puertas)'),
      fijo('Bisagras', 'herraje-bisagra-cierre-suave', 'puertas * max(2; arriba(alto / 0,6))'),
      fijo('Guías de cajón', 'herraje-guia-cajon', 'cajones'),
      fijo('Tiradores', 'tirador-estandar', 'puertas + cajones'),
      fijo('Barras de colgar', 'accesorio-barra-colgar', 'barras * ancho / max(arriba(puertas / 2); 1)'),
      fijo('Soportes de balda', 'herraje-soporte-balda', 'baldas * 4'),
      fijo('Tornillería y colas', 'consumible-tornilleria', '1'),
      fijo('Fabricación en taller', 'mano-taller', '2 + 1,4 * ancho * alto + 0,5 * cajones'),
      fijo('Montaje en obra', 'mano-montaje', '2 + 0,4 * puertas + 0,3 * cajones'),
      fijo('Transporte', 'servicio-transporte', '1'),
    ],
  },
  {
    id: 'vestidor',
    nombre: 'Vestidor abierto por módulos',
    tipoTrabajo: 'Vestidores',
    descripcion: 'Módulos abiertos con baldas, cajones, barras y luz opcional.',
    parametros: [medida('ancho', 'Ancho total', 300, 80, 1200), medida('alto', 'Alto', 240, 100, 300), medida('fondo', 'Fondo', 55, 30, 70), cuantos('modulos', 'Módulos', 4, 1, 20), cuantos('baldas', 'Baldas', 8, 0, 60), cuantos('cajones', 'Cajones', 4, 0, 30), cuantos('barras', 'Barras de colgar', 3, 0, 20), cuantos('luces', 'Módulos con luz', 0, 0, 20)],
    opciones: [opcion('cuerpo', 'Material', ['tableros'], 'tablero-melamina-madera-19'), opcion('frentes', 'Frentes de cajón', ['tableros', 'chapas', 'macizos'], 'tablero-melamina-madera-19')],
    componentes: [
      elegido('Costados y divisiones', 'cuerpo', '(modulos + 1) * alto * fondo'),
      elegido('Techo y suelo', 'cuerpo', '2 * ancho * fondo'),
      elegido('Baldas', 'cuerpo', 'baldas * ancho / modulos * fondo'),
      elegido('Cajones (laterales y fondo)', 'cuerpo', 'cajones * (2 * fondo * 0,15 + ancho / modulos * fondo)'),
      elegido('Frentes de cajón', 'frentes', 'cajones * ancho / modulos * 0,2'),
      fijo('Canto', 'canto-pvc-1', '(modulos + 1) * alto + 2 * ancho + baldas * ancho / modulos + cajones * 2 * (ancho / modulos + 0,2)'),
      fijo('Guías de cajón', 'herraje-guia-cajon', 'cajones'),
      fijo('Tiradores', 'tirador-estandar', 'cajones'),
      fijo('Barras de colgar', 'accesorio-barra-colgar', 'barras * ancho / modulos'),
      fijo('Soportes de balda', 'herraje-soporte-balda', 'baldas * 4'),
      fijo('Tira LED', 'luz-tira-led', 'luces * ancho / modulos'),
      fijo('Transformador y sensor', 'luz-driver', 'min(luces; 1)'),
      fijo('Tornillería y colas', 'consumible-tornilleria', '1'),
      fijo('Fabricación en taller', 'mano-taller', '2 + 1 * ancho * alto + 0,4 * cajones'),
      fijo('Montaje en obra', 'mano-montaje', '2 + 0,5 * modulos + 0,5 * min(luces; 1)'),
      fijo('Transporte', 'servicio-transporte', '1'),
    ],
  },
  {
    id: 'cocina',
    nombre: 'Cocina por metros',
    tipoTrabajo: 'Cocinas',
    descripcion: 'Muebles bajos (72 cm), altos (70 cm) y columnas con frentes, encimera, zócalo y herrajes. Medidas en metros lineales.',
    parametros: [medida('bajos', 'Metros de muebles bajos', 300, 0, 2000), medida('altos', 'Metros de muebles altos', 240, 0, 2000), cuantos('columnas', 'Columnas', 1, 0, 10), cuantos('cajones', 'Cajones', 3, 0, 40)],
    opciones: [
      opcion('cuerpo', 'Material de los cascos', ['tableros'], 'tablero-melamina-blanca-19'),
      opcion('frentes', 'Material de los frentes', ['tableros', 'chapas', 'macizos'], 'tablero-mdf-lacar-19'),
      opcion('encimera', 'Encimera', ['encimeras'], 'encimera-laminada'),
    ],
    componentes: [
      elegido('Cascos de los muebles bajos', 'cuerpo', 'bajos * 2,5'),
      elegido('Cascos de los muebles altos', 'cuerpo', 'altos * 1,6'),
      elegido('Cascos de las columnas', 'cuerpo', 'columnas * 4,5'),
      fijo('Traseras', 'tablero-fondo-3', 'bajos * 0,72 + altos * 0,7 + columnas * 0,6 * 2,1'),
      elegido('Frentes', 'frentes', 'bajos * 0,72 + altos * 0,7 + columnas * 0,6 * 2,1'),
      elegido('Zócalo', 'frentes', 'bajos * 0,1'),
      fijo('Lacado de los frentes (dos caras)', 'acabado-lacado', '2 * (bajos * 0,72 + altos * 0,7 + columnas * 0,6 * 2,1)'),
      fijo('Canto de los cascos', 'canto-pvc-1', 'bajos * 4 + altos * 3 + columnas * 6'),
      fijo('Bisagras', 'herraje-bisagra-cierre-suave', 'arriba(bajos / 0,6) * 2 + arriba(altos / 0,6) * 2 + columnas * 4'),
      fijo('Guías de cajón', 'herraje-guia-cajon', 'cajones'),
      fijo('Tiradores', 'tirador-estandar', 'arriba(bajos / 0,6) + arriba(altos / 0,6) + columnas * 2 + cajones'),
      fijo('Patas regulables', 'herraje-pata-regulable', 'arriba(bajos / 0,6) * 4 + columnas * 4'),
      elegido('Encimera', 'encimera', 'bajos'),
      fijo('Tornillería y colas', 'consumible-tornilleria', '1 + arriba(bajos + altos)'),
      fijo('Fabricación en taller', 'mano-taller', '4 + 3 * (bajos + altos) + 2 * columnas'),
      fijo('Montaje en obra', 'mano-montaje', '4 + 2 * (bajos + altos) + columnas'),
      fijo('Transporte', 'servicio-transporte', '1'),
    ],
  },
  {
    id: 'puerta-paso',
    nombre: 'Puerta de paso',
    tipoTrabajo: 'Puertas',
    descripcion: 'Hoja lacada con precerco, marco, tapajuntas por las dos caras, bisagras, manivela y cerradura.',
    parametros: [cuantos('puertas', 'Puertas', 1, 1, 30), medida('ancho', 'Ancho de la hoja', 82, 50, 120), medida('alto', 'Alto de la hoja', 203, 180, 260)],
    opciones: [opcion('hoja', 'Material de la hoja', ['tableros', 'macizos', 'chapas'], 'tablero-mdf-lacar-19')],
    componentes: [
      elegido('Hoja', 'hoja', 'puertas * ancho * alto'),
      fijo('Lacado de la hoja (dos caras)', 'acabado-lacado', 'puertas * ancho * alto * 2'),
      fijo('Precerco y marco', 'macizo-pino-marco', 'puertas * (2 * alto + ancho)'),
      fijo('Tapajuntas (dos caras)', 'macizo-tapajuntas', 'puertas * 2 * (2 * alto + ancho)'),
      fijo('Bisagras', 'herraje-bisagra-puerta', 'puertas * 3'),
      fijo('Manivela y cerradura', 'herraje-manivela-cerradura', 'puertas'),
      fijo('Fabricación en taller', 'mano-taller', 'puertas * 2,5'),
      fijo('Montaje en obra', 'mano-montaje', 'puertas * 1,5'),
      fijo('Transporte', 'servicio-transporte', '1'),
    ],
  },
  {
    id: 'mueble-medida',
    nombre: 'Mueble a medida (librería, mueble de TV, estantería)',
    tipoTrabajo: 'Mobiliario',
    descripcion: 'Caja con divisiones, baldas y trasera; puertas y cajones opcionales.',
    parametros: [medida('ancho', 'Ancho', 180, 30, 600), medida('alto', 'Alto', 200, 30, 300), medida('fondo', 'Fondo', 35, 15, 70), cuantos('divisiones', 'Divisiones', 2, 0, 20), cuantos('baldas', 'Baldas', 6, 0, 60), cuantos('puertas', 'Puertas', 0, 0, 20), medida('altopuertas', 'Alto de las puertas', 60, 0, 300), cuantos('cajones', 'Cajones', 0, 0, 20)],
    opciones: [opcion('cuerpo', 'Material del cuerpo', ['tableros', 'macizos'], 'tablero-melamina-madera-19'), opcion('frentes', 'Material de puertas y cajones', ['tableros', 'chapas', 'macizos'], 'tablero-melamina-madera-19')],
    componentes: [
      elegido('Costados', 'cuerpo', '2 * alto * fondo'),
      elegido('Techo y suelo', 'cuerpo', '2 * ancho * fondo'),
      elegido('Divisiones', 'cuerpo', 'divisiones * alto * fondo'),
      elegido('Baldas', 'cuerpo', 'baldas * ancho / (divisiones + 1) * fondo'),
      fijo('Trasera', 'tablero-fondo-3', 'ancho * alto'),
      elegido('Puertas', 'frentes', 'min(puertas; 1) * ancho * altopuertas'),
      elegido('Frentes de cajón', 'frentes', 'cajones * ancho / (divisiones + 1) * 0,2'),
      elegido('Cajones (laterales y fondo)', 'cuerpo', 'cajones * (2 * fondo * 0,15 + ancho / (divisiones + 1) * fondo)'),
      fijo('Canto', 'canto-pvc-1', '2 * alto + 2 * ancho + divisiones * alto + baldas * ancho / (divisiones + 1) + puertas * 2 * altopuertas + cajones * 0,8'),
      fijo('Bisagras', 'herraje-bisagra-cierre-suave', 'puertas * max(2; arriba(altopuertas / 0,6))'),
      fijo('Guías de cajón', 'herraje-guia-cajon', 'cajones'),
      fijo('Tiradores', 'tirador-estandar', 'puertas + cajones'),
      fijo('Soportes de balda', 'herraje-soporte-balda', 'baldas * 4'),
      fijo('Tornillería y colas', 'consumible-tornilleria', '1'),
      fijo('Fabricación en taller', 'mano-taller', '2 + 1,5 * ancho * alto + 0,3 * (cajones + puertas)'),
      fijo('Montaje en obra', 'mano-montaje', '1 + 0,5 * ancho * alto'),
      fijo('Transporte', 'servicio-transporte', '1'),
    ],
  },
  {
    id: 'mueble-bano',
    nombre: 'Mueble de baño suspendido',
    tipoTrabajo: 'Baños',
    descripcion: 'Mueble hidrófugo lacado con cajones o puertas y colgadores.',
    parametros: [medida('ancho', 'Ancho', 80, 30, 240), medida('alto', 'Alto', 50, 20, 90), medida('fondo', 'Fondo', 45, 25, 60), cuantos('cajones', 'Cajones', 2, 0, 6), cuantos('puertas', 'Puertas', 0, 0, 4)],
    opciones: [opcion('cuerpo', 'Material', ['tableros'], 'tablero-mdf-hidrofugo-19')],
    componentes: [
      elegido('Cuerpo (costados, techo, suelo y trasera)', 'cuerpo', '2 * alto * fondo + 2 * ancho * fondo + ancho * alto'),
      elegido('Frentes', 'cuerpo', 'ancho * alto'),
      elegido('Cajones (laterales y fondo)', 'cuerpo', 'cajones * (2 * fondo * 0,15 + ancho * fondo)'),
      fijo('Lacado (caras vistas)', 'acabado-lacado', 'ancho * alto * 2 + 2 * alto * fondo + ancho * fondo'),
      fijo('Guías de cajón', 'herraje-guia-cajon', 'cajones'),
      fijo('Bisagras', 'herraje-bisagra-cierre-suave', 'puertas * 2'),
      fijo('Perfil uñero', 'tirador-perfil-unero', 'min(cajones + puertas; 1) * ancho'),
      fijo('Colgadores', 'herraje-colgador-mueble', '1'),
      fijo('Tornillería y colas', 'consumible-tornilleria', '1'),
      fijo('Fabricación en taller', 'mano-taller', '3 + 0,5 * cajones + 0,3 * puertas'),
      fijo('Montaje en obra', 'mano-montaje', '1,5'),
      fijo('Transporte', 'servicio-transporte', '1'),
    ],
  },
  {
    id: 'revestimiento',
    nombre: 'Revestimiento de pared o techo',
    tipoTrabajo: 'Revestimientos',
    descripcion: 'Paneles sobre rastreles, con su acabado.',
    parametros: [medida('ancho', 'Ancho', 300, 30, 2000), medida('alto', 'Alto', 250, 30, 600)],
    opciones: [opcion('panel', 'Material del panel', ['tableros', 'chapas', 'macizos'], 'tablero-rechapado-roble-19'), opcion('acabado', 'Acabado', ['acabados'], 'acabado-barniz')],
    componentes: [
      elegido('Paneles', 'panel', 'ancho * alto'),
      fijo('Rastreles', 'macizo-rastrel', '(arriba(ancho / 0,4) + 1) * alto'),
      elegido('Acabado de la cara vista', 'acabado', 'ancho * alto'),
      fijo('Canto de los paneles', 'canto-chapa-roble', '2 * (ancho + alto)'),
      fijo('Tornillería y colas', 'consumible-tornilleria', '1'),
      fijo('Fabricación en taller', 'mano-taller', '1 + 0,3 * ancho * alto'),
      fijo('Montaje en obra', 'mano-montaje', '2 + 0,5 * ancho * alto'),
      fijo('Transporte', 'servicio-transporte', '1'),
    ],
  },
  {
    id: 'tarima',
    nombre: 'Suelo de tarima',
    tipoTrabajo: 'Suelos',
    descripcion: 'Tarima flotante con manta y rodapié.',
    parametros: [medida('largo', 'Largo de la estancia', 400, 50, 3000), medida('ancho', 'Ancho de la estancia', 300, 50, 3000)],
    opciones: [opcion('tarima', 'Tarima', ['macizos', 'tableros'], 'macizo-tarima-roble')],
    componentes: [
      elegido('Tarima', 'tarima', 'largo * ancho'),
      fijo('Manta aislante', 'consumible-manta', 'largo * ancho'),
      fijo('Rodapié', 'macizo-rodapie', '2 * (largo + ancho)'),
      fijo('Colocación', 'mano-montaje', '1 + 0,35 * largo * ancho'),
      fijo('Transporte', 'servicio-transporte', '1'),
    ],
  },
];

const conPrefijo = (prefijo: string, id: string) => `${prefijo}${id}`;

/** Artículos de partida (sin precio, o con los de ejemplo para los datos de prueba). */
export function articulosDePartida(prefijo = '', conPrecios = false): Omit<ArticuloCatalogo, 'actualizado' | 'archivado'>[] {
  return ARTICULOS.map(([id, cat, nombre, unidad, espesor, acabado, coste]) => ({
    id: conPrefijo(prefijo, id),
    categoria: cat,
    nombre: prefijo ? `${nombre} (prueba)` : nombre,
    unidad,
    coste: conPrecios ? coste : 0,
    merma: categoria(cat)?.merma ?? 0,
    margen: MARGEN_PROPUESTO,
    precioFijo: null,
    referencia: '',
    proveedor: '',
    espesor,
    acabado,
    notas: conPrecios ? 'Precio de ejemplo (datos de prueba).' : '',
  }));
}

/** Plantillas de partida, con las referencias a los artículos con el mismo prefijo. */
export function plantillasDePartida(prefijo = ''): Omit<PlantillaCatalogo, 'actualizado' | 'archivado'>[] {
  const ref = (id: string | null) => (id ? conPrefijo(prefijo, id) : null);
  return PLANTILLAS.map((p, i) => ({
    ...p,
    id: conPrefijo(prefijo, p.id),
    nombre: prefijo ? `${p.nombre} (prueba)` : p.nombre,
    opciones: p.opciones.map((o) => ({ ...o, defecto: ref(o.defecto) })),
    componentes: p.componentes.map((c) => ('id' in c.articulo ? { ...c, articulo: { id: ref(c.articulo.id)! } } : c)),
    orden: i,
  }));
}

/**
 * Añade al catálogo lo que falte del de partida (nunca cambia lo que ya hay:
 * si el negocio ya puso un precio o cambió una fórmula, se queda).
 */
export async function cargarCatalogoDePartida(repos: Repositorios, email: string, prefijo = '', conPrecios = false): Promise<{ articulos: number; plantillas: number }> {
  const hay = new Set((await repos.catalogo.articulos({ incluirArchivados: true })).map((a) => a.id));
  const hayP = new Set((await repos.catalogo.plantillas({ incluirArchivadas: true })).map((p) => p.id));
  let articulos = 0;
  let plantillas = 0;
  for (const a of articulosDePartida(prefijo, conPrecios))
    if (!hay.has(a.id)) {
      await repos.catalogo.guardarArticulo(a, email);
      articulos++;
    }
  for (const p of plantillasDePartida(prefijo))
    if (!hayP.has(p.id)) {
      await repos.catalogo.guardarPlantilla(p, email);
      plantillas++;
    }
  return { articulos, plantillas };
}
