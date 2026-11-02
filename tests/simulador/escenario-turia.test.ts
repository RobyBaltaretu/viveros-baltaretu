import {expect,it,vi} from 'vitest';
import {d1DePrueba} from '../panel/d1';
import {aplicarMigraciones,crearRepositoriosD1} from '../../src/server/data';
import {cargarCliente} from '../../src/plataforma/cargar';
import {cargarDatosPrueba,quitarDatosPrueba} from '../../src/server/panel/pruebas';
it('el escenario de Turia tiene catálogo, ventas y pedidos relacionados y se puede limpiar',async()=>{
vi.stubEnv('CLIENTE_CONFIG',JSON.stringify(cargarCliente('turia')));
const d=await d1DePrueba();
try{await aplicarMigraciones(d.db);const r=crearRepositoriosD1(d.db);const resumen=await cargarDatosPrueba(r,'propietario@example.com','2026-11-02');expect(resumen.clientes).toBe(15);expect(resumen.facturas).toBe(41);expect(resumen.presupuestos).toBe(20);expect((await r.catalogo.articulos()).filter(a=>a.id.startsWith('prueba-studio-'))).toHaveLength(30);const pedidos=await r.pedidosProveedor.listar();expect(pedidos).toHaveLength(8);for(const p of pedidos){expect(await r.proveedores.obtener(p.proveedorId)).not.toBeNull();expect(await r.presupuestosCliente.obtener(p.presupuestoClienteId!)).not.toBeNull();}await quitarDatosPrueba(r,'propietario@example.com');expect(await r.pedidosProveedor.listar()).toHaveLength(0);expect((await r.catalogo.articulos()).filter(a=>a.id.startsWith('prueba-'))).toHaveLength(0);
}finally{await d.cerrar();vi.unstubAllEnvs();}
},120000);
