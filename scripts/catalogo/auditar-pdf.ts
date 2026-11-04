import { readFile } from 'node:fs/promises';
import { getDocument } from 'pdfjs-dist/legacy/build/pdf.mjs';
import { extraerVariantesTablero, reconstruirFilas, sugerirMaterialesLocales } from '../../src/panel-nuevo/filas-pdf.ts';
import { candidatosConfigurablesColomba } from '../../src/server/catalogo/configurables-colomba.ts';

type Informe={archivo:string;paginas:number;variantes:number;configurables:number;candidatosLocales:number;porPagina:Array<{pagina:number;variantes:number;configurables:number}>};

async function auditar(ruta:string):Promise<Informe>{
  const bytes=new Uint8Array(await readFile(ruta));
  const tarea=getDocument({data:bytes,useWorkerFetch:false});
  const doc=await tarea.promise;
  const informe:Informe={archivo:ruta,paginas:doc.numPages,variantes:0,configurables:0,candidatosLocales:0,porPagina:[]};
  for(let numero=1;numero<=doc.numPages;numero++){
    const pagina=await doc.getPage(numero);const contenido=await pagina.getTextContent();
    const items=contenido.items.filter((x):x is typeof x&{str:string;transform:number[];width?:number}=>'str' in x&&'transform' in x);
    const texto=reconstruirFilas(items);const variantes=extraerVariantesTablero(items,numero);
    const configurables=candidatosConfigurablesColomba(texto,numero);
    informe.variantes+=variantes.length;informe.configurables+=configurables.length;
    informe.candidatosLocales+=sugerirMaterialesLocales([{pagina:numero,texto}]).length;
    if(variantes.length||configurables.length)informe.porPagina.push({pagina:numero,variantes:variantes.length,configurables:configurables.length});
    pagina.cleanup();
  }
  await tarea.destroy();return informe;
}

const rutas=process.argv.slice(2);
if(!rutas.length)throw new Error('Uso: tsx scripts/catalogo/auditar-pdf.ts <catalogo.pdf> [...]');
console.log(JSON.stringify(await Promise.all(rutas.map(auditar)),null,2));
