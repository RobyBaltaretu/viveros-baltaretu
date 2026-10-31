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
 * Utiliza peticiones REST nativas `fetch` sin dependencias pesadas en el bundle de Cloudflare Workers.
 */
export async function generateRenovationImage(
  imageBase64: string,
  config: RenovationConfig,
  options: RenovationAiOptions = {}
): Promise<RenovationAiResult> {
  const prompt = buildRenovationPrompt(config);

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

  // 1. Hugging Face Serverless Inference API (Código Abierto Gratuito)
  const hfToken =
    options.hfToken ||
    (typeof process !== 'undefined' ? process.env.HF_TOKEN || process.env.VITE_HF_TOKEN : undefined);

  if (hfToken) {
    try {
      const imageBuffer = Uint8Array.from(atob(cleanBase64), (c) => c.charCodeAt(0));
      const res = await fetch('https://api-inference.huggingface.co/models/stabilityai/stable-diffusion-xl-refiner-1.0', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${hfToken}`,
          'Content-Type': mimeType,
        },
        body: imageBuffer,
      });

      if (res.ok) {
        const blob = await res.arrayBuffer();
        const b64 = btoa(new Uint8Array(blob).reduce((data, byte) => data + String.fromCharCode(byte), ''));
        return {
          ok: true,
          afterImage: `data:image/png;base64,${b64}`,
          promptUsed: prompt,
          provider: 'huggingface-inference',
        };
      }
    } catch (err) {
      console.error('[RenovationAiService] Error en Hugging Face REST API:', err);
    }
  }

  // 2. Google Gemini REST API (gemini-2.5-flash-image)
  const geminiKey = options.geminiApiKey || (typeof process !== 'undefined' ? process.env.GEMINI_API_KEY : undefined);
  if (geminiKey) {
    try {
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
              return {
                ok: true,
                afterImage: `data:${outMime};base64,${part.inlineData.data}`,
                promptUsed: prompt,
                provider: 'gemini-2.5-flash-image',
              };
            }
          }
        }
      }
    } catch (err) {
      console.error('[RenovationAiService] Error en Google Gemini REST API:', err);
    }
  }

  // 3. Fal.ai REST API
  const falKey = options.falApiKey || (typeof process !== 'undefined' ? process.env.FAL_KEY : undefined);
  if (falKey) {
    try {
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
          return {
            ok: true,
            afterImage: data.images[0].url,
            promptUsed: prompt,
            provider: 'fal-ai/flux-pro/v1/fill',
          };
        }
      }
    } catch (err) {
      console.error('[RenovationAiService] Error en Fal.ai REST API:', err);
    }
  }

  // 4. OpenAI Image Edits REST API
  const openaiKey = options.openaiApiKey || (typeof process !== 'undefined' ? process.env.OPENAI_API_KEY : undefined);
  if (openaiKey) {
    try {
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
          return {
            ok: true,
            afterImage: `data:image/png;base64,${data.data[0].b64_json}`,
            promptUsed: prompt,
            provider: 'openai-gpt-image-1',
          };
        }
      }
    } catch (err) {
      console.error('[RenovationAiService] Error en OpenAI Image Edit REST API:', err);
    }
  }

  // 5. Modo Demostración / Desarrollo
  return {
    ok: true,
    afterImage: fullDataUrl,
    promptUsed: prompt,
    provider: 'demo-fallback',
  };
}
