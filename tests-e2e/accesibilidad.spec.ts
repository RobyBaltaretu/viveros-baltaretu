import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Page } from '@playwright/test';

const PAGINAS = [
  '/',
  '/en/',
  '/catalogo/',
  '/catalogo/palmeras/',
  '/en/catalogue/olive-trees/',
  '/catalogo/phoenix-canariensis/',
  '/en/catalogue/olivo-gran-perimetro/',
  '/presupuesto/',
  '/presupuesto/enviado/',
  '/nosotros/',
  '/reparto/',
  '/proyectos/',
  '/proyectos/proyecto-de-ejemplo/',
  '/guias/como-elegir-la-altura/',
  '/aviso-legal/',
  '/404.html',
];

/** Elección de cookies ya hecha, para que el aviso no tape botones en las pruebas de interacción. */
const sinAvisoCookies = (page: Page) =>
  page.addInitScript(() => localStorage.setItem('vivero:consentimiento-cookies', 'rechazado'));

async function auditar(page: Page) {
  const resultado = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa']).analyze();
  const resumen = resultado.violations.map((v) => `${v.id}: ${v.nodes.map((n) => n.target.join(' ')).join(' | ')}`);
  expect(resumen).toEqual([]);
}

test.describe('WCAG 2.1 AA (axe)', () => {
  for (const ruta of PAGINAS) {
    test(ruta, async ({ page }) => {
      await page.emulateMedia({ reducedMotion: 'reduce' });
      await page.goto(ruta);
      await auditar(page);
    });
  }

  test('panel de la lista abierto', async ({ page }) => {
    await sinAvisoCookies(page);
    await page.goto('/catalogo/phoenix-canariensis/');
    await page.getByRole('button', { name: 'Añadir a la lista de presupuesto' }).click();
    await page.locator('[data-abrir-lista]').click();
    await expect(page.locator('dialog[open]')).toBeVisible();
    await auditar(page);
  });
});

test.describe('aviso de cookies', () => {
  test('sale al entrar, se puede rechazar con el teclado y se recuerda', async ({ page }) => {
    await page.goto('/');
    const aviso = page.getByRole('region', { name: 'Cookies de analítica' });
    await expect(aviso).toBeVisible();
    await aviso.getByRole('button', { name: 'Rechazar' }).focus();
    await page.keyboard.press('Enter');
    await expect(aviso).toBeHidden();
    await page.reload();
    await expect(page.getByRole('region', { name: 'Cookies de analítica' })).toBeHidden();
    // Con ID de prueba nunca se carga Google Analytics.
    expect(await page.evaluate(() => Boolean(document.querySelector('script[src*="googletagmanager"]')))).toBe(false);
    await page.getByRole('button', { name: 'Configurar cookies' }).click();
    await expect(page.getByRole('region', { name: 'Cookies de analítica' })).toBeVisible();
  });
});

test.describe('teclado', () => {
  test.beforeEach(({ page }) => sinAvisoCookies(page));

  test('el enlace "Saltar al contenido" es lo primero y lleva al contenido', async ({ page }) => {
    await page.goto('/catalogo/');
    await page.keyboard.press('Tab');
    const enlace = page.getByRole('link', { name: 'Saltar al contenido' });
    await expect(enlace).toBeFocused();
    await expect(enlace).toBeVisible();
  });

  test('la regla de altura se maneja con las flechas y actualiza la URL', async ({ page, isMobile }) => {
    test.skip(isMobile, 'Basta con comprobarlo en escritorio');
    await page.goto('/catalogo/');
    await page.getByLabel('Altura mínima').focus();
    await page.keyboard.press('ArrowRight');
    await page.keyboard.press('ArrowRight');
    await expect(page).toHaveURL(/altura=1-/);
  });

  test('el buscador por altura de la portada filtra y enlaza al catálogo con el mismo rango', async ({ page, isMobile }) => {
    test.skip(isMobile, 'Basta con comprobarlo en escritorio');
    await page.goto('/');
    const ver = page.getByRole('link', { name: /^Ver \d+ especies?$/ });
    await expect(ver).toHaveAttribute('href', /altura=2-4$/);
    await page.getByLabel('Altura máxima').focus();
    await page.keyboard.press('ArrowLeft');
    await page.keyboard.press('ArrowLeft');
    await expect(ver).toHaveAttribute('href', /altura=2-3$/);
  });

  test('el panel de la lista se cierra con Esc y devuelve el foco', async ({ page }) => {
    await page.goto('/catalogo/higuera-comun/');
    await page.getByRole('button', { name: 'Añadir a la lista de presupuesto' }).click();
    const abrir = page.locator('[data-abrir-lista]');
    await abrir.focus();
    await page.keyboard.press('Enter');
    await expect(page.locator('dialog[open]')).toBeVisible();
    await page.keyboard.press('Escape');
    await expect(page.locator('dialog[open]')).toHaveCount(0);
    await expect(abrir).toBeFocused();
  });
});
