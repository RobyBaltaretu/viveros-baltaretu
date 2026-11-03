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
  const base: DatosCliente[] = [
    { nombre: 'Marina Soler (demo)', nif: dni(23456781), direccion: 'Calle de Prueba 12, 3.º', codigoPostal: '46005', poblacion: 'Valencia', provincia: 'Valencia', email: 'prueba1@example.com', telefono: '+34 600 000 001', recargo: false, direccionObra: 'Calle de Prueba 12, 3.º (la misma)', formaPago: 'Bizum' },
    { nombre: 'Espacios del Turia SL (demo)', nif: cif('B', 4698765), direccion: 'Polígono de Prueba, nave 7', codigoPostal: '46470', poblacion: 'Catarroja', provincia: 'Valencia', email: 'prueba2@example.com', telefono: '+34 600 000 002', recargo: false, contacto: 'Andrés Prueba (jefe de obra)', direccionObra: 'Obra de prueba: Calle Mayor de Prueba 5, Alfafar', formaPago: 'Transferencia a 30 días' },
    { nombre: 'Estudio Llevant Interiorismo SL (demo)', nif: cif('B', 4611223), direccion: 'Avenida de Prueba 40', codigoPostal: '46018', poblacion: 'Valencia', provincia: 'Valencia', email: 'prueba3@example.com', telefono: '+34 600 000 003', recargo: false, contacto: 'Marta Prueba (interiorista)', formaPago: 'Transferencia' },
    { nombre: 'Daniel Ferrer (demo)', nif: dni(34567812), direccion: 'Plaza de Prueba 3', codigoPostal: '46980', poblacion: 'Paterna', provincia: 'Valencia', email: 'prueba4@example.com', telefono: '+34 600 000 004', recargo: false },
    { nombre: 'Viviendas del Jardín SL (demo)', nif: cif('B', 4655443), direccion: 'Calle de Prueba 88', codigoPostal: '46006', poblacion: 'Valencia', provincia: 'Valencia', email: 'prueba5@example.com', telefono: '+34 600 000 005', recargo: false },
  ];
  return [...base, ...Array.from({length:10},(_,i)=>({...base[i%base.length]!,nombre:['Ático del Carmen','Casa del Mar','Estudio Alameda','Reformas Campanar','Oficinas del Puerto','Apartamento Benimaclet','Vivienda La Eliana','Local del Mercado','Casa de la Huerta','Estudio Centro'][i]+' (prueba)',email:`cliente${i+6}@example.com`,telefono:`+34 600 000 ${String(i+6).padStart(3,'0')}`,nif:dni(40000000+i),direccion:`Calle de Ensayo ${i+1}`,contacto:'Contacto de pruebas'}))];

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
  { dias: 50, proveedor: 'Distribuciones Madera Mediterránea (demo)', categoria: 'tableros', total: 726, base: 600, iva: 126, concepto: 'Melamina blanca 19 mm (12 tableros)', estado: 'confirmado', formaPago: 'Transferencia' },
  { dias: 20, proveedor: 'Herrajes del Taller (demo)', categoria: 'herrajes', total: 302.5, base: 250, iva: 52.5, concepto: 'Kits de correderas y bisagras con cierre suave', estado: 'confirmado', formaPago: 'Transferencia' },
  { dias: 9, proveedor: 'Acabados y Barnices del Mediterráneo (demo)', categoria: 'acabados', total: 181.5, base: 150, iva: 31.5, concepto: 'Laca de poliuretano blanca mate', estado: 'confirmado', formaPago: 'Tarjeta' },
  { dias: 4, proveedor: 'Estación de servicio (prueba)', categoria: 'combustible', total: 85.4, base: 70.58, iva: 14.82, concepto: 'Gasóleo de la furgoneta', estado: 'confirmado', formaPago: 'Tarjeta' },
  { dias: 0, proveedor: 'Ferretería Ruzafa (prueba)', categoria: 'consumibles', total: 34.9, base: null, iva: null, concepto: 'Brocas y tornillería', estado: 'revisar', formaPago: 'Efectivo' },
];

const l = (concepto: string, cantidad: number, precio: number, material = '', extra = false): LineaPresupuestoCliente => ({ concepto, cantidad, precio, material, extra });

