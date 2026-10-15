import { describe, expect, it } from 'vitest';
import { calcularTotales, dinero, importeLinea, leerNumero } from '../../src/server/facturas/importes.ts';
import { nifValido } from '../../src/server/facturas/nif.ts';
import {
  AJUSTES_VACIOS,
  clienteVacio,
  codigoDe,
  faltaEmisor,
  huellaDe,
  ibanValido,
  leerBorrador,
  nuevaFactura,
  rectificativaDe,
  serieDe,
  validarEmision,
} from '../../src/server/facturas/facturas.ts';
import { pdfFactura } from '../../src/server/facturas/pdf.ts';

const linea = (cantidad: number, precio: number, iva = 10, descuento = 0) => ({ concepto: 'Olivo', cantidad, precio, descuento, iva });
const emisor = { ...AJUSTES_VACIOS, nombre: 'Viveros Prueba SL', nif: 'B12345674', direccion: 'Camino 1', codigoPostal: '46000', poblacion: 'Valencia', provincia: 'Valencia' };
const cliente = { ...clienteVacio('c1'), nombre: 'Jardinería Ejemplo SL', nif: 'A58818501', direccion: 'Calle 2', codigoPostal: '28001', poblacion: 'Madrid' };

describe('importes', () => {
  it('redondea cada línea a céntimos y desglosa el IVA por tipo', () => {
    expect(importeLinea(linea(3, 18.333))).toBe(55);
    expect(importeLinea(linea(10, 25, 10, 15))).toBe(212.5);
    const t = calcularTotales([linea(10, 25), linea(2, 9.99, 21)]);
    expect(t.desglose.map((d) => [d.iva, d.base, d.cuota])).toEqual([
      [21, 19.98, 4.2],
      [10, 250, 25],
    ]);
    expect(t).toMatchObject({ base: 269.98, cuotaIva: 29.2, cuotaRecargo: 0, total: 299.18 });
  });

  it('suma el recargo de equivalencia si el cliente lo tiene', () => {
    const t = calcularTotales([linea(1, 100), linea(1, 100, 21)], true);
    expect(t.cuotaRecargo).toBe(6.6);
    expect(t.total).toBe(237.6);
  });

  it('lee números escritos a la española', () => {
    expect(leerNumero('18,50')).toBe(18.5);
    expect(leerNumero('1.234,5')).toBe(1234.5);
    expect(leerNumero('1.234')).toBe(1234);
    expect(leerNumero('18.5')).toBe(18.5);
    expect(leerNumero('-2')).toBe(-2);
    expect(leerNumero('')).toBeNull();
    expect(leerNumero('doce')).toBeNaN();
    expect(dinero(1234.5)).toBe('1.234,50 €');
  });
});

describe('NIF e IBAN', () => {
  it('comprueba DNI, NIE y CIF', () => {
    for (const ok of ['12345678Z', 'X1234567L', 'B12345674', 'A58818501', 'ES-B12345674', 'Q2826000H']) expect(nifValido(ok), ok).toBe(true);
    for (const mal of ['12345678A', 'B12345675', 'X1234567A', '1234', '']) expect(nifValido(mal), mal).toBe(false);
  });

  it('comprueba el IBAN', () => {
    expect(ibanValido('ES91 2100 0418 4502 0005 1332')).toBe(true);
    expect(ibanValido('ES91 2100 0418 4502 0005 1333')).toBe(false);
  });
});

