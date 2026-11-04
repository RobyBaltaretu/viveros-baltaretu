import type { APIRoute } from 'astro';
import { clienteActual } from '../../../plataforma/actual.ts';
import { sesionCon } from '../../../server/panel/pagina.ts';
import type { VarianteCatalogo } from '../../../server/data/tipos.ts';
export const prerender=false;
const json=(status:number,value:unknown)=>new Response(JSON.stringify(value),{status,headers:{'Content-Type':'application/json','Cache-Control':'no-store'}});
export const GET:APIRoute=async({locals,url})=>{
  if(clienteActual().id!=='turia')return json(404,{ok:false});
  const sesion=sesionCon(locals,'editar');if(!sesion)return json(403,{ok:false});
  const q=(url.searchParams.get('q')||'').trim().toLocaleLowerCase('es').slice(0,80);
  const variantes:VarianteCatalogo[]=await sesion.repos.catalogo.variantes?.()??[];
  const articulos=await sesion.repos.catalogo.articulos();
  const disponibles=new Map(articulos.filter(a=>!a.archivado).map(a=>[a.id,a]));
  const resultado=variantes.filter(v=>v.estado==='activo'&&disponibles.has(v.articuloId))
    .filter(v=>!q||[v.referencia,v.codigo,v.acabado,v.soporte,disponibles.get(v.articuloId)?.nombre||''].join(' ').toLocaleLowerCase('es').includes(q))
    .slice(0,80).map(v=>{
      const a=disponibles.get(v.articuloId)!;
      return {id:v.id,articuloId:a.id,nombre:a.nombre,referencia:v.referencia||a.referencia,
        acabado:v.acabado||a.acabado,soporte:v.soporte,espesorMm:v.dimensiones.espesorMm??a.espesor,
        colorHex:a.visual?.colorHex??null,textura:a.visual?.textura??null,veta:a.visual?.veta??null,
        disponibilidad:v.disponibilidad};
    });
  return json(200,{ok:true,variantes:resultado});
};
