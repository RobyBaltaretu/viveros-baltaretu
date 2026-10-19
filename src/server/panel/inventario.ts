import type {
  Existencias,
  Factura,
  MovimientoInventario,
  Repositorios,
  TipoMovimiento,
} from "../data/tipos.ts";
import { TIPOS_MOVIMIENTO } from "../data/tipos.ts";
import type { DatosPlanta } from "./plantas.ts";

/**
 * Inventario del vivero: unidades disponibles de cada planta y lo que se ha
 * perdido (desperdicio). Todo cambio es un movimiento con su motivo; no se
 * borran: un error se corrige con otro movimiento. Al emitir una factura, sus
 * líneas con planta restan solas (y una rectificativa las devuelve).
 */
export const NOMBRE_TIPO: Record<TipoMovimiento, string> = {
  entrada: "Entrada",
  salida: "Salida",
  baja: "Baja (desperdicio)",
};

export const MOTIVOS: Record<TipoMovimiento, string[]> = {
  entrada: [
    "Producción propia",
    "Compra a proveedor",
    "Devolución de un cliente",
    "Recuento: había más",
    "Otro motivo",
  ],
  salida: [
    "Venta sin factura",
    "Regalo o muestra",
    "Traslado a otro vivero",
    "Recuento: había menos",
    "Otro motivo",
  ],
  baja: [
    "Se ha muerto",
    "Dañada, no se puede vender",
    "Plaga o enfermedad",
    "Helada o golpe de calor",
    "Otro motivo",
  ],
};

export const MAXIMO_MOVIMIENTO = 100_000;

export interface FilaInventario {
  id: string;
  nombre: string;
  disponibilidad: string;
  /** «Precio desde» de la ficha, para estimar lo que vale lo que hay. */
  precio: number | null;
  existencias: Existencias;
}

const vacio: Existencias = { disponible: 0, desperdicio: 0, ultimo: "" };

/** Todas las plantas del catálogo con sus existencias (las que nunca tuvieron movimientos, a 0). */
export async function inventarioCompleto(
  repos: Repositorios,
): Promise<FilaInventario[]> {
  const [entradas, existencias] = await Promise.all([
    repos.contenido.listar("catalogo"),
    repos.inventario.existencias(),
  ]);
  return entradas
    .map((e) => {
      const d = e.borrador.datos as DatosPlanta;
      return {
        id: e.id,
        nombre: String(d.nombre?.es ?? e.id),
        disponibilidad: String(d.disponibilidad ?? ""),
        precio: typeof d.precioDesde === "number" ? d.precioDesde : null,
        existencias: existencias[e.id] ?? vacio,
      };
    })
    .sort((a, b) => a.nombre.localeCompare(b.nombre, "es"));
}

export interface PeticionMovimiento {
  tipo: TipoMovimiento;
  cantidad: number;
  motivo: string;
  nota?: string;
}
type Resultado =
  | { ok: true; texto: string; disponible: number }
  | { ok: false; error: string };

export function validarMovimiento(
  m: Partial<PeticionMovimiento>,
): string | null {
  if (!m.tipo || !TIPOS_MOVIMIENTO.includes(m.tipo))
    return "Elige si entra, sale o se da de baja.";
  if (
    !Number.isInteger(m.cantidad) ||
    (m.cantidad ?? 0) <= 0 ||
    (m.cantidad ?? 0) > MAXIMO_MOVIMIENTO
  )
    return "Escribe cuántas plantas: un número entero mayor que 0.";
  if (!m.motivo || !MOTIVOS[m.tipo].includes(m.motivo))
    return "Elige el motivo.";
  if (m.motivo === "Otro motivo" && !m.nota?.trim())
    return "Con «Otro motivo», escribe cuál en la nota.";
  if ((m.nota ?? "").length > 300)
    return "La nota es demasiado larga (300 letras como mucho).";
  return null;
}

