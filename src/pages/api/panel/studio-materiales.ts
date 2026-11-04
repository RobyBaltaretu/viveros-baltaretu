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
  const paginaRaw=Number(url.searchParams.get('pagina')||'1');
  if(!Number.isSafeInteger(paginaRaw)||paginaRaw<1||paginaRaw>1000)return json(400,{ok:false,error:'Página inválida'});
  const tamano=40;
  const variantes:VarianteCatalogo[]=await sesion.repos.catalogo.variantes?.()??[];
  const articulos=await sesion.repos.catalogo.articulos();
  const disponibles=new Map(articulos.filter(a=>!a.archivado).map(a=>[a.id,a]));
  const filtradas=variantes.filter(v=>v.estado==='activo'&&disponibles.has(v.articuloId))
    .filter(v=>!q||[v.referencia,v.codigo,v.acabado,v.soporte,disponibles.get(v.articuloId)?.nombre||''].join(' ').toLocaleLowerCase('es').includes(q))
    .sort((a,b)=>(a.referencia||a.codigo||'').localeCompare(b.referencia||b.codigo||'','es'));
  const total=filtradas.length;
  const resultado=filtradas.slice((paginaRaw-1)*tamano,paginaRaw*tamano).map(v=>{
      const a=disponibles.get(v.articuloId)!;
      return {id:v.id,articuloId:a.id,nombre:a.nombre,referencia:v.referencia||a.referencia,
        acabado:v.acabado||a.acabado,soporte:v.soporte,espesorMm:v.dimensiones.espesorMm??a.espesor,
        colorHex:a.visual?.colorHex??null,textura:a.visual?.textura??null,veta:a.visual?.veta??null,
        disponibilidad:v.disponibilidad};
    });
  return json(200,{ok:true,variantes:resultado,pagina:paginaRaw,tamano,total,hayMas:paginaRaw*tamano<total});
};
