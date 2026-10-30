import type { RenovationConfig } from '../server/simulador/materiales.ts';
import { buildRenovationPrompt } from './promptBuilder.ts';

/** Solo Hugging Face (gratuito): por decisión del propietario, ningún proveedor de IA de pago. */
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
 * Service Layer para la transformación fotorrealista de imágenes mediante IA.
 * Solo Hugging Face (Router / Inference API, gratuito). Sin proveedores de pago.
 */
export async function generateRenovationImage(
  imageBase64: string,
  config: RenovationConfig,
  options: RenovationAiOptions = {}
): Promise<RenovationAiResult> {
  const prompt = buildRenovationPrompt(config);

  console.log('[RenovationAiService] Iniciando transformación de imagen...');
  console.log('[RenovationAiService] Prompt generado:', prompt);

  // Extraer cadena limpia base64 y tipo MIME
  let mimeType = 'image/jpeg';
  let cleanBase64 = imageBase64;

  if (imageBase64.startsWith('data:')) {
    const match = imageBase64.match(/^data:(image\/[a-zA-Z]+);base64,(.+)$/);
    if (match && match[1] && match[2]) {
      mimeType = match[1];
      cleanBase64 = match[2];
    } else {
      cleanBase64 = imageBase64.replace(/^data:image\/[a-zA-Z]+;base64,/, '');
    }
  }

  const fullDataUrl = imageBase64.startsWith('data:') ? imageBase64 : `data:${mimeType};base64,${cleanBase64}`;
  const errorsLogged: string[] = [];

  // 1. Hugging Face Serverless Inference API (Código Abierto Gratuito)
  const hfToken =
    options.hfToken ||
    (typeof process !== 'undefined' ? process.env.HF_TOKEN || process.env.VITE_HF_TOKEN : undefined);

  if (hfToken) {
    console.log('[RenovationAiService] Token HF detectado. Enviando petición a Hugging Face Inference API...');

    const hfModels = [
      'runwayml/stable-diffusion-inpainting',
      'stabilityai/stable-diffusion-2-inpainting',
      'black-forest-labs/FLUX.1-Fill-dev',
    ];

    for (const model of hfModels) {
      const endpoints = [
        `https://router.huggingface.co/hf-inference/models/${model}`,
        `https://api-inference.huggingface.co/models/${model}`,
      ];

      for (const endpoint of endpoints) {
        try {
          console.log(`[RenovationAiService] Probando modelo HF: ${model} en ${endpoint}...`);

          // Método A: Petición JSON con Data URL
          const jsonRes = await fetch(endpoint, {
            method: 'POST',
            headers: {
              Authorization: `Bearer ${hfToken}`,
              'Content-Type': 'application/json',
              'x-use-cache': 'false',
            },
            body: JSON.stringify({
              inputs: fullDataUrl,
              parameters: {
                prompt,
                negative_prompt: 'deformed, blurry, low quality, unnatural distortion, extra furniture, unrealistic joints',
              },
            }),
          });

          console.log(`[RenovationAiService] Respuesta HF JSON status: ${jsonRes.status}`);

          if (jsonRes.ok) {
            const contentType = jsonRes.headers.get('content-type') || '';
            if (contentType.includes('image/')) {
              const blob = await jsonRes.arrayBuffer();
              const b64 = btoa(new Uint8Array(blob).reduce((data, byte) => data + String.fromCharCode(byte), ''));
              console.log('[RenovationAiService] ¡Imagen generada con éxito en Hugging Face!');
              return {
                ok: true,
                afterImage: `data:${contentType.split(';')[0] || 'image/png'};base64,${b64}`,
                promptUsed: prompt,
                provider: `huggingface:${model}`,
              };
            }
          }

          // Método B: Petición binaria si el modelo requiere stream binario
          const imageBuffer = Uint8Array.from(atob(cleanBase64), (c) => c.charCodeAt(0));
          const binaryRes = await fetch(endpoint, {
            method: 'POST',
            headers: {
              Authorization: `Bearer ${hfToken}`,
              'Content-Type': mimeType,
              'x-use-cache': 'false',
            },
            body: imageBuffer,
          });

          console.log(`[RenovationAiService] Respuesta HF Binaria status: ${binaryRes.status}`);

          if (binaryRes.ok) {
            const contentType = binaryRes.headers.get('content-type') || '';
            if (contentType.includes('image/')) {
              const blob = await binaryRes.arrayBuffer();
              const b64 = btoa(new Uint8Array(blob).reduce((data, byte) => data + String.fromCharCode(byte), ''));
              console.log('[RenovationAiService] ¡Imagen generada con éxito en Hugging Face (binario)!');
              return {
                ok: true,
                afterImage: `data:${contentType.split(';')[0] || 'image/png'};base64,${b64}`,
                promptUsed: prompt,
                provider: `huggingface:${model}`,
              };
            }
          } else {
            const errText = await binaryRes.text();
            console.warn(`[RenovationAiService] Error en HF ${model}:`, errText);
            errorsLogged.push(`HF ${model}: ${errText.slice(0, 150)}`);
          }
        } catch (err: unknown) {
          const msg = err instanceof Error ? err.message : String(err);
          console.error(`[RenovationAiService] Excepción al llamar a HF ${model}:`, msg);
          errorsLogged.push(`HF ${model}: ${msg}`);
        }
      }
    }
  }

  // 2. Sin respuesta de Hugging Face / Error de Cuota o Token
  console.warn('[RenovationAiService] Hugging Face no pudo procesar la solicitud.');
  const errorMsg =
    errorsLogged.length > 0
      ? `Error al conectar con Hugging Face: ${errorsLogged.join(' | ')}`
      : 'No hay tokens o claves de IA configurados o activos. Introduce tu token gratuito de Hugging Face en la configuración (⚙️).';

  return {
    ok: false,
    error: errorMsg,
  };
}
