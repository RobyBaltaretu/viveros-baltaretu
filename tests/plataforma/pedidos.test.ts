import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { ResultadoEscandallo } from '../../src/server/catalogo/escandallo.ts';
import { aplicarMigraciones, crearRepositoriosD1, type Repositorios } from '../../src/server/data/index.ts';
import type { ArticuloCatalogo, LineaPedido, PedidoProveedor, Proveedor } from '../../src/server/data/tipos.ts';
import { cambiarEstadoPedido, cambiarPedido, costeDe, crearPedido, gastoDePedido, leerFormularioPedido, lineasDeTrabajo, mensajePedido, proveedorProbable } from '../../src/server/pedidos/pedidos.ts';
import { proveedorVacio } from '../../src/server/proveedores/proveedores.ts';
import { d1DePrueba } from '../panel/d1.ts';

const yo = 'propietario@example.com';
const linea = (cambios: Partial<LineaPedido>): LineaPedido => ({ articuloId: null, concepto: 'Tablero', referencia: '', detalle: '', cantidad: 1, unidad: 'ud', coste: 0, ...cambios });
const art = (id: string, categoria: string, proveedor = '', cambios: Partial<ArticuloCatalogo> = {}) => ({ id, categoria, proveedor, referencia: '', acabado: '', coste: 10, unidad: 'ud', ...cambios }) as ArticuloCatalogo;

describe('pedidos: reglas', () => {
  it('lee el formulario (líneas vacías fuera, números a la española) y suma el coste a céntimos', () => {
    const f = new FormData();
    for (const [k, v] of Object.entries({ filas: '3', proveedorId: 'p1', entrega: '2026-11-10', 'l0.concepto': 'Melamina 19 mm', 'l0.cantidad': '4,25', 'l0.unidad': 'm²', 'l0.coste': '12,30', 'l0.referencia': 'MEL19', 'l1.concepto': '', 'l2.concepto': 'Bisagras', 'l2.cantidad': '8', 'l2.coste': '' })) f.set(k, v);
    const e = leerFormularioPedido(f);
    expect(e.lineas).toEqual([linea({ concepto: 'Melamina 19 mm', cantidad: 4.25, unidad: 'm²', coste: 12.3, referencia: 'MEL19' }), linea({ concepto: 'Bisagras', cantidad: 8 })]);
    expect(costeDe(e.lineas)).toBe(52.28);
    expect(costeDe([linea({ cantidad: 3, coste: 0.333 }), linea({ cantidad: 1.5, coste: 0.01 })])).toBe(1.02);
  });

  it('el mensaje al proveedor no lleva precios ni costes', () => {
    const p = { codigo: 'PE2026-0007', proveedor: { nombre: 'Tableros', contacto: 'Ana', nif: '', telefono: '', email: '' }, entrega: '2026-11-10', notas: 'Cortado a medida.', lineas: [linea({ concepto: 'Melamina blanca', cantidad: 4.25, unidad: 'm²', coste: 12.3, referencia: 'MEL19', detalle: 'Blanco' })] } as PedidoProveedor;
    const m = mensajePedido(p, 'Creaciones de prueba');
    expect(m).toBe('Hola Ana, soy de Creaciones de prueba.\nOs hago el pedido PE2026-0007:\n- 4,25 m² · Melamina blanca (ref. MEL19) · Blanco\nLo necesitamos para el 10/11/2026.\nCortado a medida.\n¿Me confirmáis plazo y precio? Gracias.');
    expect(m).not.toMatch(/12,3|€/);
  });

  it('los materiales de un trabajo: sin mano de obra ni servicios, juntos por artículo y redondeados hacia arriba', () => {
    const l = (articuloId: string, articulo: string, grupo: string, cantidad: number, unidad = 'm²', costeUnidad = 10) => ({ articuloId, articulo, grupo, cantidad, unidad, costeUnidad });
    const e = { lineas: [l('mel', 'Melamina', 'Materiales', 2.2041), l('bis', 'Bisagra', 'Herrajes y accesorios', 8, 'ud', 2), l('mel', 'Melamina', 'Materiales', 1.1), l('h', 'Hora de taller', 'Mano de obra', 6, 'h'), l('t', 'Transporte', 'Servicios', 1, 'ud')] } as unknown as ResultadoEscandallo;
    const r = lineasDeTrabajo(e, [art('mel', 'tableros', '', { referencia: 'MEL19', acabado: 'Blanco' })], 'Armario 200 × 240');
    expect(r).toEqual([linea({ articuloId: 'mel', concepto: 'Melamina', referencia: 'MEL19', detalle: 'Blanco · Armario 200 × 240', cantidad: 3.31, unidad: 'm²', coste: 10 }), linea({ articuloId: 'bis', concepto: 'Bisagra', detalle: 'Armario 200 × 240', cantidad: 8, coste: 2 })]);
  });

  it('proveedor probable por el nombre de los artículos, y el gasto del pedido con el tipo que más pesa', () => {
    const arts = [art('mel', 'tableros', 'Tableros Levante SL'), art('can', 'cantos', 'tableros levante'), art('bis', 'herrajes', 'Herrajes')];
    const provs = [{ ...proveedorVacio('h'), nombre: 'Herrajes' }, { ...proveedorVacio('t'), nombre: 'Tableros Levante' }] as Proveedor[];
    const lineas = [linea({ articuloId: 'mel', cantidad: 3, coste: 20 }), linea({ articuloId: 'can', cantidad: 10, coste: 1 }), linea({ articuloId: 'bis', cantidad: 8, coste: 2 })];
    expect(proveedorProbable(lineas, arts, provs)?.id).toBe('t');
    const g = gastoDePedido({ codigo: 'PE2026-0001', proveedor: { nombre: 'Tableros Levante', nif: 'B12345674' }, lineas } as PedidoProveedor, arts, yo, '2026-10-30');
    expect(g).toMatchObject({ estado: 'revisar', proveedor: 'Tableros Levante', nifProveedor: 'B12345674', categoria: 'tableros', base: 86, iva: 18.06, total: 104.06, fecha: '2026-10-30' });
    expect(g.lineas[0]).toEqual({ concepto: 'Tablero', cantidad: 3, importe: 72.6 });
  });
});

