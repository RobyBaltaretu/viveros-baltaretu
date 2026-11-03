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
        categoria:tipo[1],nombre,referencia,codigoDecor:'',acabado:'',soporte:'',
        espesorMm:mm?Number(mm[1].replace(',','.')):null,
        formato:formato?.[0]??'',unidad:tipo[2],colorHex:null,veta:null,brillo:null,pagina:p.pagina,
      });

    }
  }
  return salida;
}

