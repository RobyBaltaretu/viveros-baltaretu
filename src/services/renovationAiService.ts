import { InferenceClient } from '@huggingface/inference';
import type { RenovationConfig } from '../server/simulador/materiales.ts';
import { buildRenovationPrompt } from './promptBuilder.ts';

/** Solo Hugging Face: por decisión del propietario, ningún otro proveedor ni clave de IA. */
export interface RenovationAiOptions {
  hfToken?: string;
}

export interface RenovationAiResult {
  ok: boolean;
  afterImage?: string; // base64 data URL e.g. "data:image/png;base64,..."
  promptUsed?: string;
  provider?: string;
  error?: string;
}

/**
 * Modelos de edición de imagen («image-to-image») de Hugging Face, por orden.
 * Se llaman con la librería oficial (@huggingface/inference) a través de
 * router.huggingface.co: ella elige el proveedor que sirve cada modelo
 * (`provider: 'auto'`) y lo cobra, si hace falta, del saldo de la cuenta de
 * Hugging Face. La API antigua (api-inference.huggingface.co) ya no existe.
 */
export const MODELOS_HF = ['black-forest-labs/FLUX.1-Kontext-dev', 'Qwen/Qwen-Image-Edit'];

/** Mensaje claro para los errores de Hugging Face que tienen arreglo por parte del usuario. */
export function explicarErrorHf(mensaje: string): string | null {
  const m = mensaje.toLowerCase();
  if (m.includes('sufficient permissions') || m.includes('inference providers on behalf'))
    return 'Tu token de Hugging Face no tiene permiso para usar la IA. Crea uno nuevo en huggingface.co/settings/tokens de tipo «Fine-grained» y marca «Make calls to Inference Providers» (o usa un token de tipo «Read»), y pégalo en la configuración (⚙️).';
  if (m.includes('invalid') && (m.includes('token') || m.includes('credentials')) || m.includes('401') || m.includes('unauthorized'))
    return 'El token de Hugging Face no es válido: revísalo en la configuración (⚙️).';
  if (m.includes('402') || m.includes('credits') || m.includes('payment required') || m.includes('exceeded'))
    return 'Se ha acabado el saldo gratuito de este mes en Hugging Face. Vuelve a intentarlo cuando se renueve.';
  return null;
}

/**
 * Transformación fotorrealista de la foto del cliente con IA, solo con
 * Hugging Face. Sin token, o si ningún modelo responde, devuelve el error
 * explicado (nunca una imagen de relleno).
 */
export async function generateRenovationImage(imageBase64: string, config: RenovationConfig, options: RenovationAiOptions = {}): Promise<RenovationAiResult> {
  const prompt = buildRenovationPrompt(config);
  const hfToken = options.hfToken || (typeof process !== 'undefined' ? process.env.HF_TOKEN || process.env.VITE_HF_TOKEN : undefined);
  if (!hfToken) return { ok: false, error: 'No hay tokens o claves de IA configurados o activos. Introduce tu token gratuito de Hugging Face en la configuración (⚙️).' };

  const match = imageBase64.match(/^data:(image\/[a-zA-Z+.-]+);base64,(.+)$/);
  const mimeType = match?.[1] ?? 'image/jpeg';
  const bytes = Uint8Array.from(atob(match?.[2] ?? imageBase64), (c) => c.charCodeAt(0));
  const foto = new Blob([bytes], { type: mimeType });

  const cliente = new InferenceClient(hfToken);
  const errores: string[] = [];
  for (const model of MODELOS_HF) {
    try {
      console.log(`[RenovationAiService] Probando ${model} en Hugging Face...`);
      const resultado = await cliente.imageToImage({ provider: 'auto', model, inputs: foto, parameters: { prompt } });
      const b64 = btoa(Array.from(new Uint8Array(await resultado.arrayBuffer()), (b) => String.fromCharCode(b)).join(''));
      return { ok: true, afterImage: `data:${resultado.type || 'image/png'};base64,${b64}`, promptUsed: prompt, provider: `huggingface:${model}` };
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      console.warn(`[RenovationAiService] ${model}:`, msg);
      // Un problema del token o del saldo es igual para todos los modelos: se explica y no se sigue.
      const explicado = explicarErrorHf(msg);
      if (explicado) return { ok: false, error: explicado };
      errores.push(`${model}: ${msg.slice(0, 200)}`);
    }
  }
  return { ok: false, error: `Hugging Face no ha podido generar la imagen. ${errores.join(' | ')}` };
}
