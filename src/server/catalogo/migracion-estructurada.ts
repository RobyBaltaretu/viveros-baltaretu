import type { Repositorios } from '../data/tipos.ts';
import { claveNormalizada, normalizarDimensiones } from './modelo.ts';

const idDe=(texto:string)=>{
  let h=2166136261;for(const c of texto){h^=c.charCodeAt(0);h=Math.imul(h,16777619);}
  return 'legacy-'+(h>>>0).toString(36);
};

/**
 * Puente conservador: no modifica el artículo heredado. Crea familia y variante
 * pendientes y solo rescata de notas un formato inequívoco etiquetado como tal.
 */
export async function migrarArticulosEstructurados(repos:Repositorios,email:string):Promise<{familias:number;variantes:number;omitidos:number}> {
  if(!repos.catalogo.guardarFamilia||!repos.catalogo.guardarVariante)return {familias:0,variantes:0,omitidos:0};
  const [articulos,existentes]=await Promise.all([repos.catalogo.articulos({incluirArchivados:true}),repos.catalogo.variantes?.({incluirDescatalogadas:true})??Promise.resolve([])]);
  const vinculados=new Set(existentes.map(v=>v.articuloId));
  const familias=new Set<string>();let variantes=0,omitidos=0;
  for(const a of articulos){
    if(vinculados.has(a.id)){omitidos++;continue;}
    const formato=a.notas.match(/(?:^|;\s*)Formato:\s*([^;]+)/i)?.[1]?.trim()??'';
    const unidades=Number(a.notas.match(/(?:^|;\s*)Unidades por paquete:\s*(\d+)/i)?.[1]??'')||null;
    const nombreFamilia=a.nombre.replace(/\s+\d{3,4}\s*[x×]\s*\d{3,4}.*$/i,'').replace(/\s+\d+(?:[,.]\d+)?\s*mm.*$/i,'').trim()||a.nombre;
    const familiaId=idDe(claveNormalizada('familia',a.proveedor,nombreFamilia,a.categoria));
    const origen={proveedor:a.proveedor,documento:'Migración de catalogo_articulos',pagina:null,metodo:'migracion' as const,confianza:null,revision:'pendiente' as const,textoOriginal:a.notas};
    if(!familias.has(familiaId)){
      await repos.catalogo.guardarFamilia({id:familiaId,codigo:'',nombre:nombreFamilia,descripcion:'',categoria:a.categoria,subcategoria:'',tipo:'material',proveedor:a.proveedor,fabricante:a.visual?.fabricante??'',coleccion:a.visual?.coleccion??'',aplicaciones:a.visual?.reformas??a.visual?.uso??[],estado:'pendiente',origen},email);
      familias.add(familiaId);
    }
    const dimensiones=normalizarDimensiones(formato,a.espesor);
    await repos.catalogo.guardarVariante({id:idDe(claveNormalizada('variante',a.id)),familiaId,articuloId:a.id,referencia:a.referencia,codigo:'',codigoDecorativo:a.visual?.codigoDecor??'',soporte:a.visual?.soporte??'',dimensiones,acabado:a.acabado,tratamiento:'',calidad:'',propiedades:{},unidadCompra:a.unidad,unidadConsumo:a.unidad,unidadPresupuesto:a.unidad,unidadesPaquete:unidades,factorConversion:1,disponibilidad:'desconocida',estado:'pendiente',decorativoIds:[],origen},email);
    variantes++;
  }
  return {familias:familias.size,variantes,omitidos};
}
