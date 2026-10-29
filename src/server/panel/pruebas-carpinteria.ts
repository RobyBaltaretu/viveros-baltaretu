import type { Cliente, Gasto, LineaPresupuestoCliente, PresupuestoCliente, Repositorios } from '../data/tipos.ts';
import { sumarDias } from '../facturas/facturas.ts';
import { calcularPresupuesto } from '../presupuestos-cliente/presupuestos.ts';

/**
 * Datos de prueba de la carpintería (Creaciones Turia): clientes, facturas,
 * gastos y presupuestos inventados, con trabajos del sector. Los usa
 * `cargarDatosPrueba` en lugar de los del vivero; todo lleva el prefijo
 * `prueba-` (o la serie `PRUEBA-`) y se quita de una vez con los demás.
 */

type DatosCliente = Omit<Cliente, 'id' | 'archivado' | 'notas' | 'pais'>;

export function clientesCarpinteria(cif: (l: 'A' | 'B', n: number) => string, dni: (n: number) => string): DatosCliente[] {
  return [
    { nombre: 'Lucía Prueba Martínez', nif: dni(23456781), direccion: 'Calle de Prueba 12, 3.º', codigoPostal: '46005', poblacion: 'Valencia', provincia: 'Valencia', email: 'prueba1@example.com', telefono: '+34 600 000 001', recargo: false },
    { nombre: 'Reformas Albufera SL (prueba)', nif: cif('B', 4698765), direccion: 'Polígono de Prueba, nave 7', codigoPostal: '46470', poblacion: 'Catarroja', provincia: 'Valencia', email: 'prueba2@example.com', telefono: '+34 600 000 002', recargo: false },
    { nombre: 'Estudio de Interiorismo Patraix SL (prueba)', nif: cif('B', 4611223), direccion: 'Avenida de Prueba 40', codigoPostal: '46018', poblacion: 'Valencia', provincia: 'Valencia', email: 'prueba3@example.com', telefono: '+34 600 000 003', recargo: false },
    { nombre: 'Javier Prueba Gómez', nif: dni(34567812), direccion: 'Plaza de Prueba 3', codigoPostal: '46980', poblacion: 'Paterna', provincia: 'Valencia', email: 'prueba4@example.com', telefono: '+34 600 000 004', recargo: false },
    { nombre: 'Inmobiliaria Ruzafa SL (prueba)', nif: cif('B', 4655443), direccion: 'Calle de Prueba 88', codigoPostal: '46006', poblacion: 'Valencia', provincia: 'Valencia', email: 'prueba5@example.com', telefono: '+34 600 000 005', recargo: false },
  ];
}

/** Facturas: [cliente, días atrás, días para pagar, líneas (concepto, cantidad, precio, IVA), cobrada a los N días o null, borrador]. */
export const FACTURAS_CARPINTERIA: [number, number, number, [string, number, number, number][], number | null, boolean][] = [
  [0, 70, 30, [['Armario empotrado de dos puertas correderas (melamina blanca)', 1, 1250, 21], ['Montaje e instalación', 1, 180, 21]], 20, false],
  [1, 40, 30, [['Frentes de cocina lacados en blanco mate', 1, 2400, 21]], 25, false],
  [2, 38, 15, [['Puertas de paso lacadas', 6, 310, 21], ['Retirada de las puertas viejas', 1, 90, 21]], null, false],
  [4, 6, 30, [['Restauración de la escalera de madera', 1, 1450, 21]], null, false],
  [3, 0, 30, [['Estantería de salón en roble macizo', 1, 960, 21]], null, true],
];

