import type { RenovationConfig } from '../server/simulador/materiales.ts';
import { buildRenovationPrompt } from './promptBuilder.ts';

/**
 * Simulador de reformas con Gemini (solo en los clientes con `ia.simulador:
 * "gemini"`). La clave es el secreto `GEMINI_API_KEY` del Worker: nunca llega
 * del navegador. El tope mensual se controla antes, en la API (D1).
 */
export interface RenovationAiOptions {
  apiKey: string;
  modelo: string;
  /** Máscara opcional (PNG): blanco = lo que se cambia, negro = lo que se queda. */
  mascara?: string;
  fetch?: typeof fetch;
}

export interface RenovationAiResult {
  ok: boolean;
  afterImage?: string; // data URL, p. ej. "data:image/png;base64,..."
  promptUsed?: string;
  provider?: string;
  error?: string;
  /** Código HTTP de la respuesta del proveedor, si falló. */
  estado?: number;
}

export const URL_GEMINI = 'https://generativelanguage.googleapis.com/v1beta/models';

/** Mensajes para el usuario según el código de Gemini. */
export const ERRORES_GEMINI: Record<number, string> = {
  400: 'La IA no ha aceptado la foto o la petición. Prueba con otra foto (JPEG o WebP, sin recortes raros).',
  401: 'La clave de Gemini no es válida. Avisa a quien lleva el panel.',
  402: 'Límite del proveedor agotado.',
  403: 'La clave de Gemini no tiene permiso para este modelo. Avisa a quien lleva el panel.',
  404: 'El modelo de imágenes de Gemini configurado ya no existe. Avisa a quien lleva el panel.',
  429: 'Demasiadas peticiones simultáneas, espera un momento.',
};

const datos = (dataUrl: string) => {
  const m = dataUrl.match(/^data:(image\/[a-zA-Z+.-]+);base64,(.+)$/);
  return m ? { mimeType: m[1]!, data: m[2]! } : null;
};

/** El texto de la petición: el de la configuración y, con máscara, cómo leerla. */
export function promptGemini(config: RenovationConfig, conMascara: boolean): string {
  const base = buildRenovationPrompt(config);
  return conMascara
    ? `${base}\n\n4. MASK:\n- The second image is a black and white mask with the same size as the photo. Change ONLY the areas that are white in the mask. Leave every black area exactly as it is in the photo.\n- Return a single image with exactly the same framing, size and aspect ratio as the photo.`
    : `${base}\n\n- Return a single image with exactly the same framing, size and aspect ratio as the photo.`;
}

export async function generateRenovationImage(imageBase64: string, config: RenovationConfig, options: RenovationAiOptions): Promise<RenovationAiResult> {
  const foto = datos(imageBase64);
  if (!foto) return { ok: false, error: 'La foto no tiene un formato válido.' };
  const mascara = options.mascara ? datos(options.mascara) : null;
  if (options.mascara && !mascara) return { ok: false, error: 'La zona marcada no tiene un formato válido.' };
  const prompt = promptGemini(config, !!mascara);
  const pedir = options.fetch ?? fetch;

  let respuesta: Response;
  try {
    respuesta = await pedir(`${URL_GEMINI}/${encodeURIComponent(options.modelo)}:generateContent`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-goog-api-key': options.apiKey },
      body: JSON.stringify({
        contents: [{ role: 'user', parts: [{ text: prompt }, { inlineData: foto }, ...(mascara ? [{ inlineData: mascara }] : [])] }],
        generationConfig: { responseModalities: ['IMAGE'] },
      }),
    });
  } catch {
    return { ok: false, error: 'No se ha podido conectar con la IA. Revisa la conexión y vuelve a intentarlo.' };
  }

  if (!respuesta.ok) {
    const cuerpo = await respuesta.text().catch(() => '');
    console.warn(`[Simulador] Gemini ${respuesta.status}:`, cuerpo.slice(0, 300));
    // Google indica el cupo o el saldo agotado con 429 RESOURCE_EXHAUSTED: si habla de facturación, es el límite del proveedor.
    const sinSaldo = respuesta.status === 429 && /billing|prepay|credit|quota exceeded for/i.test(cuerpo);
    const mensaje = sinSaldo ? ERRORES_GEMINI[402]! : (ERRORES_GEMINI[respuesta.status] ?? 'La IA no ha podido generar la imagen. Vuelve a intentarlo en un rato.');
    return { ok: false, error: mensaje, estado: sinSaldo ? 402 : respuesta.status };
  }

  type Parte = { inlineData?: { mimeType?: string; data?: string }; inline_data?: { mime_type?: string; data?: string }; text?: string };
  const json = (await respuesta.json().catch(() => null)) as { candidates?: { content?: { parts?: Parte[] }; finishReason?: string }[]; promptFeedback?: { blockReason?: string } } | null;
  const partes = json?.candidates?.[0]?.content?.parts ?? [];
  for (const p of partes) {
    const d = p.inlineData?.data ?? p.inline_data?.data;
    if (d) return { ok: true, afterImage: `data:${p.inlineData?.mimeType ?? p.inline_data?.mime_type ?? 'image/png'};base64,${d}`, promptUsed: prompt, provider: `gemini:${options.modelo}` };
  }
  const bloqueo = json?.promptFeedback?.blockReason ?? json?.candidates?.[0]?.finishReason;
  return {
    ok: false,
    error: bloqueo && bloqueo !== 'STOP' ? 'La IA ha rechazado esta foto (sus filtros de seguridad). Prueba con otra foto de la estancia, sin personas.' : 'La IA no ha devuelto ninguna imagen. Vuelve a intentarlo.',
  };
}
