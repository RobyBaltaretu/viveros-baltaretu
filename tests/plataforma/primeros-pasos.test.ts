import { describe, expect, it } from 'vitest';
import { primerosPasos } from '../../src/panel-nuevo/inicio.ts';

const todo = { facturas: true, presupuestos: true, gastos: true, catalogo: true };
describe('inicio: primeros pasos para el primer día', () => {
  it('cuenta vacía: cinco pasos en orden, ninguno hecho', () => {
    const p = primerosPasos({ faltanDatosEmpresa: true, clientes: 0, articulos: 0, presupuestos: 0, gastos: 0, ver: todo });
    expect(p.map((x) => x.id)).toEqual(['empresa', 'cliente', 'catalogo', 'presupuesto', 'ticket']);
    expect(p.every((x) => !x.hecho && x.href.startsWith('/panel/'))).toBe(true);
  });
  it('marca lo que ya está hecho', () => {
    const p = primerosPasos({ faltanDatosEmpresa: false, clientes: 3, articulos: 0, presupuestos: 0, gastos: 1, ver: todo });
    expect(p.filter((x) => x.hecho).map((x) => x.id)).toEqual(['empresa', 'cliente', 'ticket']);
  });
  it('no enseña pasos de secciones que el rol no ve', () => {
    const p = primerosPasos({ faltanDatosEmpresa: true, clientes: 0, articulos: 0, presupuestos: 0, gastos: 0, ver: { facturas: false, presupuestos: false, gastos: true, catalogo: false } });
    expect(p.map((x) => x.id)).toEqual(['ticket']);
  });
});