export const GASTOS_CARPINTERIA: { dias: number; proveedor: string; categoria: string; total: number; base: number | null; iva: number | null; concepto: string; estado: Gasto['estado']; formaPago: string }[] = [
  { dias: 50, proveedor: 'Tableros Levante (prueba)', categoria: 'otros', total: 726, base: 600, iva: 126, concepto: 'Melamina blanca 19 mm (12 tableros)', estado: 'confirmado', formaPago: 'Transferencia' },
  { dias: 20, proveedor: 'Herrajes del Turia (prueba)', categoria: 'otros', total: 302.5, base: 250, iva: 52.5, concepto: 'Kits de correderas y bisagras con cierre suave', estado: 'confirmado', formaPago: 'Transferencia' },
  { dias: 9, proveedor: 'Barnices y Lacas (prueba)', categoria: 'otros', total: 181.5, base: 150, iva: 31.5, concepto: 'Laca de poliuretano blanca mate', estado: 'confirmado', formaPago: 'Tarjeta' },
  { dias: 4, proveedor: 'Estación de servicio (prueba)', categoria: 'combustible', total: 85.4, base: 70.58, iva: 14.82, concepto: 'Gasóleo de la furgoneta', estado: 'confirmado', formaPago: 'Tarjeta' },
  { dias: 0, proveedor: 'Ferretería Ruzafa (prueba)', categoria: 'mantenimiento', total: 34.9, base: null, iva: null, concepto: 'Brocas y tornillería', estado: 'revisar', formaPago: 'Efectivo' },
];

const l = (concepto: string, cantidad: number, precio: number, material = '', extra = false): LineaPresupuestoCliente => ({ concepto, cantidad, precio, material, extra });

/** Presupuestos a cliente: uno en cada situación que enseña el inicio. */
const PRESUPUESTOS: { cliente: number; dias: number; validez: number; estado: PresupuestoCliente['estado']; concepto: string; lineas: LineaPresupuestoCliente[]; anticipo: number; cobrado?: boolean }[] = [
  { cliente: 0, dias: 1, validez: 30, estado: 'borrador', concepto: 'Armario empotrado del dormitorio', lineas: [l('Armario de dos puertas correderas', 1, 1250, 'Melamina blanca'), l('Montaje e instalación', 1, 180), l('Iluminación LED interior', 1, 95, '', true)], anticipo: 40 },
  { cliente: 2, dias: 26, validez: 30, estado: 'enviado', concepto: 'Vestidor a medida', lineas: [l('Vestidor en U con barras y cajoneras', 1, 2650, 'Roble natural'), l('Montaje', 1, 220)], anticipo: 40 },
  { cliente: 1, dias: 18, validez: 45, estado: 'enviado', concepto: 'Cocina completa', lineas: [l('Muebles bajos y altos', 1, 5200, 'MDF lacado'), l('Encimera', 3.2, 180, 'Compacto 12 mm'), l('Montaje', 1, 450)], anticipo: 30 },
  { cliente: 3, dias: 3, validez: 30, estado: 'aceptado', concepto: 'Mueble de baño lacado', lineas: [l('Mueble suspendido de dos cajones', 1, 890, 'MDF hidrófugo lacado'), l('Montaje', 1, 120)], anticipo: 40 },
  { cliente: 4, dias: 45, validez: 30, estado: 'rechazado', concepto: 'Puertas de entrada de un local', lineas: [l('Puerta de entrada en iroko', 2, 1100, 'Iroko barnizado')], anticipo: 50 },
];

export async function cargarPresupuestosCarpinteria(repos: Repositorios, clientes: Cliente[], email: string, hoy: string): Promise<number> {
  await repos.presupuestosCliente.borrarPruebas();
  let n = 0;
  for (const [i, p] of PRESUPUESTOS.entries()) {
    const fecha = sumarDias(hoy, -p.dias);
    const totales = calcularPresupuesto(p.lineas, 21, p.anticipo);
    await repos.presupuestosCliente.crear(
      {
        id: `prueba-presupuesto-cliente-${i + 1}`,
        serie: `PRUEBA-P${fecha.slice(0, 4)}`,
        estado: p.estado,
        fecha,
        validez: sumarDias(fecha, p.validez),
        clienteId: clientes[p.cliente]!.id,
        cliente: clientes[p.cliente]!,
        obraId: null,
        concepto: `${p.concepto} (prueba)`,
        lineas: p.lineas,
        iva: 21,
        anticipoPct: p.anticipo,
        totales,
        formaPago: 'Transferencia',
        notas: 'Presupuesto de prueba',
        cobroAnticipo: null,
        cobroResto: null,
        facturaAnticipoId: null,
        facturaId: null,
      },
      email,
    );
    n++;
  }
  return n;
}
