import type { Cliente, Factura, Gasto, Presupuesto, Repositorios } from '../data/tipos.ts';
import { AJUSTES_VACIOS, clienteVacio, huellaDe, lineaVacia, nuevaFactura, serieDe, sumarDias, codigoDe } from '../facturas/facturas.ts';
import { calcularTotales } from '../facturas/importes.ts';
import { gastoVacio } from '../gastos/gastos.ts';
import { CLAVE_MODO_PRUEBAS, EMISOR_PRUEBA } from './facturacion.ts';
import { clienteActual } from '../../plataforma/actual.ts';
import { AMBITO as AMBITO_PORTAFOLIO, anadirFoto } from '../portafolio/portafolio.ts';
import { FOTO_ANTES, FOTO_DESPUES, PROYECTOS_EJEMPLO } from '../portafolio/ejemplos.ts';
import { guardarTextos } from './textos.ts';

/**
 * Datos de prueba para probar el panel con algo dentro (unos 5 de cada cosa).
 * Todo lleva el prefijo `prueba-` o la serie `PRUEBA-` y se quita de una vez:
 * - Clientes, presupuestos y gastos inventados (correos en example.com).
 * - Facturas en una serie aparte (`PRUEBA-F2026-…`), con marca en el PDF, fuera
 *   del libro para la gestoría y fuera de la cadena de huellas de las reales.
 * - Proyectos y guías como fichas de ejemplo sin revisar: nunca salen en la web.
 * Mientras está activo el modo de pruebas, las facturas que se emiten también van
 * a la serie de prueba.
 */
export const PREFIJO = 'prueba-';

/** CIF de prueba con su dígito de control correcto (letra + 7 cifras + control numérico). */
function cif(letra: 'A' | 'B', numero: number): string {
  const d = String(numero).padStart(7, '0');
  let suma = 0;
  for (let i = 0; i < 7; i++) {
    const n = Number(d[i]);
    if (i % 2 === 0) {
      const doble = n * 2;
      suma += Math.floor(doble / 10) + (doble % 10);
    } else suma += n;
  }
  return `${letra}${d}${(10 - (suma % 10)) % 10}`;
}
const dni = (numero: number) => `${String(numero).padStart(8, '0')}${'TRWAGMYFPDXBNJZSQVHLCKE'[numero % 23]}`;

const CLIENTES: Omit<Cliente, 'id' | 'archivado' | 'notas' | 'pais'>[] = [
  { nombre: 'Jardinería Turia SL (prueba)', nif: cif('B', 4612345), direccion: 'Calle de Prueba 1', codigoPostal: '46001', poblacion: 'Valencia', provincia: 'Valencia', email: 'prueba1@example.com', telefono: '+34 600 000 001', recargo: false },
  { nombre: 'Paisajes del Sur SL (prueba)', nif: cif('B', 4123456), direccion: 'Avenida de Prueba 22', codigoPostal: '41001', poblacion: 'Sevilla', provincia: 'Sevilla', email: 'prueba2@example.com', telefono: '+34 600 000 002', recargo: false },
  { nombre: 'Construcciones Levante SA (prueba)', nif: cif('A', 3654321), direccion: 'Polígono de Prueba, nave 3', codigoPostal: '03001', poblacion: 'Alicante', provincia: 'Alicante', email: 'prueba3@example.com', telefono: '+34 600 000 003', recargo: false },
  { nombre: 'Floristería La Rosa (prueba)', nif: dni(12345678), direccion: 'Plaza de Prueba 4', codigoPostal: '12001', poblacion: 'Castellón de la Plana', provincia: 'Castellón', email: 'prueba4@example.com', telefono: '+34 600 000 004', recargo: true },
  { nombre: 'Garden Center Mediterráneo SL (prueba)', nif: cif('B', 3076543), direccion: 'Carretera de Prueba km 5', codigoPostal: '30001', poblacion: 'Murcia', provincia: 'Murcia', email: 'prueba5@example.com', telefono: '+34 600 000 005', recargo: false },
];

