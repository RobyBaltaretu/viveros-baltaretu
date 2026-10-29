import type { Rol } from "../data/tipos.ts";
import type { NombreIcono } from "./iconos.ts";
import { rutaDisponible } from "../../plataforma/actual.ts";
import { vocabularioPanel } from "../../plataforma/vocabulario.ts";
import { puede, type Accion } from "./permisos.ts";

/**
 * Mapa del panel, pensado para no perderse: pocas **zonas** (lo que sale en el
 * menú) y, dentro de cada una, sus **secciones** como pestañas. Lo usan la
 * barra lateral (ordenador), la barra de abajo (móvil), «Más» y las pestañas
 * de arriba de cada pantalla. Solo sale lo que el rol puede usar y lo de los
 * módulos activos del cliente (src/plataforma/modulos.ts).
 */
export type Zona =
  "inicio" | "asistente" | "ventas" | "plantas" | "cuentas" | "web" | "ajustes";

export interface SeccionMenu {
  href: string;
  texto: string;
  permiso?: Accion;
  zona: Zona;
  icono: NombreIcono;
  /** Dibujo de `Ilustracion.astro`. */
  escena?: string;
  descripcion: string;
}

export interface ZonaMenu {
  zona: Zona;
  texto: string;
  icono: NombreIcono;
  descripcion: string;
  /** Primera sección que el rol puede ver (adonde lleva el menú). */
  href: string;
  secciones: SeccionMenu[];
}

const ZONAS: {
  zona: Zona;
  texto: string;
  icono: NombreIcono;
  descripcion: string;
}[] = [
  {
    zona: "inicio",
    texto: "Inicio",
    icono: "inicio",
    descripcion: "Lo pendiente de hoy",
  },
  {
    zona: "asistente",
    texto: "AgricolAI",
    icono: "asistente",
    descripcion: "Pide lo que necesites con tus palabras",
  },
  {
    zona: "ventas",
    texto: "Ventas",
    icono: "presupuestos",
    descripcion: "Presupuestos, facturas y clientes",
  },
  {
    zona: "plantas",
    texto: "Plantas",
    icono: "plantas",
    descripcion: "Catálogo, inventario y fotos",
  },
  {
    zona: "cuentas",
    texto: "Cuentas",
    icono: "informes",
    descripcion: "Gastos e informes",
  },
  {
    zona: "web",
    texto: "Web",
    icono: "publicar",
    descripcion: "Textos de la web, publicar y cambios",
  },
  {
    zona: "ajustes",
    texto: "Ajustes",
    icono: "personas",
    descripcion: "Personas, datos de facturación y ayuda",
  },
];

export const MENU: SeccionMenu[] = [
  {
    href: "/panel",
    texto: "Inicio",
    zona: "inicio",
    icono: "inicio",
    descripcion: "Lo pendiente de hoy",
  },
  {
    href: "/panel/asistente",
    texto: "AgricolAI",
    permiso: "asistente",
    zona: "asistente",
    icono: "asistente",
    escena: "asistente",
    descripcion: "Tu asistente: pide lo que necesites con tus palabras",
  },
  {
    href: "/panel/presupuestos",
    texto: "Presupuestos",
    permiso: "presupuestos",
    zona: "ventas",
    icono: "presupuestos",
    escena: "presupuestos",
    descripcion: "Lo que piden los clientes desde la web",
  },
  {
    href: "/panel/facturas",
    texto: "Facturas",
    permiso: "facturas",
    zona: "ventas",
    icono: "facturas",
    escena: "facturas",
    descripcion: "Hacer facturas y ver lo que falta por cobrar",
  },
  {
    href: "/panel/facturas/clientes",
    texto: "Clientes",
    permiso: "facturas",
    zona: "ventas",
    icono: "clientes",
    escena: "clientes",
    descripcion: "Datos de cada cliente para facturar",
  },
  {
    href: "/panel/plantas",
    texto: "Catálogo",
    permiso: "editar",
    zona: "plantas",
    icono: "plantas",
    escena: "plantas",
    descripcion: "Precios, disponibilidad y plantas nuevas",
  },
  {
    href: "/panel/inventario",
    texto: "Inventario",
    permiso: "inventario",
    zona: "plantas",
    icono: "inventario",
    escena: "plantas",
    descripcion: "Cuántas plantas hay, entradas, salidas y bajas",
  },
  {
    href: "/panel/inventario/resumen",
    texto: "Resumen",
    permiso: "inventario",
    zona: "plantas",
    icono: "informes",
    escena: "informes",
    descripcion:
      "El inventario de un vistazo: cifras, avisos y lo que se pierde",
  },
  {
    href: "/panel/fotos",
    texto: "Fotos",
    permiso: "editar",
    zona: "plantas",
    icono: "fotos",
    escena: "fotos",
    descripcion: "Las fotos de cada planta",
  },
  {
    // Carpintería: portafolio privado (solo en ese sector, ver src/plataforma/modulos.ts).
    href: "/panel/portafolio",
    texto: "Portafolio",
    permiso: "inventario",
    zona: "plantas",
    icono: "fotos",
    escena: "fotos",
    descripcion: "Proyectos con su antes y después",
  },
  {
    href: "/panel/gastos",
    texto: "Gastos",
    permiso: "gastos",
    zona: "cuentas",
    icono: "gastos",
    escena: "gastos",
    descripcion: "Tickets de compra y lo que se ha gastado",
  },
  {
    href: "/panel/informes",
    texto: "Informes",
    permiso: "informes",
    zona: "cuentas",
    icono: "informes",
    escena: "informes",
    descripcion: "Ventas, gastos, resultado y cobros",
  },
  {
    href: "/panel/textos",
    texto: "Textos",
    permiso: "editar",
    zona: "web",
    icono: "textos",
    escena: "textos",
    descripcion: "Empresa, portada, condiciones y páginas",
  },
  {
    href: "/panel/publicar",
    texto: "Publicar",
    permiso: "publicar",
    zona: "web",
    icono: "publicar",
    escena: "publicar",
    descripcion: "Llevar los cambios a la web",
  },
  {
    href: "/panel/cambios",
    texto: "Cambios",
    permiso: "editar",
    zona: "web",
    icono: "cambios",
    escena: "cambios",
    descripcion: "Lo que se ha cambiado y deshacer",
  },
  {
    href: "/panel/personas",
    texto: "Personas",
    permiso: "personas",
    zona: "ajustes",
    icono: "personas",
    escena: "personas",
    descripcion: "Quién puede entrar al panel",
  },
  {
    href: "/panel/facturas/datos",
    texto: "Facturación",
    permiso: "facturas",
    zona: "ajustes",
    icono: "facturas",
    escena: "facturas",
    descripcion: "Datos de la empresa para las facturas",
  },
  {
    href: "/panel/pruebas",
    texto: "Datos de prueba",
    permiso: "personas",
    zona: "ajustes",
    icono: "nuevo",
    escena: "cambios",
    descripcion: "Cargar o quitar ejemplos para probar el panel",
  },
  {
    href: "/panel/ayuda",
    texto: "Ayuda",
    zona: "ajustes",
    icono: "ayuda",
    escena: "ayuda",
    descripcion: "Cómo se hace cada cosa",
  },
];

