import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import { aplicarMigraciones, crearRepositoriosD1, type Repositorios } from '../../src/server/data/index.ts';
import { gastoVacio } from '../../src/server/gastos/gastos.ts';
import { deRespuestaModelo, INSTRUCCIONES_TICKET, INSTRUCCIONES_TICKET_CARPINTERIA, instruccionesTicket } from '../../src/server/gastos/lector.ts';
import { proveedorPorGuardar } from '../../src/server/gastos/proveedor-del-ticket.ts';
import { cargarCliente } from '../../src/plataforma/cargar.ts';
import { proveedorVacio } from '../../src/server/proveedores/proveedores.ts';
import { d1DePrueba } from '../panel/d1.ts';

let repos: Repositorios;
let cerrar: () => Promise<void>;
beforeAll(async () => {
  const d = await d1DePrueba();
  cerrar = d.cerrar;
  await aplicarMigraciones(d.db);
  repos = crearRepositoriosD1(d.db);
});
afterAll(() => cerrar());
afterEach(() => vi.unstubAllEnvs());
const comoTuria = () => vi.stubEnv('CLIENTE_CONFIG', JSON.stringify(cargarCliente('turia')));

describe('tickets de la carpintería: el proveedor del ticket', () => {
  it('el vivero sigue con las instrucciones de siempre; la carpintería pide además el contacto del vendedor', () => {
    expect(instruccionesTicket()).toBe(INSTRUCCIONES_TICKET);
    expect(INSTRUCCIONES_TICKET).not.toMatch(/telefono|direccion/);
    comoTuria();
    expect(instruccionesTicket()).toBe(INSTRUCCIONES_TICKET_CARPINTERIA);
    expect(INSTRUCCIONES_TICKET_CARPINTERIA).toMatch(/de una carpintería en España[\s\S]*"telefono"[\s\S]*"categoria": una de/);
  });

  it('lee el contacto (solo lo que viene y con correo válido); sin contacto, la lectura es la de siempre', () => {
    const l = deRespuestaModelo({ proveedor: 'Tableros Levante SL', nif: 'b-12345678', total: '45,30', direccion: 'C/ Mayor 3', poblacion: 'Paterna', telefono: '961 23 45 67', email: 'no es correo' }, '2026-11-01');
    expect(l?.contactoProveedor).toEqual({ direccion: 'C/ Mayor 3', poblacion: 'Paterna', telefono: '961 23 45 67', email: '', web: '' });
    expect(deRespuestaModelo({ proveedor: 'Bar', total: 3 }, '2026-11-01')).not.toHaveProperty('contactoProveedor');
  });

  it('propone guardar la tienda como proveedor solo en la carpintería y si aún no lo es (por nombre o NIF)', async () => {
    const g = { ...gastoVacio('ana@example.com'), proveedor: 'Tableros Levante S.L.', nifProveedor: 'B12345674', contactoProveedor: { direccion: 'C/ Mayor 3', poblacion: 'Paterna', telefono: '961234567', email: 'hola@levante.es', web: '' } };
    expect(await proveedorPorGuardar(repos, g)).toBeNull();
    comoTuria();
    const p = await proveedorPorGuardar(repos, g);
    expect(p).toMatchObject({ nombre: 'Tableros Levante S.L.', poblacion: 'Paterna', telefono: '961234567', email: 'hola@levante.es' });
    await repos.proveedores.guardar({ ...proveedorVacio(), nombre: 'TABLEROS LEVANTE' }, 'ana@example.com');
    expect(await proveedorPorGuardar(repos, g)).toBeNull();
    expect(await proveedorPorGuardar(repos, { ...g, proveedor: '' })).toBeNull();
  });
});
