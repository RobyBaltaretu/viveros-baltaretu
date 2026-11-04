import { describe,it,expect } from 'vitest';
import { MIGRACIONES } from '../../src/server/data/d1/migraciones.ts';
describe('Studio concurrent render protection',()=>{
 it('enforces at most one active render per tenant, sketch and revision',()=>{
   const m=MIGRACIONES.find(x=>x.version===19);
   expect(m).toBeDefined();
   const sql=m!.sql.join(' ');
   expect(sql).toContain('CREATE UNIQUE INDEX studio_generaciones_activa');
   expect(sql).toContain('cliente_id,boceto_id,revision');
   expect(sql).toContain("'pendiente','procesando'");
 });
});