describe('facturas', () => {
  it('no deja emitir sin los datos de la empresa ni del cliente', () => {
    expect(faltaEmisor({ ...emisor, nif: '' }).map((e) => e.campo)).toEqual(['nif']);
    expect(faltaEmisor({ ...emisor, direccion: '[PLACEHOLDER]' }).map((e) => e.campo)).toEqual(['direccion']);
    const f = { ...nuevaFactura(cliente, 'g@example.com', AJUSTES_VACIOS), lineas: [linea(2, 30)] };
    f.totales = calcularTotales(f.lineas);
    expect(validarEmision(f, emisor, cliente, null)).toEqual([]);
    expect(validarEmision(f, emisor, { ...cliente, nif: '' }, null).map((e) => e.campo)).toEqual(['cliente.nif']);
    expect(validarEmision(f, emisor, cliente, '2999-01-01').map((e) => e.campo)).toEqual(['fecha']);
    const sinIva = { ...f, lineas: [linea(1, 10, 0)] };
    expect(validarEmision(sinIva, emisor, cliente, null).map((e) => e.campo)).toEqual(['exencion']);
  });

  it('lee el formulario del borrador, añade y quita líneas', () => {
    const previa = nuevaFactura(cliente, 'g@example.com', AJUSTES_VACIOS);
    const form = new FormData();
    form.set('lineas', '2');
    form.set('l0.concepto', 'Olivo en maceta');
    form.set('l0.cantidad', '10');
    form.set('l0.precio', '25,50');
    form.set('l0.descuento', '');
    form.set('l0.iva', '10');
    form.set('l1.concepto', 'Transporte');
    form.set('l1.cantidad', '1');
    form.set('l1.precio', 'mucho');
    form.set('l1.iva', '21');
    form.set('accion', 'agregar');
    const r = leerBorrador(form, previa, []);
    expect(r.errores.map((e) => e.campo)).toEqual(['l1.precio']);
    expect(r.factura.lineas).toHaveLength(3);
    expect(r.factura.lineas[0]).toEqual({ concepto: 'Olivo en maceta', cantidad: 10, precio: 25.5, descuento: 0, iva: 10 });
    form.set('accion', 'quitar:1');
    const q = leerBorrador(form, previa, []);
    expect(q.errores).toEqual([]);
    expect(q.factura.lineas.map((l) => l.concepto)).toEqual(['Olivo en maceta']);
    form.set('accion', 'planta');
    form.set('planta', 'olivo');
    const p = leerBorrador(form, previa, [{ slug: 'olivo', nombre: 'Olivo ornamental', precio: 40 }]);
    expect(p.factura.lineas.at(-1)).toMatchObject({ concepto: 'Olivo ornamental', precio: 40, iva: 10 });
  });

  it('numera por serie y año y encadena la huella', async () => {
    expect(codigoDe(serieDe('ordinaria', '2026-03-01'), 7)).toBe('F2026-0007');
    expect(serieDe('rectificativa', '2027-01-02')).toBe('R2027');
    const datos = { codigo: 'F2026-0001', fecha: '2026-03-01', total: 66, nifEmisor: 'B12345674', nifCliente: 'A58818501' };
    const a = await huellaDe(datos, null);
    expect(a).toMatch(/^[0-9a-f]{64}$/);
    expect(await huellaDe(datos, a)).not.toBe(a);
    expect(await huellaDe({ ...datos, total: 66.01 }, null)).not.toBe(a);
  });

  it('la rectificativa copia las líneas en negativo', () => {
    const f = { ...nuevaFactura(cliente, 'g@example.com', AJUSTES_VACIOS), codigo: 'F2026-0001', lineas: [linea(2, 30)] };
    const r = rectificativaDe(f, 'g@example.com', AJUSTES_VACIOS);
    expect(r).toMatchObject({ tipo: 'rectificativa', rectificaId: f.id, rectificaCodigo: 'F2026-0001' });
    expect(r.totales.total).toBe(-66);
  });

  it('genera un PDF', async () => {
    const f = {
      ...nuevaFactura(cliente, 'g@example.com', AJUSTES_VACIOS),
      estado: 'emitida' as const,
      codigo: 'F2026-0001',
      emisor,
      lineas: Array.from({ length: 40 }, (_, i) => linea(i + 1, 12.5 + i, i % 3 ? 10 : 21)).map((l, i) => ({ ...l, concepto: `Planta número ${i + 1} con un nombre bastante largo para partir la línea — “prueba”` })),
    };
    f.totales = calcularTotales(f.lineas);
    const bytes = await pdfFactura(f);
    expect(new TextDecoder().decode(bytes.slice(0, 5))).toBe('%PDF-');
    expect(bytes.length).toBeGreaterThan(2000);
  });
});
