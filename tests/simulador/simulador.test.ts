import { describe, expect, test } from 'vitest';
import { MATERIALES_ENCIMERA, MATERIALES_MUEBLE, MATERIALES_SUELO, type RenovationConfig } from '../../src/server/simulador/materiales.ts';
import { buildRenovationPrompt } from '../../src/services/promptBuilder.ts';
import { generateRenovationImage } from '../../src/services/renovationAiService.ts';

describe('Simulador de Reformas con IA', () => {
  const dummyConfig: RenovationConfig = {
    spaceType: 'Cocina',
    cabinetStyle: 'Moderno sin tirador (Gola)',
    floorToCeiling: true,
    zones: {
      cabinets: true,
      countertop: true,
      flooring: true,
      lighting: true,
    },
    upperMaterial: MATERIALES_MUEBLE[0]!,
    lowerMaterial: MATERIALES_MUEBLE[1]!,
    countertopMaterial: MATERIALES_ENCIMERA[0]!,
    includeBacksplash: true,
    flooringMaterial: MATERIALES_SUELO[0]!,
    lighting: {
      underCabinetLed: true,
      colorTemp: '3000K neutral white',
    },
  };

  test('buildRenovationPrompt genera un prompt estructurado correctamente', () => {
    const prompt = buildRenovationPrompt(dummyConfig);

    expect(prompt).toContain('Perform a photorealistic architectural interior renovation edit');
    expect(prompt).toContain('1. STRICT GEOMETRY & CONTEXT LOCK');
    expect(prompt).toContain('2. TARGETED CARPENTRY & SURFACE RENOVATION');
    expect(prompt).toContain('natural Maya Oak wood veneer');
    expect(prompt).toContain('Calacatta Gold');
    expect(prompt).toContain('herringbone');
    expect(prompt).toContain('3000K neutral white');
    expect(prompt).toContain('Extend upper cabinets cleanly up to the ceiling');
  });

  test('generateRenovationImage informa explícitamente cuando no hay claves configuradas o fallan', async () => {
    const testBase64 = 'data:image/jpeg;base64,aGVsbG8gd29ybGQ=';
    const result = await generateRenovationImage(testBase64, dummyConfig, {});

    expect(result.ok).toBe(false);
    expect(result.error).toContain('No hay tokens o claves de IA configurados');
  });

  test('solo Hugging Face: otras claves (de pago) se ignoran y no se llama a ningún otro servicio', async () => {
    const llamadas: string[] = [];
    const original = globalThis.fetch;
    globalThis.fetch = (async (url: string | URL | Request) => {
      llamadas.push(String(url));
      return new Response('sin cupo', { status: 503 });
    }) as typeof fetch;
    try {
      const opciones = { geminiApiKey: 'x', falApiKey: 'x', openaiApiKey: 'x' } as unknown as Parameters<typeof generateRenovationImage>[2];
      expect((await generateRenovationImage('data:image/jpeg;base64,aGVsbG8=', dummyConfig, opciones)).ok).toBe(false);
      expect(llamadas).toEqual([]);
      await generateRenovationImage('data:image/jpeg;base64,aGVsbG8=', dummyConfig, { hfToken: 'hf_prueba' });
      expect(llamadas.length).toBeGreaterThan(0);
      expect(llamadas.every((u) => u.includes('huggingface.co'))).toBe(true);
    } finally {
      globalThis.fetch = original;
    }
  });
});