describe('pedidos: repositorio y estados', () => {
  let repos: Repositorios;
  let cerrar: () => Promise<void>;
  beforeAll(async () => {
    const { db, cerrar: c } = await d1DePrueba();
    cerrar = c;
    await aplicarMigraciones(db);
    repos = crearRepositoriosD1(db);
    await repos.proveedores.guardar({ ...proveedorVacio('prov'), nombre: 'Tableros Levante', telefono: '600000000' }, yo);
    await repos.proveedores.guardar({ ...proveedorVacio('oculto'), nombre: 'Viejo', archivado: true }, yo);
  }, 30_000);
  afterAll(() => cerrar());

  const entrada = { proveedorId: 'prov', presupuestoClienteId: null, entrega: null, lineas: [linea({ concepto: 'Melamina', cantidad: 2, coste: 15 })], notas: '', notasInternas: '' };

  it('alta con código correlativo por año, validación y cambio solo en borrador', async () => {
    expect(await crearPedido(repos, { ...entrada, proveedorId: 'oculto' }, yo, '2026-10-30')).toMatchObject({ ok: false });
    expect(await crearPedido(repos, { ...entrada, lineas: [] }, yo, '2026-10-30')).toMatchObject({ ok: false, errores: [{ campo: 'lineas' }] });
    const a = await crearPedido(repos, entrada, yo, '2026-10-30');
    const b = await crearPedido(repos, entrada, yo, '2026-10-31');
    const c = await crearPedido(repos, entrada, yo, '2027-01-02');
    if (!a.ok || !b.ok || !c.ok) throw new Error('alta');
    expect([a.pedido.codigo, b.pedido.codigo, c.pedido.codigo]).toEqual(['PE2026-0001', 'PE2026-0002', 'PE2027-0001']);
    expect(a.pedido).toMatchObject({ estado: 'borrador', coste: 30, proveedor: { nombre: 'Tableros Levante', telefono: '600000000' } });
    const cambiado = await cambiarPedido(repos, a.pedido.id, { ...entrada, lineas: [linea({ concepto: 'Melamina', cantidad: 3, coste: 15 })] }, yo);
    expect(cambiado.ok && cambiado.pedido.coste).toBe(45);

    expect(await cambiarEstadoPedido(repos, a.pedido.id, 'recibido', yo, '2026-10-30')).toMatchObject({ ok: false });
    const enviado = await cambiarEstadoPedido(repos, a.pedido.id, 'enviado', yo, '2026-10-30');
    expect(enviado).toMatchObject({ ok: true, pedido: { estado: 'enviado', enviadoEl: '2026-10-30' } });
    expect(await cambiarPedido(repos, a.pedido.id, entrada, yo)).toMatchObject({ ok: false });
    expect(await repos.pedidosProveedor.borrar(a.pedido.id)).toBe(false);
    const recibido = await cambiarEstadoPedido(repos, a.pedido.id, 'recibido', yo, '2026-11-02');
    expect(recibido).toMatchObject({ ok: true, pedido: { estado: 'recibido', recibidoEl: '2026-11-02', enviadoEl: '2026-10-30' } });
    expect((await repos.pedidosProveedor.listar({ estado: 'recibido' })).map((p) => p.codigo)).toEqual(['PE2026-0001']);
    expect(await repos.pedidosProveedor.listar({ proveedorId: 'prov' })).toHaveLength(3);
    expect(await repos.pedidosProveedor.borrar(b.pedido.id)).toBe(true);
  });
});
