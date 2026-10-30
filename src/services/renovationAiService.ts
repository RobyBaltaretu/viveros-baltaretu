import type { RenovationConfig } from '../server/simulador/materiales.ts';
import { buildRenovationPrompt } from './promptBuilder.ts';

export interface RenovationAiOptions {
  hfToken?: string;
  geminiApiKey?: string;
  falApiKey?: string;
  openaiApiKey?: string;
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
 * Soporta Hugging Face Router / Inference API, Google Gemini, Fal.ai y OpenAI.
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

  // 2. Google Gemini REST API (gemini-2.5-flash-image)
  const geminiKey = options.geminiApiKey || (typeof process !== 'undefined' ? process.env.GEMINI_API_KEY : undefined);
  if (geminiKey) {
    try {
      console.log('[RenovationAiService] API Key Gemini detectada. Enviando petición a Google Gemini API...');
      const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-image:generateContent?key=${geminiKey}`;
      const res = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [
            {
              role: 'user',
              parts: [
                { text: prompt },
                {
                  inlineData: {
                    mimeType,
                    data: cleanBase64,
                  },
                },
              ],
            },
          ],
          generationConfig: {
            responseModalities: ['IMAGE', 'TEXT'],
          },
        }),
      });

      console.log(`[RenovationAiService] Respuesta Gemini status: ${res.status}`);

      if (res.ok) {
        const data = (await res.json()) as {
          candidates?: Array<{
            content?: {
              parts?: Array<{
                inlineData?: { mimeType?: string; data?: string };
              }>;
            };
          }>;
        };

        const parts = data.candidates?.[0]?.content?.parts;
        if (parts) {
          for (const part of parts) {
            if (part.inlineData && part.inlineData.data) {
              const outMime = part.inlineData.mimeType || 'image/png';
              console.log('[RenovationAiService] ¡Imagen generada con éxito en Google Gemini!');
              return {
                ok: true,
                afterImage: `data:${outMime};base64,${part.inlineData.data}`,
                promptUsed: prompt,
                provider: 'gemini-2.5-flash-image',
              };
            }
          }
        }
      } else {
        const errText = await res.text();
        console.warn('[RenovationAiService] Error en Gemini API:', errText);
        errorsLogged.push(`Gemini: ${errText.slice(0, 150)}`);
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      console.error('[RenovationAiService] Excepción en Gemini API:', msg);
      errorsLogged.push(`Gemini: ${msg}`);
    }
  }

  // 3. Fal.ai REST API
  const falKey = options.falApiKey || (typeof process !== 'undefined' ? process.env.FAL_KEY : undefined);
  if (falKey) {
    try {
      console.log('[RenovationAiService] FAL_KEY detectada. Enviando petición a Fal.ai...');
      const res = await fetch('https://queue.fal.run/fal-ai/flux-pro/v1/fill', {
        method: 'POST',
        headers: {
          Authorization: `Key ${falKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          image_url: fullDataUrl,
          mask_url: fullDataUrl,
          prompt,
        }),
      });

      if (res.ok) {
        const data = (await res.json()) as { images?: Array<{ url: string }> };
        if (data.images?.[0]?.url) {
          console.log('[RenovationAiService] ¡Imagen generada con éxito en Fal.ai!');
          return {
            ok: true,
            afterImage: data.images[0].url,
            promptUsed: prompt,
            provider: 'fal-ai/flux-pro/v1/fill',
          };
        }
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      console.error('[RenovationAiService] Excepción en Fal.ai REST API:', msg);
      errorsLogged.push(`Fal.ai: ${msg}`);
    }
  }

  // 4. OpenAI Image Edits REST API
  const openaiKey = options.openaiApiKey || (typeof process !== 'undefined' ? process.env.OPENAI_API_KEY : undefined);
  if (openaiKey) {
    try {
      console.log('[RenovationAiService] OPENAI_API_KEY detectada. Enviando petición a OpenAI...');
      const res = await fetch('https://api.openai.com/v1/images/edits', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${openaiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: 'gpt-image-1',
          image: fullDataUrl,
          prompt,
          response_format: 'b64_json',
        }),
      });

      if (res.ok) {
        const data = (await res.json()) as { data?: Array<{ b64_json?: string }> };
        if (data?.data?.[0]?.b64_json) {
          console.log('[RenovationAiService] ¡Imagen generada con éxito en OpenAI!');
          return {
            ok: true,
            afterImage: `data:image/png;base64,${data.data[0].b64_json}`,
            promptUsed: prompt,
            provider: 'openai-gpt-image-1',
          };
        }
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      console.error('[RenovationAiService] Excepción en OpenAI API:', msg);
      errorsLogged.push(`OpenAI: ${msg}`);
    }
  }

  // 5. Sin proveedor funcional / Error de Cuota o Token
  console.warn('[RenovationAiService] Ningún proveedor de IA pudo procesar la solicitud.');
  const errorMsg =
    errorsLogged.length > 0
      ? `Error al conectar con los servicios de IA: ${errorsLogged.join(' | ')}`
      : 'No hay tokens o claves de IA configurados o activos. Introduce tu Token gratuito de Hugging Face o API Key de Gemini en la configuración (⚙️).';

  return {
    ok: false,
    error: errorMsg,
  };
}
