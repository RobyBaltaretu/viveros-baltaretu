/**
 * Interfaces de la capa de datos. Nada fuera de `src/server/data/` consulta la
 * base de datos: el panel, la API, los scripts y el asistente usan estas
 * interfaces. Para cambiar de base (por ejemplo a Postgres) basta con otra
 * implementación (ver docs/panel-propio/plan-tecnico.md).
 */
export const COLECCIONES = ['catalogo', 'ajustes', 'paginas', 'proyectos', 'guias'] as const;
export type Coleccion = (typeof COLECCIONES)[number];

export const ROLES = ['propietario', 'gerente', 'editor'] as const;
export type Rol = (typeof ROLES)[number];

export const ESTADOS_PRESUPUESTO = ['nuevo', 'respondido', 'archivado'] as const;
export type EstadoPresupuesto = (typeof ESTADOS_PRESUPUESTO)[number];

export type OrigenCambio = 'panel' | 'asistente' | 'importacion' | 'deshacer';

/** Contenido de una entrada: los mismos datos que el frontmatter o el YAML de hoy, más el cuerpo del Markdown. */
export interface Documento {
  datos: Record<string, unknown>;
  cuerpo: string;
}

export interface Entrada {
  coleccion: Coleccion;
  id: string;
  borrador: Documento;
  /** Lo que está en la web (o saldrá en el próximo build). `null` si nunca se publicó. */
  publicado: Documento | null;
  archivada: boolean;
  actualizado: string;
  actualizadoPor: string;
}

export interface Cambio {
  id: number;
  fecha: string;
  email: string;
  coleccion: Coleccion;
  entradaId: string;
  /** `null`: la entrada no existía. */
  antes: Documento | null;
  /** `null`: la entrada se archivó. */
  despues: Documento | null;
  origen: OrigenCambio;
}

export interface Autor {
  email: string;
  origen?: OrigenCambio;
}

export interface RepositorioContenido {
  listar(coleccion: Coleccion, opciones?: { incluirArchivadas?: boolean }): Promise<Entrada[]>;
  obtener(coleccion: Coleccion, id: string): Promise<Entrada | null>;
  /** Crea o actualiza el borrador y apunta el cambio en el historial. */
  guardarBorrador(coleccion: Coleccion, id: string, documento: Documento, autor: Autor): Promise<void>;
  archivar(coleccion: Coleccion, id: string, archivada: boolean, autor: Autor): Promise<void>;
  /** Entradas cuyo borrador difiere de lo publicado. */
  pendientes(): Promise<Entrada[]>;
  /** Pasa todos los borradores a publicados. Devuelve cuántas entradas cambian. */
  publicarTodo(): Promise<number>;
  /** Contenido publicado, para el build. */
  publicadas(): Promise<{ coleccion: Coleccion; id: string; documento: Documento }[]>;
  historial(opciones?: { coleccion?: Coleccion; id?: string; limite?: number }): Promise<Cambio[]>;
  /** Devuelve la entrada al estado de antes de un cambio (como un cambio nuevo). Solo una vez: después el cambio deja de salir en el historial. */
  deshacer(cambioId: number, autor: Autor): Promise<Cambio | null>;
  /** Carga inicial: escribe borrador y publicado a la vez. */
  importar(entradas: { coleccion: Coleccion; id: string; documento: Documento }[], autor: Autor): Promise<number>;
}

export interface Foto {
  ruta: string;
  tipo: string;
  bytes: Uint8Array;
}

export interface InfoFoto {
  ruta: string;
  tipo: string;
  tamano: number;
  subida: string;
  subidaPor: string;
}

export interface RepositorioFotos {
  guardar(foto: Foto, email: string): Promise<void>;
  obtener(ruta: string): Promise<Foto | null>;
  listar(): Promise<InfoFoto[]>;
  borrar(ruta: string): Promise<void>;
}

