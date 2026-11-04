import type { APIRoute } from 'astro';
import { env } from 'cloudflare:workers';
import { clienteActual } from '../../../plataforma/actual.ts';
import { sesionCon } from '../../../server/panel/pagina.ts';
import { asegurarEsquema } from '../../../server/data/d1/migraciones.ts';
import { prepararDespiece } from '../../../server/simulador/despiece-studio.ts';
import type { InterpretacionBoceto } from '../../../server/simulador/boceto.ts';
import type { BaseD1 } from '../../../server/data/d1/base.ts';
export const prerender=false;
export const GET:APIRoute=async({locals,url})=>{
 if(clienteActual().id!=='turia')return new Response(null,{status:404});
 if(!sesionCon(locals,'editar'))return new Response(null,{status:403});
 const id=url.searchParams.get('id')||'';
 if(!/^studio_[a-f0-9-]{36}$/.test(id))return new Response(null,{status:400});
 const db=(env as unknown as {DB:BaseD1}).DB;
 await asegurarEsquema(db);
 const row=await db.prepare('SELECT revision,interpretacion FROM studio_bocetos WHERE id=? AND cliente_id=?')
  .bind(id,'turia').first<{revision:number;interpretacion:string}>();
 if(!row)return new Response(null,{status:404});
 return new Response(JSON.stringify({ok:true,revision:row.revision,despiece:prepararDespiece(JSON.parse(row.interpretacion) as InterpretacionBoceto)}),{
  headers:{'Content-Type':'application/json','Cache-Control':'no-store'}
 });
};