const PRESUPUESTOS: { dias: number; estado: Presupuesto['estado']; tipo: string; nombre: string; empresa: string; provincia: string; mensaje: string; lineas: [string, string, number][] }[] = [
  { dias: 0, estado: 'nuevo', tipo: 'mayor', nombre: 'Laura Prueba', empresa: 'Jardinería Turia SL (prueba)', provincia: 'Valencia', mensaje: 'Necesitamos las palmeras antes de fin de mes para una rotonda. ¿Hacéis la descarga?', lineas: [['phoenix-canariensis', 'Palmera canaria', 12], ['chamaerops-humilis', 'Palmito', 30]] },
  { dias: 1, estado: 'nuevo', tipo: 'unidad', nombre: 'Carlos Prueba', empresa: '', provincia: 'Madrid', mensaje: 'Es para la terraza de casa, un olivo de unos 2 m.', lineas: [['olivo-ornamental-copa', 'Olivo ornamental de copa', 1]] },
  { dias: 6, estado: 'respondido', tipo: 'mayor', nombre: 'Marta Prueba', empresa: 'Paisajes del Sur SL (prueba)', provincia: 'Sevilla', mensaje: 'Proyecto de urbanización, entrega en dos fases.', lineas: [['washingtonia-robusta', 'Washingtonia robusta', 20], ['yucca-elephantipes', 'Yuca', 15]] },
  { dias: 14, estado: 'respondido', tipo: 'mayor', nombre: 'Andrés Prueba', empresa: 'Garden Center Mediterráneo SL (prueba)', provincia: 'Murcia', mensaje: 'Pedido habitual de temporada para la tienda.', lineas: [['cycas-revoluta', 'Cica', 25], ['naranjo-amargo', 'Naranjo amargo', 10]] },
  { dias: 40, estado: 'archivado', tipo: 'mayor', nombre: 'Elena Prueba', empresa: 'Construcciones Levante SA (prueba)', provincia: 'Alicante', mensaje: 'Al final lo dejamos para el año que viene.', lineas: [['higuera-comun', 'Higuera común', 8]] },
];

/** Facturas: [cliente, días atrás, días para pagar, líneas (concepto, cantidad, precio, IVA), cobrada a los N días o null, borrador]. */
const FACTURAS: [number, number, number, [string, number, number, number][], number | null, boolean][] = [
  [0, 75, 30, [['Olivo ornamental de copa', 20, 45, 10]], 20, false],
  [1, 45, 30, [['Palmera canaria', 10, 120, 10], ['Transporte a Sevilla', 1, 250, 21]], 25, false],
  [2, 20, 15, [['Washingtonia robusta', 15, 60, 10], ['Yuca', 15, 18, 10]], null, false],
  [3, 5, 30, [['Cica', 6, 22, 10], ['Palmito', 10, 12, 10]], null, false],
  [4, 0, 30, [['Naranjo amargo', 10, 40, 10]], null, true],
];

const GASTOS: { dias: number; proveedor: string; categoria: string; total: number; base: number | null; iva: number | null; concepto: string; estado: Gasto['estado']; formaPago: string }[] = [
  { dias: 60, proveedor: 'Sustratos del Turia (prueba)', categoria: 'sustratos', total: 363, base: 300, iva: 63, concepto: 'Sustrato universal 70 l (50 sacos)', estado: 'confirmado', formaPago: 'Transferencia' },
  { dias: 30, proveedor: 'Estación de servicio (prueba)', categoria: 'combustible', total: 85.4, base: 70.58, iva: 14.82, concepto: 'Gasóleo furgoneta', estado: 'confirmado', formaPago: 'Tarjeta' },
  { dias: 15, proveedor: 'Envases Agrícolas (prueba)', categoria: 'macetas', total: 242, base: 200, iva: 42, concepto: 'Contenedores 50 l', estado: 'confirmado', formaPago: 'Transferencia' },
  { dias: 3, proveedor: 'Vivero Productor del Sur (prueba)', categoria: 'planta', total: 1210, base: 1100, iva: 110, concepto: 'Palmeras jóvenes para cultivo', estado: 'confirmado', formaPago: 'Transferencia' },
  { dias: 0, proveedor: 'Ferretería Ruzafa (prueba)', categoria: 'herramientas', total: 34.9, base: null, iva: null, concepto: 'Tijeras de podar', estado: 'revisar', formaPago: 'Efectivo' },
];