export interface Usuario {
  email: string;
  nombre: string;
  rol: Rol;
  activo: boolean;
}

export interface RepositorioUsuarios {
  obtener(email: string): Promise<Usuario | null>;
  listar(): Promise<Usuario[]>;
  guardar(usuario: Usuario): Promise<void>;
}

export interface Registro {
  id: number;
  fecha: string;
  email: string;
  accion: string;
  detalle: string;
}

export interface RepositorioAuditoria {
  registrar(email: string, accion: string, detalle?: string): Promise<void>;
  listar(limite?: number): Promise<Registro[]>;
}

export type EstadoPublicacion = 'lanzada' | 'sin-cambios' | 'error';

export interface Publicacion {
  id: number;
  fecha: string;
  email: string;
  estado: EstadoPublicacion;
  detalle: string;
  /** Cuándo llegó a la web pública (despliegue automático). `null`: aún no. */
  enWeb: string | null;
}

export interface RepositorioPublicaciones {
  registrar(email: string, estado: EstadoPublicacion, detalle?: string): Promise<void>;
  listar(limite?: number): Promise<Publicacion[]>;
  /** Publicaciones lanzadas hasta esa fecha que aún no están en la web. */
  pendientes(hasta: string): Promise<number>;
  /** Las marca como ya en la web. Devuelve cuántas. */
  marcarEnWeb(hasta: string): Promise<number>;
}

export interface LineaPresupuesto {
  especie: string;
  nombre: string;
  cantidad: number;
}

export interface Presupuesto {
  id: string;
  fecha: string;
  estado: EstadoPresupuesto;
  idioma: string;
  tipoPedido: string;
  nombre: string;
  email: string;
  telefono: string;
  empresa: string;
  provincia: string;
  mensaje: string;
  lineas: LineaPresupuesto[];
}

export interface RepositorioPresupuestos {
  guardar(presupuesto: Presupuesto): Promise<void>;
  obtener(id: string): Promise<Presupuesto | null>;
  listar(opciones?: { estado?: EstadoPresupuesto; limite?: number }): Promise<Presupuesto[]>;
  cambiarEstado(id: string, estado: EstadoPresupuesto): Promise<boolean>;
  contar(estado: EstadoPresupuesto): Promise<number>;
  borrar(id: string): Promise<boolean>;
}

export interface RepositorioUsoAsistente {
  /** Suma `cantidad` usos (1 por defecto) y devuelve el total del día. */
  sumar(email: string, dia: string, cantidad?: number): Promise<number>;
  obtener(email: string, dia: string): Promise<number>;
}

/** Simulaciones del mes con la IA de pago del simulador (tope duro por cliente). */
export interface RepositorioUsoSimulador {
  /** Las gastadas en ese mes («2026-10»). */
  usos(cliente: string, mes: string): Promise<number>;
  /**
   * Aparta una simulación si quedan (en una sola sentencia, así dos peticiones a
   * la vez no pasan del tope). false si ya se ha llegado a `limite`.
   */
  reservar(cliente: string, mes: string, limite: number): Promise<boolean>;
  /** Devuelve una reservada que no llegó a hacerse (el proveedor falló). */
  devolver(cliente: string, mes: string): Promise<void>;
}

/** Datos internos del panel que no salen en la web (por ejemplo, los de facturación). */
export interface RepositorioAjustesPrivados {
  obtener<T = unknown>(clave: string): Promise<T | null>;
  guardar(clave: string, valor: unknown, email: string): Promise<void>;
}

