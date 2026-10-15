import AxeBuilder from '@axe-core/playwright';
import { expect, type Page } from '@playwright/test';

/** Sin violaciones de WCAG 2.1 AA según axe. */
export async function auditar(page: Page) {
  // Se mide el estado final: se espera a que acaben las animaciones de entrada
  // (con opacidad a medias, el contraste saldría más bajo de lo que se ve).
  // Las que se repiten sin fin (hojas, cinta) y las ligadas al scroll no se esperan.
  await page.evaluate(() =>
    Promise.all(
      document
        .getAnimations()
        .filter((a) => a.timeline instanceof DocumentTimeline && a.effect?.getTiming().iterations !== Infinity)
        .map((a) => a.finished.catch(() => undefined)),
    ),
  );
  const resultado = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa']).analyze();
  const resumen = resultado.violations.map((v) => `${v.id}: ${v.nodes.map((n) => n.target.join(' ')).join(' | ')}`);
  expect(resumen).toEqual([]);
}

/** Todos los controles pulsables miden al menos 48 px de alto. */
export async function controlesGrandes(page: Page) {
  const pequenos = await page.locator('main a, main button, main input:not([type=hidden]), main select, main textarea, header a').evaluateAll((els) =>
    els
      .filter((e) => (e as HTMLElement).offsetParent !== null && !(e as HTMLInputElement).matches('input[type=radio], input[type=checkbox], [aria-hidden=true][tabindex="-1"]'))
      .filter((e) => e.getBoundingClientRect().height < 47.5)
      .map((e) => e.outerHTML.slice(0, 80)),
  );
  expect(pequenos).toEqual([]);
}
