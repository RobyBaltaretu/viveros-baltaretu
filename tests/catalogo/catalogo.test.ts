import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { aplicarMigraciones, crearRepositoriosD1, type Repositorios } from '../../src/server/data/index.ts';
import { esquemaPlantilla, guardarArticulo, type EntradaArticulo, guardarPlantilla, precioVenta, sinPrecio } from '../../src/server/catalogo/catalogo.ts';
import { calcularEscandallo } from '../../src/server/catalogo/escandallo.ts';
import { comprobarFormula, ErrorFormula, evaluar } from '../../src/server/catalogo/formulas.ts';
import { articulosDePartida, cargarCatalogoDePartida, plantillasDePartida } from '../../src/server/catalogo/partida.ts';
import type { ArticuloCatalogo, PlantillaCatalogo } from '../../src/server/data/tipos.ts';
import { d1DePrueba } from '../panel/d1.ts';

let repos: Repositorios;
let cerrar: () => Promise<void>;
beforeAll(async () => {
  const { db, cerrar: c } = await d1DePrueba();
  cerrar = c;
  await aplicarMigraciones(db);
  repos = crearRepositoriosD1(db);
}, 30_000);
afterAll(() => cerrar());

const yo = 'propietario@example.com';

describe('fórmulas de las plantillas', () => {
  it('suma, resta, producto, división, paréntesis y decimales con coma o punto', () => {
    const v = { ancho: 2, alto: 2.4, fondo: 0.6, puertas: 2 };
    expect(evaluar('2 * alto * fondo', v)).toBeCloseTo(2.88);
    expect(evaluar('(ancho + 0,5) / 2', v)).toBeCloseTo(1.25);
    expect(evaluar('ancho * 1.05 - -1', v)).toBeCloseTo(3.1);
    expect(evaluar('max(puertas - 1; 0) * alto', v)).toBeCloseTo(2.4);
    expect(evaluar('max(2, arriba(alto / 0,6))', v)).toBe(4);
    expect(evaluar('arriba(2,0000000001)', {})).toBe(2);
    expect(evaluar('abajo(2.9) + redondear(2,5) + min(1;2;0,5)', {})).toBeCloseTo(5.5);
  });

  it('errores en español y nunca ejecuta código', () => {
    expect(() => evaluar('alto *', { alto: 1 })).toThrow(ErrorFormula);
    expect(() => evaluar('1 / 0', {})).toThrow('divide entre 0');
    expect(() => evaluar('profundo * 2', { alto: 1 })).toThrow('«profundo»');
    expect(() => evaluar('alert(1)', {})).toThrow('No conozco la función «alert»');
    expect(() => evaluar('constructor.constructor("x")()', {})).toThrow(ErrorFormula);
    expect(() => evaluar('2 ** 3', {})).toThrow(ErrorFormula);
    expect(() => evaluar('x'.repeat(301), {})).toThrow('demasiado larga');
    expect(comprobarFormula('2 * alto * fondo', ['alto', 'fondo'])).toBeNull();
    expect(comprobarFormula('2 * alto * ancho', ['alto'])).toContain('«ancho»');
    expect(comprobarFormula('', [])).toContain('Escribe una fórmula');
  });
});

describe('artículos', () => {
  it('precio de venta: el fijado a mano o el coste más el margen', () => {
    expect(precioVenta({ coste: 10, margen: 30, precioFijo: null })).toBe(13);
    expect(precioVenta({ coste: 10, margen: 30, precioFijo: 15 })).toBe(15);
    expect(sinPrecio({ coste: 0, precioFijo: null })).toBe(true);
    expect(sinPrecio({ coste: 0, precioFijo: 12 })).toBe(false);
  });

  it('alta y cambio validados', async () => {
    const r = await guardarArticulo(repos, { categoria: 'tableros', nombre: 'Melamina gris 19 mm', unidad: 'm²', coste: '10,5' as unknown as number, merma: 15, margen: 30 }, yo);
    expect(r.ok).toBe(false); // «10,5» no es un número para el esquema: el formulario lo convierte antes.
    const ok = await guardarArticulo(repos, { categoria: 'tableros', nombre: 'Melamina gris 19 mm', unidad: 'm²', coste: 10.499, merma: 15, margen: 30, espesor: 19 }, yo);
    if (!ok.ok) throw new Error(ok.error);
    expect(ok.valor).toMatchObject({ nombre: 'Melamina gris 19 mm', coste: 10.5, espesor: 19, precioFijo: null, archivado: false });
    const cambio = await guardarArticulo(repos, { ...ok.valor, coste: 11 } as EntradaArticulo, yo);
    expect(cambio.ok && cambio.valor).toMatchObject({ id: ok.valor.id, coste: 11 });
    expect(await guardarArticulo(repos, { categoria: 'nada', nombre: 'X', unidad: 'ud', coste: 1, merma: 0, margen: 0 }, yo)).toEqual({ ok: false, error: 'Elige una categoría.' });
    expect(await guardarArticulo(repos, { categoria: 'herrajes', nombre: 'X', unidad: 'ud', coste: -1, merma: 0, margen: 0 }, yo)).toMatchObject({ ok: false, error: expect.stringContaining('negativo') });
    expect(await guardarArticulo(repos, { id: 'no-existe', categoria: 'herrajes', nombre: 'X', unidad: 'ud', coste: 1, merma: 0, margen: 0 }, yo)).toEqual({ ok: false, error: 'Ese artículo no existe.' });
    expect(await repos.catalogo.archivarArticulo(ok.valor.id, true, yo)).toBe(true);
    expect((await repos.catalogo.articulos()).some((a) => a.id === ok.valor.id)).toBe(false);
  });
});