export interface Cliente {
  id: string;
  /** Razón social o nombre completo. */
  nombre: string;
  nif: string;
  direccion: string;
  codigoPostal: string;
  poblacion: string;
  provincia: string;
  pais: string;
  email: string;
  telefono: string;
  /** Cliente en recargo de equivalencia (comercio minorista). */
  recargo: boolean;
  notas: string;
  archivado: boolean;
  /**
   * Opcionales (D-06, sin migración: van en `datos`). Los clientes guardados
   * antes no los tienen; el formulario de siempre no los toca.
   */
  /** Persona con la que se habla (en una empresa, quien lleva la obra). */
  contacto?: string;
  /** Dónde se hace el trabajo, si no es la dirección de facturación. */
  direccionObra?: string;
  /** Cómo suele pagar: se propone en sus presupuestos y facturas. */
  formaPago?: string;
}

export interface RepositorioClientes {
  listar(opciones?: { incluirArchivados?: boolean }): Promise<Cliente[]>;
  obtener(id: string): Promise<Cliente | null>;
  guardar(cliente: Cliente, email: string): Promise<void>;
  borrar(id: string): Promise<boolean>;
}

export const ESTADOS_FACTURA = ['borrador', 'emitida', 'cobrada'] as const;
export type EstadoFactura = (typeof ESTADOS_FACTURA)[number];
export type TipoFactura = 'ordinaria' | 'rectificativa';

export interface LineaFactura {
  concepto: string;
  cantidad: number;
  /** Precio por unidad sin IVA, en euros. */
  precio: number;
  /** Descuento en %. */
  descuento: number;
  /** Tipo de IVA en % (21, 10, 4 o 0). */
  iva: number;
  /** Planta del catálogo (slug) que descuenta del inventario al emitir; opcional. */
  planta?: string | null;
}

export interface DesgloseIva {
  iva: number;
  base: number;
  cuota: number;
  recargo: number;
  cuotaRecargo: number;
}

export interface TotalesFactura {
  base: number;
  cuotaIva: number;
  cuotaRecargo: number;
  total: number;
  desglose: DesgloseIva[];
}

/** Datos del emisor tal como salen en la factura (copia al emitir). */
export interface DatosEmisor {
  nombre: string;
  nif: string;
  direccion: string;
  codigoPostal: string;
  poblacion: string;
  provincia: string;
  email: string;
  telefono: string;
  iban: string;
  /** Pie legal: registro mercantil u otros datos. */
  pie: string;
}

export interface Factura {
  id: string;
  tipo: TipoFactura;
  estado: EstadoFactura;
  /** Serie y número: se asignan al emitir (correlativos por serie). */
  serie: string | null;
  numero: number | null;
  codigo: string | null;
  /** Fecha de expedición (AAAA-MM-DD). */
  fecha: string;
  vencimiento: string;
  clienteId: string;
  /** Copia de los datos del cliente; en las emitidas, los de ese momento. */
  cliente: Cliente;
  emisor: DatosEmisor | null;
  lineas: LineaFactura[];
  totales: TotalesFactura;
  formaPago: string;
  notas: string;
  /** Motivo si hay líneas sin IVA (exención o inversión del sujeto pasivo). */
  exencion: string;
  /** Factura que corrige (solo rectificativas) y por qué. */
  rectificaId: string | null;
  rectificaCodigo: string | null;
  motivoRectificacion: string;
  presupuestoId: string | null;
  /** Factura de prueba (modo de pruebas): serie aparte, se borra al quitar los datos de prueba. */
  prueba?: boolean;
  cobradaEl: string | null;
  /** Huella encadenada con la factura anterior (registro inalterable). */
  huella: string | null;
  huellaAnterior: string | null;
  creada: string;
  creadaPor: string;
  actualizada: string;
}

export interface FiltroFacturas {
  estado?: EstadoFactura;
  clienteId?: string;
  desde?: string;
  hasta?: string;
  limite?: number;
}

