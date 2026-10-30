import { GoogleGenAI } from '@google/genai';
import { InferenceClient } from '@huggingface/inference';
import { fal } from '@fal-ai/client';
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

interface FalSubscribeResponse {
  data?: {
    images?: Array<{ url: string }>;
  };
}

/**
 * Service Layer para la transformación fotorrealista de imágenes mediante IA.
 * Soporta Hugging Face Serverless Inference API (gratuito con HF Token),
 * Google Gemini Multimodal Image Editing (`gemini-2.5-flash-image`),
 * Fal.ai (`fal-ai/flux-pro/v1/fill`) u OpenAI.
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

  // Convertir base64 a Blob para APIs de imagen que requieren binary/blob
  const imageBuffer = Uint8Array.from(atob(cleanBase64), (c) => c.charCodeAt(0));
  const imageBlob = new Blob([imageBuffer], { type: mimeType });

  // 1. Hugging Face Inference API (Proveedor Código Abierto Gratuito)
  const hfToken =
    options.hfToken ||
    (typeof process !== 'undefined' ? process.env.HF_TOKEN || process.env.VITE_HF_TOKEN : undefined);

  if (hfToken) {
    try {
      const hf = new InferenceClient(hfToken);
      // Usar modelo inpainting/image-to-image de Hugging Face
      const blobResult = await hf.imageToImage({
        model: 'stabilityai/stable-diffusion-xl-refiner-1.0',
        inputs: imageBlob,
        parameters: {
          prompt,
          negative_prompt: 'deformed, blurry, low quality, unnatural distortion, extra furniture',
        },
      });

      if (blobResult) {
        const arrayBuffer = await blobResult.arrayBuffer();
        const b64 = btoa(
          new Uint8Array(arrayBuffer).reduce((data, byte) => data + String.fromCharCode(byte), '')
        );
        return {
          ok: true,
          afterImage: `data:image/png;base64,${b64}`,
          promptUsed: prompt,
          provider: 'huggingface-inference',
        };
      }
    } catch (err) {
      console.error('[RenovationAiService] Error en Hugging Face API:', err);
    }
  }

  // 2. Google Gemini API (Proveedor Principal)
  const geminiKey = options.geminiApiKey || (typeof process !== 'undefined' ? process.env.GEMINI_API_KEY : undefined);
  if (geminiKey) {
    try {
      const ai = new GoogleGenAI({ apiKey: geminiKey });
      const response = await ai.models.generateContent({
        model: 'gemini-2.5-flash-image',
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
        config: {
          responseModalities: ['IMAGE', 'TEXT'],
        },
      });

      const candidates = response.candidates;
      if (candidates && candidates.length > 0 && candidates[0]?.content?.parts) {
        for (const part of candidates[0].content.parts) {
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
    } catch (err) {
      console.error('[RenovationAiService] Error en Google Gemini API:', err);
    }
  }

  // 3. Fal.ai API
  const falKey = options.falApiKey || (typeof process !== 'undefined' ? process.env.FAL_KEY : undefined);
  if (falKey) {
    try {
      fal.config({ credentials: falKey });
      const result = (await fal.subscribe('fal-ai/flux-pro/v1/fill', {
        input: {
          image_url: fullDataUrl,
          mask_url: fullDataUrl,
          prompt,
        },
      })) as FalSubscribeResponse;

      if (result?.data?.images?.[0]?.url) {
        return {
          ok: true,
          afterImage: result.data.images[0].url,
          promptUsed: prompt,
          provider: 'fal-ai/flux-pro/v1/fill',
        };
      }
    } catch (err) {
      console.error('[RenovationAiService] Error en Fal.ai API:', err);
    }
  }

  // 4. OpenAI Image Edits API
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
      console.error('[RenovationAiService] Error en OpenAI Image Edit API:', err);
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
