import type { APIRoute } from 'astro';
import { env } from 'cloudflare:workers';
import { clienteActual } from '../../../plataforma/actual.ts';
import { sesionCon } from '../../../server/panel/pagina.ts';
import { asegurarEsquema } from '../../../server/data/d1/migraciones.ts';
import { prepararDespiece } from '../../../server/simulador/despiece-studio.ts';
import { valorarDespiece } from '../../../server/simulador/valoracion-studio.ts';
import type { InterpretacionBoceto } from '../../../server/simulador/boceto.ts';
import type { BaseD1 } from '../../../server/data/d1/base.ts';
import { sentenciasStudio } from '../../../server/data/d1/studio.ts';
import { variantesStudio } from '../../../server/simulador/materiales-studio.ts';
export const prerender=false;
export const GET:APIRoute=async({locals,url})=>{
 if(clienteActual().id!=='turia')return new Response(null,{status:404});
 const sesion=sesionCon(locals,'editar');if(!sesion)return new Response(null,{status:403});
 const id=url.searchParams.get('id')||'';
 if(!/^studio_[a-f0-9-]{36}$/.test(id))return new Response(null,{status:400});
 const db=(env as unknown as {DB:BaseD1}).DB;
 await asegurarEsquema(db);
 const row=await sentenciasStudio(db).leerBoceto5()
  .bind(id,'turia').first<{revision:number;interpretacion:string}>();
 if(!row)return new Response(null,{status:404});
 const despiece=prepararDespiece(JSON.parse(row.interpretacion) as InterpretacionBoceto);
 const [articulos,variantes]=await Promise.all([sesion.repos.catalogo.articulos(),sesion.repos.catalogo.variantes?.()??Promise.resolve([])]);
 const valoracion=valorarDespiece(despiece,articulos,variantesStudio(articulos,variantes));
 return new Response(JSON.stringify({ok:true,revision:row.revision,despiece,valoracion}),{
  headers:{'Content-Type':'application/json','Cache-Control':'no-store'}
 });
};