export interface RepositorioFacturas {
  listar(filtro?: FiltroFacturas): Promise<Factura[]>;
  obtener(id: string): Promise<Factura | null>;
  /** Crea o actualiza un borrador. No toca las emitidas. */
  guardarBorrador(factura: Factura): Promise<boolean>;
  borrarBorrador(id: string): Promise<boolean>;
  /** Última emitida de una serie (para numerar y encadenar la huella). */
  ultimaEmitida(serie: string): Promise<Factura | null>;
  /** La última emitida de todas (para la cadena de huellas). */
  ultimaHuella(): Promise<string | null>;
  /** Emite un borrador con el número siguiente de la serie. Devuelve la factura o `null` si ya no era borrador. */
  emitir(id: string, datos: { serie: string; fecha: string; emisor: DatosEmisor; cliente: Cliente; huella: (numero: number, codigo: string) => Promise<string>; huellaAnterior: string | null; codigo: (numero: number) => string }): Promise<Factura | null>;
  marcarCobrada(id: string, fecha: string | null): Promise<boolean>;
  /** Borra las facturas de prueba (serie PRUEBA o marcadas como prueba). Devuelve cuántas. */
  borrarPruebas(): Promise<number>;
}

export const ESTADOS_GASTO = ['revisar', 'confirmado'] as const;
export type EstadoGasto = (typeof ESTADOS_GASTO)[number];

export interface LineaGasto {
  concepto: string;
  cantidad: number;
  /** Importe de la línea con IVA, en euros. */
  importe: number;
}

export interface Gasto {
  id: string;
  /** `revisar`: leído del ticket y sin confirmar; no cuenta en los informes. */
  estado: EstadoGasto;
  fecha: string;
  proveedor: string;
  nifProveedor: string;
  categoria: string;
  lineas: LineaGasto[];
  /** Base imponible y cuota de IVA si vienen en el ticket (`null` si no). */
  base: number | null;
  iva: number | null;
  total: number;
  formaPago: string;
  notas: string;
  ticketId: string | null;
  /** Si los datos los leyó el lector de tickets (y qué avisó). */
  leidoAutomaticamente: boolean;
  avisos: string[];
  creado: string;
  creadoPor: string;
  actualizado: string;
}

export interface RepositorioGastos {
  listar(filtro?: { estado?: EstadoGasto; desde?: string; hasta?: string; limite?: number }): Promise<Gasto[]>;
  obtener(id: string): Promise<Gasto | null>;
  guardar(gasto: Gasto): Promise<void>;
  /** Borra el gasto y la foto de su ticket. */
  borrar(id: string): Promise<boolean>;
}

/** Fotos de los tickets: aparte de las de la web, nunca se publican. */
export interface RepositorioTickets {
  guardar(ticket: { id: string; tipo: string; bytes: Uint8Array }, email: string): Promise<void>;
  obtener(id: string): Promise<{ tipo: string; bytes: Uint8Array } | null>;
}

export type EstadoPropuesta = 'pendiente' | 'aplicada' | 'rechazada' | 'fallida';

/** Cambio que el asistente propone y que solo se aplica si la persona dice «Sí». */
export interface Propuesta {
  id: string;
  conversacion: string;
  email: string;
  herramienta: string;
  argumentos: Record<string, unknown>;
  /** Lo que se le enseña a la persona para confirmar. */
  resumen: string;
  estado: EstadoPropuesta;
  resultado: string;
  creada: string;
}

export interface MensajeAsistente {
  id: number;
  conversacion: string;
  rol: 'usuario' | 'asistente';
  texto: string;
  /** Propuestas que acompañan a la respuesta (ids). */
  propuestas: string[];
  fecha: string;
}

export interface ResumenConversacion {
  id: string;
  creada: string;
  usada: string;
  /** El primer mensaje de la persona (recortado). */
  titulo: string;
  mensajes: number;
}

