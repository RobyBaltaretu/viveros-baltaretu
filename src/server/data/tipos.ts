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
  /** Devuelve la entrada al estado de antes de un cambio (como un cambio nuevo). */
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
}

export interface RepositorioUsoAsistente {
  /** Suma un uso y devuelve el total del día. */
  sumar(email: string, dia: string): Promise<number>;
  obtener(email: string, dia: string): Promise<number>;
}

export interface Repositorios {
  contenido: RepositorioContenido;
  fotos: RepositorioFotos;
  usuarios: RepositorioUsuarios;
  auditoria: RepositorioAuditoria;
  publicaciones: RepositorioPublicaciones;
  presupuestos: RepositorioPresupuestos;
  usoAsistente: RepositorioUsoAsistente;
}