/** Presupuestos a cliente: uno en cada situación que enseña el inicio. */
const PRESUPUESTOS: { cliente: number; dias: number; validez: number; estado: PresupuestoCliente['estado']; concepto: string; lineas: LineaPresupuestoCliente[]; anticipo: number; cobrado?: boolean }[] = [
  { cliente: 0, dias: 1, validez: 30, estado: 'borrador', concepto: 'Armario empotrado con puertas correderas', lineas: [l('Armario de dos puertas correderas', 1, 1250, 'Melamina blanca'), l('Montaje e instalación', 1, 180), l('Iluminación LED interior', 1, 95, '', true)], anticipo: 40 },
  { cliente: 2, dias: 26, validez: 30, estado: 'enviado', concepto: 'Vestidor de roble con iluminación integrada', lineas: [l('Vestidor en U con barras y cajoneras', 1, 2650, 'Roble natural'), l('Montaje', 1, 220)], anticipo: 40 },
  { cliente: 1, dias: 18, validez: 45, estado: 'enviado', concepto: 'Cocina con isla y frentes lacados', lineas: [l('Muebles bajos y altos', 1, 5200, 'MDF lacado'), l('Encimera', 3.2, 180, 'Compacto 12 mm'), l('Montaje', 1, 450)], anticipo: 30 },
  { cliente: 3, dias: 3, validez: 30, estado: 'aceptado', concepto: 'Mueble de baño suspendido con cajones', lineas: [l('Mueble suspendido de dos cajones', 1, 890, 'MDF hidrófugo lacado'), l('Montaje', 1, 120)], anticipo: 40 },
  { cliente: 4, dias: 45, validez: 30, estado: 'rechazado', concepto: 'Renovación de puertas interiores', lineas: [l('Puerta de entrada en iroko', 2, 1100, 'Iroko barnizado')], anticipo: 50 },
];