export interface RepositorioConversaciones {
  /** Conversación abierta de la persona (la usada más recientemente, o una nueva si no hay). */
  actual(email: string): Promise<string>;
  /** Empieza otra; si la abierta está vacía, se sigue usando esa. */
  nueva(email: string): Promise<string>;
  /** Conversaciones con mensajes de la persona, la más reciente primero. */
  listar(email: string, limite?: number): Promise<ResumenConversacion[]>;
  /** Vuelve a abrir una conversación suya. */
  abrir(email: string, id: string): Promise<boolean>;
  /** Borra una conversación suya con sus mensajes (no deshace lo que se aplicó). */
  borrar(email: string, id: string): Promise<boolean>;
  mensajes(conversacion: string, limite?: number): Promise<MensajeAsistente[]>;
  anadir(m: Omit<MensajeAsistente, 'id' | 'fecha'>): Promise<void>;
  guardarPropuesta(p: Propuesta): Promise<void>;
  propuesta(id: string): Promise<Propuesta | null>;
  propuestas(ids: string[]): Promise<Propuesta[]>;
  /** Cambia el estado solo si seguía pendiente (para no aplicar dos veces). */
  resolver(id: string, estado: Exclude<EstadoPropuesta, 'pendiente'>, resultado: string): Promise<boolean>;
  /** Apunta el resultado final de una propuesta ya resuelta. */
  anotar(id: string, estado: Exclude<EstadoPropuesta, 'pendiente'>, resultado: string): Promise<void>;
}

/** Entrada (+), salida (−) o baja por desperdicio (−, se cuenta aparte). */
export const TIPOS_MOVIMIENTO = ['entrada', 'salida', 'baja'] as const;
export type TipoMovimiento = (typeof TIPOS_MOVIMIENTO)[number];

export interface MovimientoInventario {
  id: number;
  planta: string;
  tipo: TipoMovimiento;
  /** Con signo: positiva suma, negativa resta. */
  cantidad: number;
  motivo: string;
  nota: string;
  /** «factura:<id>:<línea>» o «prueba:…»; vacío en los manuales. */
  referencia: string | null;
  fecha: string;
  email: string;
}

export type NuevoMovimiento = Pick<MovimientoInventario, 'planta' | 'tipo' | 'cantidad' | 'motivo'> & { nota?: string; referencia?: string | null };

export interface Existencias {
  disponible: number;
  desperdicio: number;
  ultimo: string;
}

export interface RepositorioInventario {
  /** Guarda movimientos (los de una misma referencia, una sola vez). Devuelve cuántos ha guardado. */
  registrar(movimientos: NuevoMovimiento[], email: string): Promise<number>;
  /** Existencias de cada planta con movimientos. */
  existencias(): Promise<Record<string, Existencias>>;
  movimientos(filtro?: { planta?: string; tipo?: TipoMovimiento; desde?: string; limite?: number }): Promise<MovimientoInventario[]>;
  borrarPruebas(): Promise<number>;
}

/** Proyecto del portafolio privado (carpintería): lo ve solo el negocio. */
export interface ProyectoPortafolio {
  id: string;
  titulo: string;
  categoria: string;
  descripcion: string;
  materiales: string;
  anio: number | null;
  localidad: string;
  /** Fotos de antes y de después de la reforma (ids de `adjuntos`). */
  antes: string[];
  despues: string[];
  destacado: boolean;
  orden: number;
  archivado: boolean;
  actualizado: string;
}

export interface RepositorioPortafolio {
  listar(opciones?: { incluirArchivados?: boolean }): Promise<ProyectoPortafolio[]>;
  obtener(id: string): Promise<ProyectoPortafolio | null>;
  guardar(p: Omit<ProyectoPortafolio, 'actualizado' | 'archivado'>, email: string): Promise<void>;
  archivar(id: string, archivado: boolean, email: string): Promise<boolean>;
  /** Solo para los datos de prueba: el portafolio real se archiva, no se borra. */
  borrar(id: string): Promise<boolean>;
}

/** Archivo privado (foto del portafolio…): nunca se publica ni pasa por el build. */
export interface Adjunto {
  id: string;
  ambito: string;
  ref: string;
  tipo: string;
  tamano: number;
  creado: string;
}