const bilingue = (es: string, en: string) => ({ es, en });
const PROYECTOS = [
  ['rotonda-de-acceso', 'Rotonda de acceso a un polígono', 'Industrial estate roundabout', 'Palmeras y planta tapizante para una rotonda municipal.', 'Palms and ground cover for a municipal roundabout.', ['phoenix-canariensis', 'yucca-elephantipes']],
  ['patio-de-un-hotel', 'Patio de un hotel en la costa', 'Seaside hotel courtyard', 'Olivos y cicas en contenedor para el patio central de un hotel.', 'Container olive trees and cycads for a hotel courtyard.', ['olivo-ornamental-copa', 'cycas-revoluta']],
  ['parque-infantil', 'Zona verde de un parque infantil', 'Playground green area', 'Planta resistente y sin espinas para un parque de barrio.', 'Hardy, thornless plants for a neighbourhood park.', ['chamaerops-humilis', 'higuera-comun']],
  ['tienda-de-jardineria', 'Reposición de temporada de una jardinería', 'Seasonal restock for a garden centre', 'Surtido variado para la temporada de primavera de una tienda.', 'Mixed range for a garden centre spring season.', ['naranjo-amargo', 'washingtonia-robusta']],
] as const;
const GUIAS = [
  ['como-regar-palmeras', 'Cómo regar las palmeras recién plantadas', 'How to water newly planted palms', 'Riegos de las primeras semanas para que la palmera arraigue bien.'],
  ['transporte-de-planta-grande', 'Qué tener en cuenta al recibir el camión', 'What to check when the lorry arrives', 'Accesos, descarga y comprobaciones al recibir un pedido.'],
  ['olivos-en-maceta', 'Olivos en maceta: tamaño y cuidados', 'Potted olive trees: size and care', 'Qué contenedor elegir y cómo mantener un olivo en maceta.'],
  ['mejor-epoca-para-plantar', 'La mejor época para plantar', 'The best time to plant', 'Cuándo conviene plantar cada familia en la zona mediterránea.'],
] as const;

export interface ResumenPruebas {
  clientes: number;
  presupuestos: number;
  facturas: number;
  gastos: number;
  proyectos: number;
  guias: number;
}

