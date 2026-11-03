import { getDocument, GlobalWorkerOptions, type PDFDocumentProxy } from 'pdfjs-dist';
import workerUrl from 'pdfjs-dist/build/pdf.worker.min.mjs?url';

// El Worker de PDF.js se sirve desde el propio build Turia (sin CDN).
GlobalWorkerOptions.workerSrc = workerUrl;
const MAX_PAGINAS = 160;
const MAX_BYTES = 8_000_000;
const TEXTO_PAGINA = 4000;
export type PaginaLocal = { pagina: number; texto: string; caracteres: number };

export interface DocumentoLocal {
  paginas: number;
  pagina(numero: number): Promise<PaginaLocal>;
  imagen(numero: number): Promise<string>;
  cerrar(): Promise<void>;
}

/** Ordena tokens por línea y posición; conserva números, referencias y unidades. */
export function reconstruirFilas(items: Array<{ str: string; transform: number[] }>): string {
  const lineas = new Map<number, Array<{ x: number; texto: string }>>();
  for (const item of items) {
    const texto = (item.str ?? '').replace(/\s+/g, ' ').trim();
    if (!texto) continue;
    const y = Math.round((item.transform?.[5] ?? 0) / 3);
    const fila = lineas.get(y) ?? [];
    fila.push({ x: item.transform?.[4] ?? 0, texto });
    lineas.set(y, fila);
  }
  return [...lineas.entries()].sort((a,b)=>b[0]-a[0]).map(([,fila]) =>
    fila.sort((a,b)=>a.x-b.x).map(x=>x.texto).join(' | ')
  ).join('\n').slice(0,TEXTO_PAGINA);
}
export async function abrirPDFLocal(file: File): Promise<DocumentoLocal> {
  if (file.size < 10 || file.size > MAX_BYTES || !file.name.toLowerCase().endsWith('.pdf'))
    throw new Error('El catálogo debe ser un PDF de hasta 8 MB.');
  const bytes = new Uint8Array(await file.arrayBuffer());
  if (String.fromCharCode(...bytes.slice(0,5)) !== '%PDF-')
    throw new Error('El archivo no contiene la firma de un PDF válido.');
  let doc: PDFDocumentProxy;
  try {
    doc = await getDocument({ data: bytes, isEvalSupported: false }).promise;
  } catch {
    throw new Error('No se ha podido abrir el PDF. Comprueba que no esté cifrado ni dañado.');
  }
  if (doc.numPages < 1 || doc.numPages > MAX_PAGINAS) {
    await doc.destroy();
    throw new Error('El límite es de 160 páginas por catálogo.');
  }
  return {
    paginas: doc.numPages,
    async pagina(numero: number) {
      if (!Number.isInteger(numero) || numero < 1 || numero > doc.numPages) throw new Error('Página no válida.');
      const page = await doc.getPage(numero);
      const content = await page.getTextContent();
      const items = content.items.filter((x): x is typeof x & { str: string; transform: number[] } =>
        'str' in x && 'transform' in x
      );
      const texto = reconstruirFilas(items);
      page.cleanup();
      return { pagina: numero, texto, caracteres: texto.length };
    },
    async imagen(numero: number) {
      if (!Number.isInteger(numero) || numero < 1 || numero > doc.numPages) throw new Error('Página no válida.');
      const page = await doc.getPage(numero);
      const vp0 = page.getViewport({scale:1});
      // Vista en baja resolución: una página cabrá en <1 MB para Groq Free.
      const viewport = page.getViewport({scale:Math.min(1.25,1000/Math.max(vp0.width,vp0.height))});
      const canvas = document.createElement('canvas');
      canvas.width=Math.ceil(viewport.width);canvas.height=Math.ceil(viewport.height);
      const ctx = canvas.getContext('2d');
      if(!ctx)throw new Error('No se puede procesar la imagen en este dispositivo.');
      await page.render({canvasContext:ctx,viewport,canvas}).promise;
      const imagen=canvas.toDataURL('image/jpeg',.65);
      canvas.width=0;canvas.height=0;page.cleanup();
      return imagen;
    },
    async cerrar() {await doc.destroy();}
  };
}
declare global {
  interface Window { gubiaPDF?: {abrirPDFLocal: typeof abrirPDFLocal}; }
}
window.gubiaPDF = {abrirPDFLocal};
window.dispatchEvent(new Event('gubia-pdf-listo'));