describe('catálogo de partida', () => {
  it('cada plantilla es válida, sus artículos existen y con las medidas propuestas da un escandallo sin avisos', () => {
    const articulos = articulosDePartida('', true).map((a) => ({ ...a, archivado: false, actualizado: '' })) as ArticuloCatalogo[];
    const ids = new Set(articulos.map((a) => a.id));
    expect(ids.size).toBe(articulos.length);
    for (const p of plantillasDePartida()) {
      const r = esquemaPlantilla.safeParse(p);
      expect(r.success, `${p.nombre}: ${r.success ? '' : r.error.issues[0]?.message}`).toBe(true);
      for (const c of p.componentes) if ('id' in c.articulo) expect(ids.has(c.articulo.id), `${p.nombre}: ${c.articulo.id}`).toBe(true);
      for (const o of p.opciones) expect(ids.has(o.defecto!), `${p.nombre}: ${o.defecto}`).toBe(true);
      const e = calcularEscandallo({ ...p, archivado: false, actualizado: '' }, articulos, {});
      expect(e.avisos, p.nombre).toEqual([]);
      expect(e.precio, p.nombre).toBeGreaterThan(e.coste);
      expect(e.lineas.length, p.nombre).toBeGreaterThan(3);
    }
  });

  it('se carga sin precios, sin repetir y sin pisar lo que el negocio ya cambió', async () => {
    const r = await cargarCatalogoDePartida(repos, yo);
    expect(r.articulos).toBeGreaterThan(40);
    expect(r.plantillas).toBe(9);
    const melamina = (await repos.catalogo.articulo('tablero-melamina-blanca-19'))!;
    expect(melamina).toMatchObject({ coste: 0, merma: 15, margen: 30, unidad: 'm²' });
    await repos.catalogo.guardarArticulo({ ...melamina, coste: 9 }, yo);
    expect(await cargarCatalogoDePartida(repos, yo)).toEqual({ articulos: 0, plantillas: 0 });
    expect((await repos.catalogo.articulo('tablero-melamina-blanca-19'))!.coste).toBe(9);
  });

  it('los de prueba llevan su prefijo, sus precios de ejemplo y se quitan de una vez', async () => {
    const r = await cargarCatalogoDePartida(repos, yo, 'prueba-', true);
    expect(r.plantillas).toBe(9);
    const p = (await repos.catalogo.plantilla('prueba-armario-correderas'))!;
    expect(p.opciones[0]!.defecto).toBe('prueba-tablero-melamina-blanca-19');
    expect((await repos.catalogo.articulo('prueba-mano-taller'))!.coste).toBe(22);
    expect(await repos.catalogo.borrarPruebas()).toBe(r.articulos + r.plantillas);
    expect(await repos.catalogo.articulo('tablero-melamina-blanca-19')).not.toBeNull();
  });
});