export async function cargarDatosPrueba(repos: Repositorios, email: string, hoy: string): Promise<ResumenPruebas> {
  const hace = (dias: number) => sumarDias(hoy, -dias);
  const autor = { email };

  const clientes: Cliente[] = CLIENTES.map((c, i) => ({ ...clienteVacio(`${PREFIJO}cliente-${i + 1}`), ...c, notas: 'Cliente de prueba' }));
  for (const c of clientes) await repos.clientes.guardar(c, email);

  for (const [i, p] of PRESUPUESTOS.entries()) {
    const fecha = new Date(`${hace(p.dias)}T09:${String(10 + i).padStart(2, '0')}:00Z`).toISOString();
    await repos.presupuestos.borrar(`${PREFIJO}presupuesto-${i + 1}`);
    await repos.presupuestos.guardar({ id: `${PREFIJO}presupuesto-${i + 1}`, fecha, estado: p.estado, idioma: 'es', tipoPedido: p.tipo, nombre: p.nombre, email: `presupuesto${i + 1}@example.com`, telefono: `+34 600 000 1${i}`, empresa: p.empresa, provincia: p.provincia, mensaje: p.mensaje, lineas: p.lineas.map(([especie, nombre, cantidad]) => ({ especie, nombre, cantidad })) });
  }

  // Facturas en orden de fecha, para que la numeración de la serie de prueba vaya seguida.
  await repos.facturas.borrarPruebas();
  let facturas = 0;
  for (const [ci, dias, plazo, lineas, cobrada, borrador] of [...FACTURAS].sort((a, b) => b[1] - a[1])) {
    const c = clientes[ci];
    const fecha = hace(dias);
    const f: Factura = { ...nuevaFactura(c, email, AJUSTES_VACIOS), id: `${PREFIJO}factura-${facturas + 1}`, fecha, vencimiento: sumarDias(fecha, plazo), prueba: true };
    f.lineas = lineas.map(([concepto, cantidad, precio, iva]) => ({ ...lineaVacia(), concepto, cantidad, precio, iva }));
    f.totales = calcularTotales(f.lineas, c.recargo);
    await repos.facturas.guardarBorrador(f);
    facturas++;
    if (borrador) continue;
    const serie = `PRUEBA-${serieDe('ordinaria', fecha)}`;
    await repos.facturas.emitir(f.id, {
      serie,
      fecha,
      emisor: EMISOR_PRUEBA,
      cliente: c,
      huellaAnterior: null,
      codigo: (n) => codigoDe(serie, n),
      huella: (_n, codigo) => huellaDe({ codigo, fecha, total: f.totales.total, nifEmisor: EMISOR_PRUEBA.nif, nifCliente: c.nif }, null),
    });
    if (cobrada !== null) await repos.facturas.marcarCobrada(f.id, sumarDias(fecha, cobrada));
  }

  for (const [i, g] of GASTOS.entries()) {
    const gasto: Gasto = { ...gastoVacio(email, `${PREFIJO}gasto-${i + 1}`), estado: g.estado, fecha: hace(g.dias), proveedor: g.proveedor, categoria: g.categoria, total: g.total, base: g.base, iva: g.iva, formaPago: g.formaPago, lineas: [{ concepto: g.concepto, cantidad: 1, importe: g.total }], notas: 'Gasto de prueba' };
    await repos.gastos.guardar(gasto);
  }

  const cliente = clienteActual();
  let proyectos = 0;
  // Proyectos y guías de la web: solo si el cliente tiene web pública.
  for (const [id, es, en, resumen, resumenEn, especies] of cliente.webPublica ? PROYECTOS : []) {
    const r = await guardarTextos(
      repos,
      'proyectos',
      `${PREFIJO}${id}`,
      {
        slug: `${PREFIJO}${id}`,
        titulo: bilingue(`${es} (prueba)`, `${en} (test)`),
        resumen: bilingue(resumen, resumenEn),
        ubicacion: 'Municipio de prueba',
        especies: [...especies],
        fotos: [],
        secciones: [{ titulo: bilingue('El encargo', 'The brief'), texto: bilingue(`${resumen} Datos inventados para probar el panel.`, `${resumenEn} Made-up data to try the panel.`) }],
        seoDescripcion: bilingue(`Proyecto de prueba: ${resumen}`, `Test project: ${resumenEn}`),
        datosDeEjemplo: true,
        revisado: false,
      },
      '',
      autor,
    );
    if (r.ok) proyectos++;
  }
  let guias = 0;
  for (const [id, es, en, resumen] of cliente.webPublica ? GUIAS : []) {
    const r = await guardarTextos(
      repos,
      'guias',
      `${PREFIJO}${id}`,
      {
        slug: `${PREFIJO}${id}`,
        titulo: bilingue(`${es} (prueba)`, `${en} (test)`),
        resumen: bilingue(resumen, `${en}. Test guide.`),
        secciones: [{ titulo: bilingue('Lo básico', 'The basics'), texto: bilingue(`${resumen} Texto de prueba para ver cómo queda.`, 'Test text to see how it looks.') }],
        seoDescripcion: bilingue(`Guía de prueba: ${resumen}`, `Test guide: ${en}.`),
        datosDeEjemplo: true,
        revisado: false,
      },
      '',
      autor,
    );
    if (r.ok) guias++;
  }

  // Portafolio privado (carpintería): tres proyectos con su antes y después.
  if (cliente.sector === 'carpinteria') {
    for (const [i, p] of PROYECTOS_EJEMPLO.entries()) {
      await quitarProyectoPrueba(repos, p.id);
      await repos.portafolio.guardar({ ...p, antes: [], despues: [], orden: i }, email);
      await anadirFoto(repos, p.id, 'antes', FOTO_ANTES, email);
      await anadirFoto(repos, p.id, 'despues', FOTO_DESPUES, email);
      proyectos++;
    }
  }

  // Inventario de ejemplo: entradas para cada planta, alguna venta y alguna baja (se quitan con el resto).
  await repos.inventario.borrarPruebas();
  const plantas = await repos.contenido.listar('catalogo');
  await repos.inventario.registrar(
    plantas.flatMap((e, i) => [
      { planta: e.id, tipo: 'entrada' as const, cantidad: 20 + ((i * 37) % 180), motivo: 'Producción propia', nota: 'Prueba', referencia: `prueba:entrada:${e.id}` },
      ...(i % 3 === 0 ? [{ planta: e.id, tipo: 'salida' as const, cantidad: -(5 + i), motivo: 'Venta sin factura', nota: 'Prueba', referencia: `prueba:salida:${e.id}` }] : []),
      ...(i % 4 === 1 ? [{ planta: e.id, tipo: 'baja' as const, cantidad: -(2 + (i % 5)), motivo: 'Se ha muerto', nota: 'Prueba', referencia: `prueba:baja:${e.id}` }] : []),
    ]),
    email,
  );

  await repos.ajustesPrivados.guardar(CLAVE_MODO_PRUEBAS, { activo: true, desde: new Date().toISOString() }, email);
  await repos.auditoria.registrar(email, 'datos de prueba', 'cargados');
  return { clientes: clientes.length, presupuestos: PRESUPUESTOS.length, facturas, gastos: GASTOS.length, proyectos, guias };
}