export interface RepositorioAdjuntos {
  guardar(a: { id: string; ambito: string; ref: string; tipo: string; bytes: Uint8Array }, email: string): Promise<void>;
  obtener(id: string): Promise<(Adjunto & { bytes: Uint8Array }) | null>;
  listar(ambito: string, ref: string): Promise<Adjunto[]>;
  borrar(id: string): Promise<boolean>;
  /** Todos los de una ficha (por ejemplo, al quitar un proyecto de prueba). */
  borrarDe(ambito: string, ref: string): Promise<number>;
}

export const ESTADOS_PRESUPUESTO_CLIENTE = ['borrador', 'enviado', 'aceptado', 'rechazado', 'caducado'] as const;
export type EstadoPresupuestoCliente = (typeof ESTADOS_PRESUPUESTO_CLIENTE)[number];

/** Línea de un presupuesto a cliente. Las de `extra` son opcionales: se ofrecen aparte y no suman. */
export interface LineaPresupuestoCliente {
  concepto: string;
  cantidad: number;
  /** Precio por unidad sin IVA, en euros. */
  precio: number;
  material: string;
  extra: boolean;
}

export interface TotalesPresupuesto {
  base: number;
  cuotaIva: number;
  total: number;
  /** Anticipo = total con IVA × porcentaje; restante = total − anticipo. */
  anticipo: number;
  restante: number;
  /** Base de los extras opcionales (no incluida en el total). */
  baseExtras: number;
}

/** Presupuesto que el negocio hace a un cliente para una obra (módulo presupuestosCliente). */
export interface PresupuestoCliente {
  id: string;
  serie: string;
  numero: number;
  codigo: string;
  estado: EstadoPresupuestoCliente;
  fecha: string;
  /** Hasta cuándo vale (AAAA-MM-DD), o null. */
  validez: string | null;
  clienteId: string;
  /** Copia de los datos del cliente al guardar (lo que sale en el documento). */
  cliente: Cliente;
  obraId: string | null;
  concepto: string;
  lineas: LineaPresupuestoCliente[];
  /** IVA de todas las líneas, en %. */
  iva: number;
  anticipoPct: number;
  totales: TotalesPresupuesto;
  formaPago: string;
  notas: string;
  /** Fechas de cobro del anticipo y del resto (AAAA-MM-DD), o null. */
  cobroAnticipo: string | null;
  cobroResto: string | null;
  facturaAnticipoId: string | null;
  facturaId: string | null;
  actualizado: string;
}

export interface RepositorioPresupuestosCliente {
  listar(filtro?: { estado?: EstadoPresupuestoCliente; clienteId?: string; limite?: number }): Promise<PresupuestoCliente[]>;
  obtener(id: string): Promise<PresupuestoCliente | null>;
  /** Alta con el número siguiente de la serie (correlativo, sin huecos ni repetidos). */
  crear(p: Omit<PresupuestoCliente, 'numero' | 'codigo' | 'actualizado'>, email: string): Promise<PresupuestoCliente>;
  guardar(p: PresupuestoCliente, email: string): Promise<void>;
  /** Quita los de prueba (id `prueba-…`). Devuelve cuántos. */
  borrarPruebas(): Promise<number>;
}

/** Artículo del catálogo de la carpintería: un material, herraje, acabado, hora de trabajo o servicio. */
export interface ArticuloCatalogo {
  id: string;
  /** Categoría (src/server/catalogo/catalogo.ts): tableros, cantos, herrajes, mano-obra… */
  categoria: string;
  nombre: string;
  /** Unidad en que se compra y se cobra: ud, m², ml, m³, h, kg, l. */
  unidad: string;
  /** Coste sin IVA por unidad (lo que le cuesta al negocio). 0 = por rellenar. */
  coste: number;
  /** Lo que se pierde al cortar (%): se compra más de lo que queda en el mueble. */
  merma: number;
  /** Margen sobre el coste (%). */
  margen: number;
  /** Precio de venta sin IVA por unidad si se fija a mano; si no, coste + margen. */
  precioFijo: number | null;
  referencia: string;
  proveedor: string;
  /** Espesor en mm (tableros, cantos…), si lo tiene. */
  espesor: number | null;
  /** Color, textura o acabado (por ejemplo, «Blanco», «Roble natural»). */
  acabado: string;
  notas: string;
  archivado: boolean;
  actualizado: string;
}