describe('escandallo', () => {
  const art = (id: string, categoria: string, unidad: string, coste: number, merma = 0): ArticuloCatalogo => ({ id, categoria, nombre: id, unidad, coste, merma, margen: 50, precioFijo: null, referencia: '', proveedor: '', espesor: null, acabado: '', notas: '', archivado: false, actualizado: '' });
  const articulos = [art('blanco', 'tableros', 'm²', 10, 10), art('roble', 'tableros', 'm²', 40, 10), art('bisagra', 'herrajes', 'ud', 2), art('hora', 'mano-obra', 'h', 20), art('sin-precio', 'herrajes', 'ud', 0)];
  const plantilla: PlantillaCatalogo = {
    id: 'p',
    nombre: 'Armario',
    tipoTrabajo: 'Armarios',
    descripcion: '',
    parametros: [
      { id: 'ancho', nombre: 'Ancho', tipo: 'medida', defecto: 100, min: 50, max: 300 },
      { id: 'alto', nombre: 'Alto', tipo: 'medida', defecto: 200, min: 50, max: 300 },
      { id: 'puertas', nombre: 'Puertas', tipo: 'numero', defecto: 2, min: 1, max: 6 },
    ],
    opciones: [{ id: 'cuerpo', nombre: 'Material del cuerpo', categorias: ['tableros'], defecto: 'blanco' }],
    componentes: [
      { concepto: 'Costados', articulo: { opcion: 'cuerpo' }, cantidad: '2 * alto * 0,6' },
      { concepto: 'Bisagras', articulo: { id: 'bisagra' }, cantidad: 'puertas * 3' },
      { concepto: 'Horas', articulo: { id: 'hora' }, cantidad: '1 + ancho * alto' },
      { concepto: 'Nada', articulo: { id: 'bisagra' }, cantidad: '0' },
    ],
    orden: 0,
    archivado: false,
    actualizado: '',
  };

  it('medidas en cm a metros, merma, coste, precio, margen y grupos (al céntimo)', () => {
    const e = calcularEscandallo(plantilla, articulos, { ancho: 150, alto: 240, puertas: 3 });
    expect(e.lineas.map((l) => [l.concepto, l.cantidadNeta, l.cantidad, l.coste, l.precio])).toEqual([
      ['Costados', 2.88, 3.168, 31.68, 47.52],
      ['Bisagras', 9, 9, 18, 27],
      ['Horas', 4.6, 4.6, 92, 138],
    ]);
    expect(e).toMatchObject({ coste: 141.68, precio: 212.52, margen: 70.84, margenPct: 33.3, avisos: [] });
    expect(e.grupos).toEqual([
      { grupo: 'Materiales', coste: 31.68, precio: 47.52 },
      { grupo: 'Herrajes y accesorios', coste: 18, precio: 27 },
      { grupo: 'Mano de obra', coste: 92, precio: 138 },
    ]);
    expect(e.descripcion).toBe('150 × 240 cm · 3 puertas · Material del cuerpo: blanco');
  });

  it('el material elegido cambia el precio; avisa de lo que falta', () => {
    expect(calcularEscandallo(plantilla, articulos, {}, { cuerpo: 'roble' }).lineas[0]).toMatchObject({ articulo: 'roble', coste: 105.6 });
    const sinElegir = calcularEscandallo({ ...plantilla, opciones: [{ ...plantilla.opciones[0]!, defecto: null }] }, articulos, {});
    expect(sinElegir.avisos).toContain('Elige material del cuerpo.');
    const fuera = calcularEscandallo(plantilla, articulos, { ancho: 20 });
    expect(fuera.avisos).toContain('Ancho: entre 50 y 300 cm.');
    const sinPrecioP = calcularEscandallo({ ...plantilla, componentes: [{ concepto: 'Tirador', articulo: { id: 'sin-precio' }, cantidad: '2' }] }, articulos, {});
    expect(sinPrecioP.avisos).toEqual(['«sin-precio» no tiene precio: rellénalo en el catálogo.']);
    expect(sinPrecioP.margenPct).toBeNull();
  });

  it('una plantilla con una fórmula o un material que no existen no se guarda', async () => {
    await cargarCatalogoDePartida(repos, yo);
    const base = { nombre: 'Prueba', parametros: plantilla.parametros, opciones: [{ id: 'cuerpo', nombre: 'Cuerpo', categorias: ['tableros'], defecto: 'tablero-melamina-blanca-19' }], componentes: [{ concepto: 'Costados', articulo: { opcion: 'cuerpo' }, cantidad: '2 * alto' }] };
    expect((await guardarPlantilla(repos, base, yo)).ok).toBe(true);
    expect(await guardarPlantilla(repos, { ...base, componentes: [{ concepto: 'Costados', articulo: { opcion: 'cuerpo' }, cantidad: '2 * profundo' }] }, yo)).toMatchObject({ ok: false, error: expect.stringContaining('«Costados»: No hay ninguna medida que se llame «profundo»') });
    expect(await guardarPlantilla(repos, { ...base, componentes: [{ concepto: 'Tirador', articulo: { id: 'no-existe' }, cantidad: '1' }] }, yo)).toMatchObject({ ok: false, error: expect.stringContaining('no está en el catálogo') });
    expect(await guardarPlantilla(repos, { ...base, componentes: [{ concepto: 'Costados', articulo: { opcion: 'frentes' }, cantidad: '1' }] }, yo)).toMatchObject({ ok: false, error: expect.stringContaining('no existe') });
    expect(await guardarPlantilla(repos, { ...base, parametros: [{ ...plantilla.parametros[0]!, defecto: 900 }] }, yo)).toMatchObject({ ok: false, error: expect.stringContaining('entre 50 y 300') });
  });
});