async function quitarProyectoPrueba(repos: Repositorios, id: string) {
  await repos.adjuntos.borrarDe(AMBITO_PORTAFOLIO, id);
  return repos.portafolio.borrar(id);
}

/** Quita todo lo de prueba (incluidas las facturas emitidas en modo de pruebas) y apaga el modo. */
export async function quitarDatosPrueba(repos: Repositorios, email: string): Promise<ResumenPruebas> {
  const facturas = await repos.facturas.borrarPruebas();
  await repos.inventario.borrarPruebas();
  let clientes = 0;
  for (const c of await repos.clientes.listar({ incluirArchivados: true })) if (c.id.startsWith(PREFIJO) && (await repos.clientes.borrar(c.id))) clientes++;
  let presupuestos = 0;
  for (const p of await repos.presupuestos.listar({ limite: 5000 })) if (p.id.startsWith(PREFIJO) && (await repos.presupuestos.borrar(p.id))) presupuestos++;
  let gastos = 0;
  for (const g of await repos.gastos.listar({ limite: 20000 })) if (g.id.startsWith(PREFIJO) && (await repos.gastos.borrar(g.id))) gastos++;
  const autor = { email };
  let proyectos = 0;
  for (const e of await repos.contenido.listar('proyectos'))
    if (e.id.startsWith(PREFIJO)) {
      await repos.contenido.archivar('proyectos', e.id, true, autor);
      proyectos++;
    }
  for (const p of await repos.portafolio.listar({ incluirArchivados: true })) if (p.id.startsWith(PREFIJO) && (await quitarProyectoPrueba(repos, p.id))) proyectos++;
  let guias = 0;
  for (const e of await repos.contenido.listar('guias'))
    if (e.id.startsWith(PREFIJO)) {
      await repos.contenido.archivar('guias', e.id, true, autor);
      guias++;
    }
  await repos.ajustesPrivados.guardar(CLAVE_MODO_PRUEBAS, { activo: false }, email);
  await repos.auditoria.registrar(email, 'datos de prueba', 'quitados');
  return { clientes, presupuestos, facturas, gastos, proyectos, guias };
}
