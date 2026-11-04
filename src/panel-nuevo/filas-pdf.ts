/** Ordena tokens por línea y posición; conserva números, referencias y unidades. */
export function reconstruirFilas(items: Array<{ str: string; transform: number[]; width?: number }>): string {
  const lineas = new Map<number, Array<{ x: number; texto: string }>>();
  for (const item of items) {
    const texto = (item.str ?? '').replace(/\s+/g, ' ').trim();
    if (!texto) continue;
    const y = Math.round((item.transform?.[5] ?? 0) / 3);
    const fila = lineas.get(y) ?? [];
    fila.push({ x: item.transform?.[4] ?? 0, texto });
    lineas.set(y, fila);
  }
  // Cartas con referencias numéricas sobre nombres centrados. La coordenada horizontal
  // evita asociar el acabado de una columna al código de la siguiente.
  const centros = items.filter(t => t.str.trim()).map(t => ({
    str:t.str.trim(), y:t.transform[5], x:t.transform[4]+(t.width || 0)/2
  }));
  const nombres = centros.filter(t => /^[\p{L}][\p{L} .'-]{2,60}$/u.test(t.str));
  const muestras = centros.filter(t => /^\d{4}$/.test(t.str)).flatMap(t => {
    const debajo = nombres.filter(n => t.y-n.y >= 5 && t.y-n.y <= 13 && Math.abs(n.x-t.x)<12);
    return debajo.length===1 ? ['MUESTRA '+t.str+' '+debajo[0].str] : [];
  });
  return [...lineas.entries()].sort((a,b)=>b[0]-a[0]).map(([,fila]) =>
    fila.sort((a,b)=>a.x-b.x).map(x=>x.texto).join(' | ')
  ).concat(muestras).join('\n');
}
/**
 * Respaldo determinista si Groq no está disponible. Solo propone referencias
 * que aparecen junto a una familia de material; nunca inventa precios.
 * Esas fichas deben revisarse manualmente antes de guardarlas.
 */
export function sugerirMaterialesLocales(paginas: Array<{pagina:number;texto:string}>): Array<Record<string,unknown>> {
  const claves: Array<[RegExp,string,string]> = [
    [/\b(melaminas?|tableros?|aglomerados?|mdf)\b/i,'tableros','m²'],
    [/\b(contrachapad[oa]s?|plywood)\b/i,'tableros','m²'],
    [/\b(hpl|laminados?|compactos?)\b/i,'acabados','m²'],
    [/\b(enchapados?|chapas?)\b/i,'chapas','m²'],
    [/\b(cantos?|tapacantos?)\b/i,'cantos','ml'],
    [/\b(encimeras?|porcelanic[oa]|cuarzo)\b/i,'encimeras','m²'],
    [/\b(maderas?|roble|nogal|haya|pino|fresno)\b/i,'macizos','m³'],
    [/\b(bisagras?|correderas?|tiradores?|herrajes?)\b/i,'herrajes','ud'],
  ];
  const vistos=new Set<string>();
  const salida:Array<Record<string,unknown>>=[];
  for(const p of paginas) {
    const lineas=p.texto.split('\n');
    const cabecera = lineas.slice(0, 3).join(' ');
    if (/DESCRIPCI[ÓO]N DE CALIDADES|CLASIFICACI[ÓO]N DE CALIDAD/i.test(p.texto.slice(0,350))) continue;
    const familia = claves.find(([re]) => re.test(cabecera.replace(/CATÁLOGO DE (TABLERO|MADERA)/gi,'')));
    function propuesta(nombre:string, referencia:string, acabado:string, tipo:[RegExp,string,string]) {
      salida.push({categoria:tipo[1], nombre:nombre.trim().slice(0,120), referencia, codigoDecor:referencia, acabado,
        soporte:'',espesorMm:null,formato:'',unidad:tipo[2],colorHex:null,veta:null,brillo:null,pagina:p.pagina});
    }
    if (familia) for (const fila of lineas) {
      for (const celda of fila.split(/\s+\|\s+/)) {
        const decor = celda.trim().match(/^([A-Z]?\d{3,6})\s+([A-Z]{2,4})\s+([\p{L}][\p{L} .'-]{1,65})$/u);
        if (decor) propuesta(decor[3], decor[1], decor[2], familia);
        const muestra = celda.match(/^MUESTRA (\d{4}) (.+)$/);
        if (muestra) propuesta(muestra[2], muestra[1], '', familia);
      }
    }
    for(let i=0;i<lineas.length;i++){
      const linea=lineas[i].replace(/\s*\|\s*/g,' ').replace(/\s+/g,' ').trim();
      if(linea.length<10||linea.length>180)continue;
      const tipo=claves.find(([re])=>re.test(linea));
      if(!tipo)continue;
      // No interpretar una mera mención editorial como un artículo:
      // es necesario un código alfanumérico explícito o formato en mm.
      const codigos=linea.match(/\b(?=[A-Z0-9-]{4,}\b)(?=[A-Z0-9-]*\d)[A-Z][A-Z0-9-]{3,}\b/g);
      const formato=linea.match(/\b\d{3,4}\s*[x×]\s*\d{3,4}\s*(?:mm)?\b/i);
      const tecnico = /FORMATOS?\s*\(mm\)/i.test(lineas[i+1] || '') && !linea.includes('CATÁLOGO');
      if(!codigos?.length&&!formato&&!tecnico)continue;
      const referencia=(codigos?.find(x=>!['HPL','MDF'].includes(x))??(tecnico ? linea.match(/\b\d{4}\b/)?.[0] : '')??'').slice(0,60);
      const nombre=linea.slice(0,120);
      const key=p.pagina+'|'+referencia+'|'+nombre;
      if(vistos.has(key))continue;
      vistos.add(key);
      const mm=linea.match(/\b(?:espesor|grosor|esp\.?)\s*:?\s*(\d{1,3}(?:[,.]\d+)?)\s*mm\b/i);
      salida.push({
        categoria:tipo[1],nombre,referencia,codigoDecor:'',acabado:tecnico ? (linea.match(/\b[A-Z]{2,3}\/[A-Z]{2,3}\b/)?.[0] || '') : '',
        soporte:tecnico ? (linea.match(/\b(?:MDF|aglomerado|contrachapado)\b/i)?.[0] || '') : '',
        espesorMm:mm?Number(mm[1].replace(',','.')):null,
        formato:formato?.[0]??'',unidad:tipo[2],colorHex:null,veta:null,brillo:null,pagina:p.pagina,
      });

    }
  }
  return salida;
}



/**
 * Extrae variantes REALES de matrices técnicas. Una columna es un espesor
 * y una fila un formato; los números del cruce son Uds/paq (NO espesores).
 * Se usan las coordenadas PDF.js para conservar las celdas vacías de la tabla.
 * En una celda vacía no se crea artículo.
 */
export function extraerVariantesTablero(items: Array<{str:string;transform:number[];width?:number}>, pagina:number): Array<Record<string,unknown>> {
  type Celda = {x:number;y:number;texto:string;ancho:number};
  const lineas = new Map<number,Celda[]>();
  for (const item of items) {
    const texto = item.str?.replace(/\s+/g,' ').trim();
    if (!texto || !item.transform) continue;
    const y = item.transform[5], x = item.transform[4];
    const key = Math.round(y/3);
    const linea = lineas.get(key) || [];
    linea.push({x,y,texto,ancho:item.width || 0});
    lineas.set(key,linea);
  }
  const filas = [...lineas.values()].map(c=>c.sort((a,b)=>a.x-b.x))
    .sort((a,b)=>b[0].y-a[0].y);
  const texto = (fila:Celda[]) => fila.map(c=>c.texto).join(' ').replace(/\s+/g,' ').trim();
  const expresionFormato = /\b(\d{3,4})\s*[x×]\s*(\d{3,4})\b/i;
  const titulos = /\b(?:CONTRACHAPADO|AGLOMERADO|MELAMINA|TABLERO|MDF|HDF|OSB|ALISTONADO|NOVOLAC|SUPERLAC|VIROC|TRICAPA|PANEL SANDWICH)\b/i;
  const salida: Array<Record<string,unknown>> = [];
  const vistos = new Set<string>();
  for (let i=0;i<filas.length;i++) {
    const header = filas[i], cabecera = texto(header);
    if (!/\b(?:ESPESOR|GRUESO)\s*(?:\(?mm\)?)?/i.test(cabecera) || !/\bFORMATOS?\b/i.test(cabecera)) continue;
    const titulo = filas.slice(Math.max(0,i-5),i).reverse()
      .filter(f=>header[0].y-f[0].y < 0 || f[0].y-header[0].y < 105)
      .map(texto).find(t=>titulos.test(t) && !/CATÁLOGO|CARACTERÍSTICAS|APLICACIONES|FORMATOS|ESPESOR/i.test(t));
    if (!titulo) continue;
    const marca = header.find(c=>/\b(?:ESPESOR|GRUESO)\b/i.test(c.texto));
    if (!marca) continue;
    const umbral = marca.x + Math.max(30,marca.ancho * .8);
    const espesores = header.flatMap(c => {
      if (c.x < umbral || !/^\d{1,3}(?:[,.]\d+)?$/.test(c.texto)) return [];
      const valor = Number(c.texto.replace(',','.'));
      return valor>0 && valor<=150 ? [{x:c.x+c.ancho/2,valor}] : [];
    });
    if (!espesores.length) continue;
    const cod = titulo.match(/\b([A-Z]\d{3,5}|K\d{3,5}|\d{4}\s+(?=[A-Z]{2,4}\b))\b/);
    const decor = cod?.[1]?.trim() || '';
    const calidades = titulo.match(/\b(?:[ABCD+]{1,3}\/[ABCD+]{1,3}|C[123]|MA\/SC|PE\/SM)\b/g) || [];
    const acabado = calidades.join(' ').slice(0,80);
    const soporte = titulo.replace(/\b(?:[ABCD+]{1,3}\/[ABCD+]{1,3}|C[123]|MA\/SC|PE\/SM)\b/g,'')
      .replace(/\b(?:[A-Z]\d{3,5}|K\d{3,5})\b/g,'').replace(/\s+/g,' ').trim().slice(0,100);
    const nombreBase = titulo.replace(/\s+/g,' ').trim();
    // Solo los renglones consecutivos de ESTA tabla, hasta otro título o cabecera.
    for (let j=i+1;j<filas.length;j++) {
      const fila = filas[j], linea = texto(fila);
      if (header[0].y-fila[0].y > 95 || /\b(?:ESPESOR|GRUESO)\b.*\b\d{1,3}\b/i.test(linea)) break;
      const formato = linea.match(expresionFormato);
      if (!formato) {
        if (j>i+1 && titulos.test(linea) && !/Uds\/paq/i.test(linea)) break;
        continue;
      }
      const formatoNormal = formato[1]+' x '+formato[2]+' mm';
      // Los valores solo se aceptan si quedan centrados bajo una cabecera.
      const valores = fila.filter(c=>c.x>=umbral && /^(?:\d{1,3}|[xX])$/.test(c.texto));
      for (const esp of espesores) {
        const cell = valores.find(c=>Math.abs((c.x+c.ancho/2)-esp.x) <= 9);
        if (!cell) continue;
        const unidadesPaquete = /^\d+$/.test(cell.texto) ? Number(cell.texto) : null;
        if (unidadesPaquete !== null && unidadesPaquete<=0) continue;
        const nombre = (nombreBase+' '+formato[1]+'x'+formato[2]+' '+esp.valor+'mm').slice(0,120);
        const clave = [nombreBase,formatoNormal,esp.valor].join('|');
        if (vistos.has(clave)) continue;
        vistos.add(clave);
        salida.push({
          categoria:'tableros',nombre,referencia:decor,codigoDecor:decor,acabado,soporte,
          espesorMm:esp.valor,formato:formatoNormal,unidad:'m²',
          colorHex:null,veta:null,brillo:null,pagina,unidadesPaquete,
        });
      }
    }
  }
  return [...salida,...extraerDecorativosDeMatriz(filas,pagina),...extraerCompactosDeTabla(filas,pagina)];
}


type FilaPosicion = Array<{x:number;y:number;texto:string;ancho:number}>;
const leerFila = (fila:FilaPosicion) => fila.map(x=>x.texto).join(' ').replace(/\s+/g,' ').trim();

/** Matrices de melamina: X en celda = espesor disponible para un decor y un formato. */
function extraerDecorativosDeMatriz(filas:FilaPosicion[],pagina:number): Array<Record<string,unknown>> {
  const resultado:Array<Record<string,unknown>>=[];
  for(let i=1;i<filas.length;i++){
    const cabecera=leerFila(filas[i]);
    if(!/\bESPESOR\b/i.test(cabecera)||!/\bmm\b/i.test(cabecera))continue;
    const anterior=filas[i-1];
    if(!/\bFORMATO\b/i.test(leerFila(anterior)))continue;
    const grupos=anterior.flatMap(c=>{
      const m=c.texto.match(/\b(\d{3,4})\s*[x×]\s*(\d{3,4})\b/i);
      return m?[{x:c.x,formato:m[1]+' x '+m[2]+' mm'}]:[];
    }).sort((a,b)=>a.x-b.x);
    if(grupos.length<1)continue;
    const espesores=filas[i].flatMap(c=>/^\d{1,3}$/.test(c.texto)&&Number(c.texto)>0&&c.x>180
      ?[{x:c.x+c.ancho/2,mm:Number(c.texto)}]:[]);
    if(!espesores.length)continue;
    // Los formatos están centrados en el grupo; cada grupo comienza un poco
    // antes del rótulo. Para el primero se admite desde el inicio del cuadro.
    const formatoDe=(x:number)=>{
      let elegido=grupos[0].formato;
      for(let g=1;g<grupos.length;g++)if(x>=grupos[g].x-16)elegido=grupos[g].formato;
      return elegido;
    };
    for(let j=i+1;j<filas.length;j++){
      const fila=filas[j];
      if(filas[i][0].y-fila[0].y>730)break;
      const contenido=leerFila(fila);
      if(/\b(?:CATÁLOGO|MELAMINA SOBRE|CONSULTE|CARACTERÍSTICAS)\b/i.test(contenido))break;
      const primera=fila.filter(c=>c.x<195);
      const datos=leerFila(primera);
      const decor=datos.match(/^([A-Z]?\d{3,5}|K\d{3,5}|F\d{3,5}|M\d{3,5})\s+([A-Z]{2,4})\s+(.+)$/);
      if(!decor)continue;
      const [ ,referencia,acabado,designacion ]=decor;
      if(designacion.length>75)continue;
      const marcas=fila.filter(c=>c.x>=195&&/^[xX]$/.test(c.texto));
      for(const mark of marcas){
        const grosor=espesores.find(e=>Math.abs(e.x-(mark.x+mark.ancho/2))<8);
        if(!grosor)continue;
        const formato=formatoDe(grosor.x);
        resultado.push({
          categoria:'tableros',
          nombre:('AGLOMERADO MELAMINA '+designacion+' '+formato+' '+grosor.mm+'mm').slice(0,120),
          referencia,codigoDecor:referencia,acabado,soporte:'AGLOMERADO MELAMINA',
          espesorMm:grosor.mm,formato,unidad:'m²',colorHex:null,veta:null,brillo:null,
          unidadesPaquete:null,pagina,
        });
      }
    }
  }
  return resultado;
}

/** Filas de diseño, acabado, núcleo, formato y espesor (compacto de cocina/baño). */
function extraerCompactosDeTabla(filas:FilaPosicion[],pagina:number): Array<Record<string,unknown>> {
  const salida:Array<Record<string,unknown>>=[];
  let indice=-1;
  for(let i=0;i<filas.length;i++){
    const s=leerFila(filas[i]);
    if(/\bDISEÑO\b.*\bACABADO\b.*\bNÚCLEO\b.*\bFORMATO\b.*\bESPESOR\b/i.test(s)){indice=i;break;}
  }
  if(indice<0)return salida;
  for(const fila of filas.slice(indice+1)){
    const code=fila.find(c=>c.x<140&&/^\d{4}$/.test(c.texto));
    const format=fila.find(c=>/\b\d{4}\s*[x×]\s*\d{4}\b/.test(c.texto));
    const thickness=fila.find(c=>c.x>(format?.x??Infinity)&&/^\d{1,3}$/.test(c.texto));
    if(!code||!format||!thickness)continue;
    const acabado=fila.find(c=>c.x>code.x&&c.x<format.x&&/^[A-Z]{2,3}$/.test(c.texto));
    if(!acabado)continue;
    const nombre=fila.filter(c=>c.x>code.x&&c.x<acabado.x).map(c=>c.texto).join(' ').trim();
    const nucleo=fila.filter(c=>c.x>acabado.x&&c.x<format.x).map(c=>c.texto).join(' ').trim();
    if(!nombre||!nucleo)continue;
    const dimensiones=format.texto.match(/(\d{4})\s*[x×]\s*(\d{4})/)!;
    const formato=dimensiones[1]+' x '+dimensiones[2]+' mm';
    const mm=Number(thickness.texto);
    salida.push({categoria:'tableros',nombre:('COMPACTO '+nombre+' '+formato+' '+mm+'mm').slice(0,120),
      referencia:code.texto,codigoDecor:code.texto,acabado:acabado.texto,soporte:'COMPACTO · Núcleo '+nucleo,
      espesorMm:mm,formato,unidad:'m²',colorHex:null,veta:null,brillo:null,
      unidadesPaquete:null,pagina});
  }
  return salida;
}
