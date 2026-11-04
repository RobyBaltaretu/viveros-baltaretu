import { identidadProveedor } from '../server/catalogo/identidad-proveedor';
import { asociarMuestraMaterial } from './asociar-muestras';
import { getDocument, GlobalWorkerOptions, type PDFDocumentProxy } from 'pdfjs-dist/legacy/build/pdf.mjs';
import workerUrl from 'pdfjs-dist/legacy/build/pdf.worker.min.mjs?url';

// Usar el build legacy para compatibilidad con Safari/iOS y navegadores sin APIs recientes.
// El Worker de PDF.js se sirve desde el propio build Turia (sin CDN).
GlobalWorkerOptions.workerSrc = workerUrl;
const MAX_PAGINAS = 160;
const MAX_BYTES = 25_000_000;
import {reconstruirFilas,sugerirMaterialesLocales,extraerVariantesTablero} from './filas-pdf';
import { candidatosConfigurablesColomba } from '../server/catalogo/configurables-colomba';
import {detectarPosicionesMuestras,construirMuestra,type MuestraPDF} from './muestras-pdf';
export type PaginaLocal = { pagina: number; texto: string; caracteres: number; variantes: Array<Record<string,unknown>>; muestras: MuestraPDF[]; errorTexto?: string };

export interface DocumentoLocal {
  paginas: number;
  pagina(numero: number): Promise<PaginaLocal>;
  imagen(numero: number): Promise<string>;
  cerrar(): Promise<void>;
}

export async function abrirPDFLocal(file: File): Promise<DocumentoLocal> {
  if (file.size < 10 || file.size > MAX_BYTES || !file.name.toLowerCase().endsWith('.pdf'))
    throw new Error('El catálogo debe ser un PDF de hasta 25 MB.');
  const bytes = new Uint8Array(await file.arrayBuffer());
  if (String.fromCharCode(...bytes.slice(0,5)) !== '%PDF-')
    throw new Error('El archivo no contiene la firma de un PDF válido.');
  const tarea = getDocument({ data: bytes });
  let doc: PDFDocumentProxy;
  try {
    doc = await tarea.promise;
  } catch {
    throw new Error('No se ha podido abrir el PDF. Comprueba que no esté cifrado ni dañado.');
  }
  if (doc.numPages < 1 || doc.numPages > MAX_PAGINAS) {
    await tarea.destroy();
    throw new Error('El límite es de 160 páginas por catálogo.');
  }
  return {
    paginas: doc.numPages,
    async pagina(numero: number) {
      if (!Number.isInteger(numero) || numero < 1 || numero > doc.numPages) throw new Error('Página no válida.');
      const page = await doc.getPage(numero);
      let texto = '';
      let errorTexto: string | undefined;
      let variantes: Array<Record<string,unknown>> = [];
      let muestras: MuestraPDF[] = [];
      try {
        // En Safari/iOS, los errores de un parser secundario no deben
        // invalidar el texto que PDF.js ya haya conseguido extraer.
        let content: Awaited<ReturnType<typeof page.getTextContent>> | null = null;
        try {
          content = await page.getTextContent();
        } catch (error) {
          const detalle = error instanceof Error ? error.message : String(error);
          console.warn('[Gubia PDF] getTextContent falló en página', numero, error);
          // Safari puede fallar al construir el resultado completo. Intentar
          // el lector incremental antes de recurrir a la imagen.
          try {
            const reader = page.streamTextContent().getReader();
            const items: Awaited<ReturnType<typeof page.getTextContent>>['items'] = [];
            try {
              while (true) {
                const chunk = await reader.read();
                if (chunk.done) break;
                if (chunk.value?.items) items.push(...chunk.value.items);
              }
            } finally {
              reader.releaseLock();
            }
            content = { items, styles: Object.create(null), lang: null };
          } catch (streamError) {
            errorTexto = 'PDF.js: ' + detalle + '; streaming: ' +
              (streamError instanceof Error ? streamError.message : String(streamError));
            console.warn('[Gubia PDF] También falló streamTextContent en página',numero,streamError);
          }
        }
        const items = (content?.items ?? []).filter((x): x is typeof x & { str: string; transform: number[] } =>
          'str' in x && 'transform' in x
        );
        try {
          texto = reconstruirFilas(items);
        } catch (error) {
          console.warn('[Gubia PDF] Reconstrucción de filas fallida, página',numero,error);
          texto = items.map(item => item.str).filter(Boolean).join(' ');
        }
        try {
          variantes = extraerVariantesTablero(items,numero);
        } catch (error) {
          console.warn('[Gubia PDF] Matriz no disponible, página',numero,error);
        }
        try {
          variantes.push(...candidatosConfigurablesColomba(texto,numero));
        } catch (error) {
          console.warn('[Gubia PDF] Configurables no disponibles, página',numero,error);
        }
        try {
          const posiciones = detectarPosicionesMuestras(items);
          if(posiciones.length){
            const vp0=page.getViewport({scale:1});
            const escala=Math.min(1.4,1200/Math.max(vp0.width,vp0.height));
            const vp=page.getViewport({scale:escala});
            const lienzo=document.createElement('canvas');
            lienzo.width=Math.ceil(vp.width);lienzo.height=Math.ceil(vp.height);
            try{
              const ctx=lienzo.getContext('2d',{willReadFrequently:true});
              if(ctx){
                await page.render({canvasContext:ctx,viewport:vp,canvas:lienzo}).promise;
                for(const posicion of posiciones){
                  const m=construirMuestra(ctx,posicion,escala,vp0.height,numero);
                  if(m)muestras.push(m);
                }
              }
            }finally{lienzo.width=0;lienzo.height=0;}
          }
        }catch(error){
          console.warn('[Gubia PDF] Muestras no disponibles, página',numero,error);
        }
      } finally {
        page.cleanup();
      }
      return { pagina: numero, texto, caracteres: texto.length, variantes, muestras, errorTexto };
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
    async cerrar() {await tarea.destroy();}
  };
}
declare global {
  interface Window { gubiaPDF?: {identidadProveedor: typeof identidadProveedor; abrirPDFLocal: typeof abrirPDFLocal; sugerirMaterialesLocales: typeof sugerirMaterialesLocales; asociarMuestraMaterial: typeof asociarMuestraMaterial}; }
}
window.gubiaPDF = {identidadProveedor,abrirPDFLocal,sugerirMaterialesLocales,asociarMuestraMaterial};
window.dispatchEvent(new Event('gubia-pdf-listo'));