/** Medida que se pide al usar una plantilla (en cm, o un número de unidades). */
export interface ParametroPlantilla {
  /** Nombre en las fórmulas: ancho, alto, fondo, puertas… */
  id: string;
  nombre: string;
  /** medida: se escribe en cm y en las fórmulas vale en metros. numero: unidades (puertas, baldas…). */
  tipo: 'medida' | 'numero';
  defecto: number;
  min: number;
  max: number;
}

/** Material que se elige al usar la plantilla (por ejemplo, el tablero del cuerpo). */
export interface OpcionPlantilla {
  id: string;
  nombre: string;
  /** Categorías de artículos entre las que se elige. */
  categorias: string[];
  /** Artículo propuesto. */
  defecto: string | null;
}

/** Una parte del escandallo: qué artículo y cuánto, con una fórmula de las medidas. */
export interface ComponentePlantilla {
  concepto: string;
  /** Artículo fijo o el que se elija en una opción. */
  articulo: { id: string } | { opcion: string };
  /** Cantidad (en la unidad del artículo), por ejemplo «2 * alto * fondo». */
  cantidad: string;
}

/** Plantilla de un trabajo (armario empotrado, cocina, puerta…): su escandallo paramétrico. */
export interface PlantillaCatalogo {
  id: string;
  nombre: string;
  /** Tipo de trabajo (Armarios, Cocinas, Puertas…). */
  tipoTrabajo: string;
  descripcion: string;
  parametros: ParametroPlantilla[];
  opciones: OpcionPlantilla[];
  componentes: ComponentePlantilla[];
  orden: number;
  archivado: boolean;
  actualizado: string;
}

export interface RepositorioCatalogo {
  articulos(opciones?: { incluirArchivados?: boolean }): Promise<ArticuloCatalogo[]>;
  articulo(id: string): Promise<ArticuloCatalogo | null>;
  guardarArticulo(a: Omit<ArticuloCatalogo, 'actualizado' | 'archivado'>, email: string): Promise<void>;
  archivarArticulo(id: string, archivado: boolean, email: string): Promise<boolean>;
  plantillas(opciones?: { incluirArchivadas?: boolean }): Promise<PlantillaCatalogo[]>;
  plantilla(id: string): Promise<PlantillaCatalogo | null>;
  guardarPlantilla(p: Omit<PlantillaCatalogo, 'actualizado' | 'archivado'>, email: string): Promise<void>;
  archivarPlantilla(id: string, archivado: boolean, email: string): Promise<boolean>;
  /** Quita los artículos y plantillas de prueba (id `prueba-…`). Devuelve cuántos. */
  borrarPruebas(): Promise<number>;
}

/** A quién se compra el material (módulo `proveedores`). Privado: no sale en nada que vea un cliente. */
export interface Proveedor {
  id: string;
  nombre: string;
  nif: string;
  /** Persona con la que se habla. */
  contacto: string;
  telefono: string;
  email: string;
  direccion: string;
  poblacion: string;
  web: string;
  /** Categorías del catálogo que suministra (ids de `CATEGORIAS` del catálogo). */
  categorias: string[];
  /** Días que suele tardar en servir. */
  plazoDias: number | null;
  formaPago: string;
  notas: string;
  archivado: boolean;
  actualizado: string;
}

