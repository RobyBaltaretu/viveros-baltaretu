import {expect,it} from 'vitest';
import { d1DePrueba } from '../panel/d1';
import { aplicarMigraciones, crearRepositoriosD1 } from '../../src/server/data';
import { imagenesPrivadas, type BucketPrivado } from '../../src/server/data/d1/imagenes-r2';

it('R2 conserva lecturas antiguas, protege la cuota concurrente y libera espacio al borrar', async()=>{
  const {db,cerrar}=await d1DePrueba();
  const objects=new Map<string,Uint8Array>();
  const bucket:BucketPrivado={async put(k,b){objects.set(k,b)},async get(k){const b=objects.get(k);return b?{arrayBuffer:async()=>new Uint8Array(b).buffer}:null},async delete(k){objects.delete(k)}};
  try{
    await aplicarMigraciones(db);
    const viejo=crearRepositoriosD1(db);
    const bytes=new Uint8Array([1,2,3]);
    await viejo.tickets.guardar({id:'antiguo',bytes,tipo:'image/jpeg'},'test');
    const nuevo=crearRepositoriosD1(db,bucket,true);
    expect((await nuevo.tickets.obtener('antiguo'))?.bytes).toEqual(bytes);
    await nuevo.portafolio.guardarSimulacion('demo','Borrador',bytes,bytes,'test');
    expect(objects.size).toBe(2);
    expect((await nuevo.adjuntos.obtener('demo-antes'))?.bytes).toEqual(bytes);
    await nuevo.adjuntos.borrarDe('portafolio','demo');
    expect(objects.size).toBe(0);
    const imagenes=imagenesPrivadas(db,bucket,4);
    const guardar=(ruta:string)=>imagenes.escribir([{bytes}],([k])=>[db.prepare('INSERT INTO fotos(ruta,tipo,bytes,tamano,subida,subida_por) VALUES (?, ?, ?, 3, ?, ?)').bind(ruta,'image/webp',k,'hoy','test')]);
    const resultados=await Promise.allSettled([guardar('a'),guardar('b')]);
    expect(resultados.filter(r=>r.status==='fulfilled')).toHaveLength(1);
    expect(objects.size).toBe(1);
  }finally{await cerrar()}
},30000);
