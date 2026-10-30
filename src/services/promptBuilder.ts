import type { RenovationConfig } from '../server/simulador/materiales.ts';

/**
 * Motor de fidelidad: Construye el prompt técnico de ingeniería arquitectónica
 * para el modelo de edición de imagen (Image-to-Image / Inpainting).
 */
export function buildRenovationPrompt(config: RenovationConfig): string {
  const cabinetStyleStr = config.cabinetStyle ? config.cabinetStyle : 'modern clean style';
  const openingSystemStr = config.openingSystem ? config.openingSystem : 'seamless integrated handles';
  const spaceTypeStr = config.spaceType ? config.spaceType : 'room';

  const upperFinishAndGrain = [
    config.upperMaterial.finish,
    config.upperMaterial.grainDirection,
  ]
    .filter(Boolean)
    .join(', ');

  const lowerFinishAndGrain = [
    config.lowerMaterial.finish,
    config.lowerMaterial.grainDirection,
  ]
    .filter(Boolean)
    .join(', ');

  return `
Perform a photorealistic architectural interior renovation edit on the provided photograph.

1. STRICT GEOMETRY & CONTEXT LOCK (DO NOT MODIFY):
- Keep the exact camera angle, wide-angle lens perspective, vanishing points, room dimensions, walls, ceiling, and lighting fixtures.
- Preserve all non-renovated elements 100% intact in their exact pixel positions: windows, curtains, doors/frames not selected, appliances (refrigerator, oven, dishwasher, sink, faucet), wall clocks, decorations, stools, and objects on the counter.

2. TARGETED CARPENTRY & SURFACE RENOVATION TO APPLY:
${
  config.zones.cabinets
    ? `- CABINETRY / FURNITURE: Replace the existing ${spaceTypeStr} cabinets with ${cabinetStyleStr} doors (${openingSystemStr}).
  * Upper modules material: ${config.upperMaterial.promptDescriptor} (${upperFinishAndGrain}).${
        config.floorToCeiling ? ' Extend upper cabinets cleanly up to the ceiling.' : ' Keep original upper cabinet height.'
      }
  * Lower/Main modules material: ${config.lowerMaterial.promptDescriptor} (${lowerFinishAndGrain}).`
    : '- Keep existing cabinetry untouched.'
}

${
  config.zones.countertop
    ? `- COUNTERTOP & BACKSPLASH: Replace the existing countertop ${
        config.includeBacksplash ? 'and wall backsplash' : ''
      } with ${config.countertopMaterial.promptDescriptor}. Ensure seamless joints, realistic edge profile, and natural surface reflections.`
    : '- Keep existing countertop and backsplash untouched.'
}

${
  config.zones.flooring
    ? `- FLOORING: Replace the existing floor tiles/pavement with ${config.flooringMaterial.promptDescriptor} following the exact 3D floor perspective and casting realistic contact shadows under the cabinets and furniture.`
    : '- Keep existing flooring untouched.'
}

${
  config.zones.lighting && config.lighting.underCabinetLed
    ? `- LIGHTING: Add a realistic recessed warm LED strip (${config.lighting.colorTemp}) under the upper cabinets casting soft illumination onto the backsplash and countertop.`
    : ''
}

3. PHOTOREALISM & INTEGRATION:
- Match the original room's global illumination, shadow direction, ambient occlusion, and color temperature.
- Output an 8k architectural interior photography result that looks like a real photo taken in the exact same room after the carpenter finished the installation.
`.trim();
}