/** Movimiento manual. No deja sacar ni dar de baja más plantas de las que hay. */
export async function moverInventario(
  repos: Repositorios,
  planta: string,
  m: PeticionMovimiento,
  email: string,
): Promise<Resultado> {
  const error = validarMovimiento(m);
  if (error) return { ok: false, error };
  const e = await repos.contenido.obtener("catalogo", planta);
  if (!e) return { ok: false, error: "Esa planta no está en el catálogo." };
  const nombre = String((e.borrador.datos as DatosPlanta).nombre?.es ?? planta);
  const antes = (await repos.inventario.existencias())[planta]?.disponible ?? 0;
  if (m.tipo !== "entrada" && m.cantidad > antes)
    return {
      ok: false,
      error: `Solo hay ${antes} ${antes === 1 ? "unidad" : "unidades"} de ${nombre}: no se pueden quitar ${m.cantidad}.`,
    };
  const cantidad = m.tipo === "entrada" ? m.cantidad : -m.cantidad;
  await repos.inventario.registrar(
    [
      {
        planta,
        tipo: m.tipo,
        cantidad,
        motivo: m.motivo,
        nota: m.nota?.trim() ?? "",
      },
    ],
    email,
  );
  await repos.auditoria.registrar(
    email,
    "inventario",
    `${nombre}: ${cantidad > 0 ? "+" : ""}${cantidad} (${m.motivo})`,
  );
  const disponible = antes + cantidad;
  const que = {
    entrada: `Entran ${m.cantidad}`,
    salida: `Salen ${m.cantidad}`,
    baja: `${m.cantidad} a desperdicio`,
  }[m.tipo];
  return {
    ok: true,
    texto: `${nombre}: ${que}. Ahora hay ${disponible}.`,
    disponible,
  };
}

/**
 * Al emitir una factura: cada línea con planta resta su cantidad (una
 * rectificativa, con cantidades negativas, las devuelve). Las facturas de
 * prueba no tocan el inventario. Se puede llamar varias veces sin repetir.
 */
export async function descontarFactura(
  repos: Repositorios,
  f: Factura,
  email: string,
): Promise<number> {
  if (f.prueba || f.serie?.startsWith("PRUEBA-") || f.estado === "borrador")
    return 0;
  const movimientos = f.lineas
    .map((l, i) => ({ l, i }))
    .filter(({ l }) => l.planta && l.concepto && Math.round(l.cantidad) !== 0)
    .map(({ l, i }) => {
      const cantidad = -Math.round(l.cantidad);
      return {
        planta: l.planta!,
        tipo: (cantidad > 0 ? "entrada" : "salida") as TipoMovimiento,
        cantidad,
        motivo:
          cantidad > 0
            ? `Rectificativa ${f.codigo ?? ""}`.trim()
            : `Factura ${f.codigo ?? ""}`.trim(),
        nota: f.cliente.nombre,
        referencia: `factura:${f.id}:${i}`,
      };
    });
  return repos.inventario.registrar(movimientos, email);
}

/** Por debajo de esta cantidad, «quedan pocas». */
export const POCAS = 5;
/** Meses de la evolución del resumen. */
export const MESES_RESUMEN = 6;

const MES = new Intl.DateTimeFormat("es-ES", {
  month: "short",
  timeZone: "UTC",
});
const MES_LARGO = new Intl.DateTimeFormat("es-ES", {
  month: "long",
  year: "numeric",
  timeZone: "UTC",
});

/** Primer día del mes `atras` meses antes del de `hoy` (AAAA-MM-DD). */
export function inicioDeMes(hoy: string, atras = 0): string {
  const [a, m] = hoy.split("-").map(Number);
  const f = new Date(Date.UTC(a, m - 1 - atras, 1));
  return f.toISOString().slice(0, 10);
}

export interface CifrasMes {
  clave: string;
  etiqueta: string;
  nombre: string;
  entradas: number;
  salidas: number;
  vendidas: number;
  bajas: number;
}

export interface ResumenInventario {
  unidades: number;
  valor: number;
  sinPrecio: number;
  especies: number;
  conExistencias: number;
  sinExistencias: FilaInventario[];
  pocas: FilaInventario[];
  /** Sin existencias pero en la web salen como disponibles. */
  sinStockEnWeb: FilaInventario[];
  /** Con existencias pero en la web salen agotadas. */
  agotadasConStock: FilaInventario[];
  /** Con existencias y sin movimientos en los últimos 90 días. */
  paradas: FilaInventario[];
  meses: CifrasMes[];
  esteMes: CifrasMes;
  mesPasado: CifrasMes;
  /** Bajas sobre todo lo que ha salido (vendido, otras salidas y bajas) en los meses del resumen, en %. */
  tasaDesperdicio: number | null;
  bajasPorMotivo: { nombre: string; valor: number }[];
  masVendidas: { nombre: string; valor: number }[];
  masExistencias: { nombre: string; valor: number; detalle?: string }[];
}

const esFactura = (m: MovimientoInventario) =>
  m.referencia?.startsWith("factura:") ?? false;

/**
 * Lo que se ve de un vistazo en «Resumen»: cifras de hoy, avisos y los
 * movimientos de los últimos meses (`movimientos` desde el primer día de
 * `MESES_RESUMEN - 1` meses atrás).
 */
