import { afterEach, describe, expect, it, vi } from 'vitest';
import { cargarCliente } from '../../src/plataforma/cargar.ts';
import { rutaDisponible } from '../../src/plataforma/actual.ts';
import { mismoOrigen } from '../../src/server/panel/acceso.ts';
import { sesionCon } from '../../src/server/panel/pagina.ts';

const situarTuria = () => vi.stubEnv('CLIENTE_CONFIG', JSON.stringify(cargarCliente('turia')));
afterEach(() => vi.unstubAllEnvs());

describe('Pentest simulado Turia: limites de sector y autorización', () => {
  it('niega rutas publicas, del vivero y de exportacion aunque se conozca la URL', () => {
    situarTuria();
    for (const ruta of [
      '/api/presupuesto', '/api/contenido/exportacion', '/api/contenido/importacion',
      '/panel/plantas', '/panel/inventario', '/api/panel/foto',
    ]) expect(rutaDisponible(ruta), ruta).toBe(false);
    for (const ruta of ['/panel/catalogo', '/api/panel/catalogo-muestra', '/api/panel/catalogo-importar'])
      expect(rutaDisponible(ruta), ruta).toBe(true);
  });

  it('rechaza CSRF con Origin externo, ausente o Fetch-Site cruzado', () => {
    const target = 'https://turia.example.test/api/panel/catalogo-importar';
    const post = (headers: Record<string,string>) => new Request(target, { method:'POST', headers });
    expect(mismoOrigen(post({Origin:'https://atacante.example.test'}))).toBe(false);
    expect(mismoOrigen(post({'Sec-Fetch-Site':'cross-site'}))).toBe(false);
    expect(mismoOrigen(post({}))).toBe(false);
    expect(mismoOrigen(post({Origin:'https://turia.example.test'}))).toBe(true);
  });

  it('niega consultar facturas sin rol valido aunque se fuerce la API', () => {
    const editor = { estado:'ok', usuario:{ rol:'editor', email:'editor@example.test' } };
    const gerente = { estado:'ok', usuario:{ rol:'gerente', email:'gerente@example.test' } };
    expect(sesionCon({panel:editor} as never, 'facturas')).toBeNull();
    expect(sesionCon({panel:gerente} as never, 'facturas')).not.toBeNull();
    expect(sesionCon({panel:{estado:'sin-acceso'}} as never, 'facturas')).toBeNull();
  });
});