export interface RepositorioProveedores {
  listar(opciones?: { incluirArchivados?: boolean }): Promise<Proveedor[]>;
  obtener(id: string): Promise<Proveedor | null>;
  guardar(p: Omit<Proveedor, 'actualizado'>, email: string): Promise<void>;
  /** Quita los de prueba (id `prueba-…`). Devuelve cuántos. */
  borrarPruebas(): Promise<number>;
}

export const ESTADOS_PEDIDO = ['borrador', 'enviado', 'recibido'] as const;
export type EstadoPedido = (typeof ESTADOS_PEDIDO)[number];

/** Una línea de un pedido a proveedor. El coste es interno: no sale en el mensaje ni en el PDF. */
export interface LineaPedido {
  /** Artículo del catálogo, si sale de él. */
  articuloId: string | null;
  concepto: string;
  /** Referencia del proveedor. */
  referencia: string;
  /** Medidas, acabado o lo que el proveedor tenga que saber. */
  detalle: string;
  cantidad: number;
  unidad: string;
  /** Coste por unidad, sin IVA (interno). 0 si no se sabe. */
  coste: number;
}

/** Pedido de material a un proveedor (módulo `pedidosProveedor`). */
export interface PedidoProveedor {
  id: string;
  /** PE2026-0001: correlativo por año. */
  codigo: string;
  estado: EstadoPedido;
  proveedorId: string;
  /** Datos del proveedor al hacer el pedido (para el mensaje y el PDF). */
  proveedor: Pick<Proveedor, 'nombre' | 'nif' | 'contacto' | 'telefono' | 'email'>;
  /** Presupuesto (obra) para el que es, si lo hay. */
  presupuestoClienteId: string | null;
  fecha: string;
  /** Para cuándo hace falta. */
  entrega: string | null;
  lineas: LineaPedido[];
  /** Lo que se le dice al proveedor. */
  notas: string;
  /** Solo para el taller. */
  notasInternas: string;
  /** Suma de cantidad × coste (interno). */
  coste: number;
  enviadoEl: string | null;
  recibidoEl: string | null;
  /** Gasto apuntado al recibirlo. */
  gastoId: string | null;
  actualizado: string;
}

export interface RepositorioPedidosProveedor {
  listar(filtro?: { estado?: EstadoPedido; proveedorId?: string; presupuestoClienteId?: string; limite?: number }): Promise<PedidoProveedor[]>;
  obtener(id: string): Promise<PedidoProveedor | null>;
  /** Alta con el código siguiente del año (correlativo, sin repetidos). */
  crear(p: Omit<PedidoProveedor, 'codigo' | 'actualizado'>, email: string): Promise<PedidoProveedor>;
  guardar(p: PedidoProveedor, email: string): Promise<void>;
  borrar(id: string): Promise<boolean>;
  /** Quita los de prueba (id `prueba-…`). Devuelve cuántos. */
  borrarPruebas(): Promise<number>;
}

export interface Repositorios {
  contenido: RepositorioContenido;
  fotos: RepositorioFotos;
  usuarios: RepositorioUsuarios;
  auditoria: RepositorioAuditoria;
  publicaciones: RepositorioPublicaciones;
  presupuestos: RepositorioPresupuestos;
  usoAsistente: RepositorioUsoAsistente;
  usoSimulador: RepositorioUsoSimulador;
  ajustesPrivados: RepositorioAjustesPrivados;
  clientes: RepositorioClientes;
  facturas: RepositorioFacturas;
  gastos: RepositorioGastos;
  tickets: RepositorioTickets;
  conversaciones: RepositorioConversaciones;
  inventario: RepositorioInventario;
  portafolio: RepositorioPortafolio;
  adjuntos: RepositorioAdjuntos;
  presupuestosCliente: RepositorioPresupuestosCliente;
  catalogo: RepositorioCatalogo;
  proveedores: RepositorioProveedores;
  pedidosProveedor: RepositorioPedidosProveedor;
}