export async function cargarPresupuestosCarpinteria(repos: Repositorios, clientes: Cliente[], email: string, hoy: string): Promise<number> {
  await repos.presupuestosCliente.borrarPruebas();
  let n = 0;
  for (const [i, p] of [...PRESUPUESTOS, ...Array.from({length:15},(_,i)=>({...PRESUPUESTOS[i%5]!,cliente:(i+5)%clientes.length,dias:5+i*9,concepto:['Cocina con isla','Vestidor abierto','Librería de roble','Mueble de lavadero','Puertas correderas'][i%5]+' · proyecto '+(i+6)}))].entries()) {
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

/** Proveedores de prueba (los mismos de los gastos), con lo que sirven. Contactos que no llevan a nadie. */
export const PROVEEDORES_CARPINTERIA: { nombre: string; contacto: string; categorias: string[]; plazoDias: number; formaPago: string; notas: string }[] = [
  { nombre: 'Distribuciones Madera Mediterránea (demo)', contacto: 'Comercial de prueba', categorias: ['tableros', 'macizos', 'chapas', 'cantos', 'encimeras'], plazoDias: 3, formaPago: 'A 30 días', notas: 'Corte a medida con canteado. Pedido mínimo de prueba: 5 tableros.' },
  { nombre: 'Herrajes del Taller (demo)', contacto: 'Mostrador', categorias: ['herrajes', 'tiradores', 'accesorios', 'iluminacion', 'consumibles'], plazoDias: 2, formaPago: 'Transferencia', notas: '' },
  { nombre: 'Acabados y Barnices del Mediterráneo (demo)', contacto: '', categorias: ['acabados'], plazoDias: 5, formaPago: 'Contado', notas: 'Lacan piezas en su taller (plazo de prueba: una semana).' },
];

/**
 * Carga los proveedores de prueba y pone su nombre en los artículos del
 * catálogo de prueba de sus categorías (así salen en su ficha y en los pedidos).
 */
export async function cargarProveedoresCarpinteria(repos: Repositorios, email: string, prefijo: string): Promise<number> {
  for (const [i, p] of PROVEEDORES_CARPINTERIA.entries())
    await repos.proveedores.guardar({ id: `${prefijo}proveedor-${i + 1}`, nif: '', telefono: `+34 600 000 2${i}`, email: `proveedor${i + 1}@example.com`, direccion: '', poblacion: 'Valencia', web: '', archivado: false, ...p }, email);
  for (const a of await repos.catalogo.articulos())
    if (a.id.startsWith(prefijo) && !a.proveedor) {
      const p = PROVEEDORES_CARPINTERIA.find((x) => x.categorias.includes(a.categoria));
      if (p) await repos.catalogo.guardarArticulo({ ...a, proveedor: p.nombre }, email);
    }
  return PROVEEDORES_CARPINTERIA.length;
}

/** Ampliación idempotente: todos los registros son prueba- y se eliminan con el limpiador existente. */
export async function cargarEscenarioCompleto(repos: Repositorios,email:string,hoy:string) {
 const colores=[['Roble natural','#b89772'],['Nogal americano','#70523d'],['Blanco mate','#efeee8'],['Verde oliva','#708238'],['Gris grafito','#444743'],['Arena satinada','#d6c6ae']];
 for(let i=0;i<30;i++) {
 const [nombre,color]=colores[i%6];const categoria=['tableros','macizos','chapas','encimeras','tiradores'][Math.floor(i/6)];
 await repos.catalogo.guardarArticulo({id:`prueba-studio-material-${i}`,nombre:`${categoria==='tiradores'?'Tirador':categoria==='encimeras'?'Encimera':categoria==='macizos'?'Tarima':'Panel'} ${nombre} (prueba)`,categoria,unidad:categoria==='tiradores'?'ud':'m²',coste:18+i*3.5,merma:10,margen:35,precioFijo:null,referencia:`DEMO-${String(i+1).padStart(3,'0')}`,proveedor:PROVEEDORES_CARPINTERIA[i%3].nombre,espesor:categoria==='tiradores'?null:19,acabado:nombre,notas:'Muestra ficticia para pruebas; confirmar acabado y precio con el proveedor.',visual:{fabricante:'Fabricante de demostración',coleccion:'Colección de muestras',codigoDecor:`DEMO-${String(i+1).padStart(3,'0')}`,colorHex:color,brillo:'mate',uso:categoria==='encimeras'?['encimera']:categoria==='tiradores'?[]:['mueble'],humedad:'no-declarada'}},email);
 }
 await repos.pedidosProveedor.borrarPruebas();
 const proveedores=await repos.proveedores.listar();const presupuestos=await repos.presupuestosCliente.listar();
 for(let i=0;i<8;i++) {const p=proveedores.find(p=>p.id===`prueba-proveedor-${i%3+1}`);if(!p)continue;await repos.pedidosProveedor.crear({id:`prueba-pedido-demo-${i}`,estado:i%2?'enviado':'borrador',proveedorId:p.id,proveedor:p,presupuestoClienteId:presupuestos[i%presupuestos.length]?.id??null,fecha:sumarDias(hoy,-i*3),entrega:sumarDias(hoy,7-i),lineas:[{articuloId:'prueba-studio-material-0',concepto:'Panel roble natural (prueba)',referencia:'DEMO-001',detalle:'Corte según medición de prueba',cantidad:4+i,unidad:'m²',coste:35}],notas:'Entrega concertada en taller (prueba)',notasInternas:'Pedido de demostración',coste:(4+i)*35,enviadoEl:i%2?hoy:null,recibidoEl:null,gastoId:null},email);}
}

// Histórico de seis meses: importes y clientes variados, sin facturas reales.
for(let i=0;i<36;i++) FACTURAS_CARPINTERIA.push([i%15,3+i*5,30,[[['Cocina a medida','Montaje de armario','Mueble de baño','Puertas interiores','Librería de salón','Vestidor'][i%6]+' (prueba)',1,480+(i%9)*310,21]],i%4===0?null:10,i%11===0]);
for(let i=0;i<24;i++) {const base=75+(i%8)*85;GASTOS_CARPINTERIA.push({dias:i*7,proveedor:PROVEEDORES_CARPINTERIA[i%3].nombre,categoria:['tableros','herrajes','acabados'][i%3],total:Math.round(base*121)/100,base,iva:Math.round(base*21)/100,concepto:'Suministro de taller · lote '+(i+1)+' (prueba)',estado:i%7===0?'revisar':'confirmado',formaPago:'Transferencia'});}
