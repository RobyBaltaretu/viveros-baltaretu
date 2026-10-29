import baltaretu from '../../clientes/baltaretu/cliente.config.json';
import { TOKENS_COLOR, type ConfiguracionCliente } from './configuracion.ts';

/**
 * Colores del núcleo: los de `@theme` en src/styles/global.css (los de Viveros
 * Baltaretu; un test comprueba que coinciden). Un cliente con otros colores los
 * sobrescribe con un `<style>` en la cabecera; con los del núcleo, o sin tema,
 * no se añade nada y la página queda exactamente igual.
 */
export const COLORES_NUCLEO = baltaretu.tema as Record<(typeof TOKENS_COLOR)[number], string>;

export function cssDelTema(c: Pick<ConfiguracionCliente, 'tema'>): string {
  const tema = c.tema;
  if (!tema || TOKENS_COLOR.every((t) => tema[t].toLowerCase() === COLORES_NUCLEO[t].toLowerCase())) return '';
  // `html:root` pesa más que el `:root` del @theme, así gana aunque la hoja de estilos venga después.
  return `html:root{${TOKENS_COLOR.map((t) => `--color-${t}:${tema[t]}`).join(';')}}`;
}