export function resumenInventario(
  filas: FilaInventario[],
  movimientos: MovimientoInventario[],
  hoy: string,
): ResumenInventario {
  const meses: CifrasMes[] = Array.from({ length: MESES_RESUMEN }, (_, i) => {
    const desde = inicioDeMes(hoy, MESES_RESUMEN - 1 - i);
    const f = new Date(`${desde}T00:00:00Z`);
    return {
      clave: desde.slice(0, 7),
      etiqueta: MES.format(f).replace(".", ""),
      nombre: MES_LARGO.format(f),
      entradas: 0,
      salidas: 0,
      vendidas: 0,
      bajas: 0,
    };
  });
  const porMes = new Map(meses.map((m) => [m.clave, m]));
  const nombres = new Map(filas.map((f) => [f.id, f.nombre]));
  const motivos = new Map<string, number>();
  const vendidas = new Map<string, number>();
  for (const m of movimientos) {
    const mes = porMes.get(m.fecha.slice(0, 7));
    if (!mes) continue;
    // Lo de las facturas es venta (una rectificativa, en positivo, la resta).
    if (esFactura(m)) {
      mes.vendidas -= m.cantidad;
      vendidas.set(m.planta, (vendidas.get(m.planta) ?? 0) - m.cantidad);
    } else if (m.tipo === "entrada") mes.entradas += m.cantidad;
    else if (m.tipo === "baja") {
      mes.bajas -= m.cantidad;
      motivos.set(m.motivo, (motivos.get(m.motivo) ?? 0) - m.cantidad);
    } else mes.salidas -= m.cantidad;
  }
  const salido = meses.reduce(
    (t, m) => t + m.vendidas + m.salidas + m.bajas,
    0,
  );
  const bajas = meses.reduce((t, m) => t + m.bajas, 0);
  const hace90 = new Date(
    Date.parse(`${hoy}T00:00:00Z`) - 90 * 864e5,
  ).toISOString();
  const conStock = filas.filter((f) => f.existencias.disponible > 0);
  const ordenar = (m: Map<string, number>, nombre = (k: string) => k) =>
    [...m]
      .filter(([, v]) => v > 0)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 6)
      .map(([k, valor]) => ({ nombre: nombre(k), valor }));
  return {
    unidades: conStock.reduce((t, f) => t + f.existencias.disponible, 0),
    valor: conStock.reduce(
      (t, f) => t + f.existencias.disponible * (f.precio ?? 0),
      0,
    ),
    sinPrecio: conStock.filter((f) => f.precio === null).length,
    especies: filas.length,
    conExistencias: conStock.length,
    sinExistencias: filas.filter((f) => f.existencias.disponible <= 0),
    pocas: conStock.filter((f) => f.existencias.disponible <= POCAS),
    sinStockEnWeb: filas.filter(
      (f) => f.existencias.disponible <= 0 && f.disponibilidad === "disponible",
    ),
    agotadasConStock: conStock.filter((f) => f.disponibilidad === "agotado"),
    paradas: conStock.filter(
      (f) => f.existencias.ultimo && f.existencias.ultimo < hace90,
    ),
    meses,
    esteMes: meses[meses.length - 1],
    mesPasado: meses[meses.length - 2],
    tasaDesperdicio:
      salido > 0 ? Math.round((bajas / salido) * 1000) / 10 : null,
    bajasPorMotivo: ordenar(motivos),
    masVendidas: ordenar(vendidas, (k) => nombres.get(k) ?? k),
    masExistencias: [...conStock]
      .sort((a, b) => b.existencias.disponible - a.existencias.disponible)
      .slice(0, 6)
      .map((f) => ({
        nombre: f.nombre,
        valor: f.existencias.disponible,
        ...(f.precio !== null
          ? { detalle: `desde ${String(f.precio).replace(".", ",")} €/ud` }
          : {}),
      })),
  };
}

/** Existencias en CSV (separado por «;», como lo abre Excel en español). */
export function inventarioCsv(filas: FilaInventario[]): string {
  const celda = (v: string | number) => {
    const t = String(v);
    return /[;"\n]/.test(t) ? `"${t.replace(/"/g, '""')}"` : t;
  };
  const lineas = [
    [
      "Planta",
      "Disponibles",
      "Bajas (desperdicio)",
      "En la web",
      "Precio desde (€)",
      "Último cambio",
    ],
  ];
  for (const f of filas)
    lineas.push([
      f.nombre,
      String(f.existencias.disponible),
      String(f.existencias.desperdicio),
      f.disponibilidad,
      f.precio === null ? "" : String(f.precio).replace(".", ","),
      f.existencias.ultimo.slice(0, 10),
    ]);
  return (
    "\ufeff" + lineas.map((l) => l.map(celda).join(";")).join("\r\n") + "\r\n"
  );
}