export const menuDe = (rol: Rol) =>
  MENU.filter((s) => (!s.permiso || puede(rol, s.permiso)) && rutaDisponible(s.href)).map((s) =>
    s.zona === "asistente" ? { ...s, texto: vocabularioPanel().nombreAsistente } : s,
  );

/** Nombre y descripción de cada zona con el vocabulario del sector del cliente. */
function conVocabulario(z: (typeof ZONAS)[number]): (typeof ZONAS)[number] {
  const v = vocabularioPanel();
  if (z.zona === "asistente") return { ...z, texto: v.nombreAsistente };
  if (z.zona === "plantas") return { ...z, ...v.zonas.plantas };
  return z;
}

/** Zonas del rol con sus secciones visibles (las vacías no salen). */
export function zonasDe(rol: Rol): ZonaMenu[] {
  const visibles = menuDe(rol);
  return ZONAS.map(conVocabulario).map((z) => {
    const secciones = visibles.filter((s) => s.zona === z.zona);
    return { ...z, secciones, href: secciones[0]?.href ?? "" };
  }).filter((z) => z.secciones.length);
}

/** Barra de abajo del móvil: cuatro zonas (AgricolAI en el centro) y «Más». */
const PRIORIDAD_BARRA: Zona[] = [
  "inicio",
  "plantas",
  "asistente",
  "ventas",
  "web",
];
export function barraDe(rol: Rol): ZonaMenu[] {
  const zonas = zonasDe(rol);
  const elegidas = PRIORIDAD_BARRA.map((z) => zonas.find((x) => x.zona === z))
    .filter((z): z is ZonaMenu => !!z)
    .slice(0, 4);
  const asistente = elegidas.findIndex((z) => z.zona === "asistente");
  if (asistente >= 0 && elegidas.length === 4 && asistente !== 2)
    elegidas.splice(2, 0, ...elegidas.splice(asistente, 1));
  return elegidas;
}

export const MAS = "/panel/mas";

/** La sección a la que pertenece una ruta: la de prefijo más largo. */
export function seccionActual(
  ruta: string,
  secciones: SeccionMenu[] = MENU,
): string | null {
  const limpia = ruta.replace(/\/+$/, "") || "/";
  let mejor: string | null = null;
  for (const s of secciones) {
    const coincide =
      s.href === "/panel"
        ? limpia === "/panel"
        : limpia === s.href || limpia.startsWith(`${s.href}/`);
    if (coincide && (!mejor || s.href.length > mejor.length)) mejor = s.href;
  }
  return mejor;
}

/** Zona de una ruta (para marcarla en el menú y enseñar sus pestañas). */
export const zonaActual = (
  ruta: string,
  secciones: SeccionMenu[] = MENU,
): Zona | null => {
  const s = seccionActual(ruta, secciones);
  return s ? (MENU.find((x) => x.href === s)?.zona ?? null) : null;
};
