import { expect, test, type Page } from '@playwright/test';
import { auditar } from '../tests-e2e/ayudas';

// Simulador de Turia: la IA (Gemini, de pago) nunca se llama en las pruebas: la API se simula.
const cuota = (usos: number, limite = 250) => {
  const quedan = Math.max(0, limite - usos);
  return { usos, limite, quedan, porcentaje: Math.min(100, Math.round((usos / limite) * 100)), aviso: usos >= limite * 0.8, agotada: usos >= limite };
};

/** Foto de 1600 × 1200 (más grande que el tope de 1024 px), hecha en el navegador. */
async function subirFoto(page: Page) {
  const base64 = await page.evaluate(() => {
    const c = document.createElement('canvas');
    c.width = 1600;
    c.height = 1200;
    const k = c.getContext('2d')!;
    k.fillStyle = '#c8b89a';
    k.fillRect(0, 0, 1600, 1200);
    k.fillStyle = '#5a4630';
    k.fillRect(200, 300, 800, 600);
    return c.toDataURL('image/png').split(',')[1]!;
  });
  await page.locator('#foto-input').setInputFiles({ name: 'cocina.png', mimeType: 'image/png', buffer: Buffer.from(base64, 'base64') });
  await expect(page.locator('#editor-mascara')).toBeVisible();
}

test('simulador: barra del mes, zona marcada y resultado cosido, sin claves en el navegador', async ({ page }) => {
  await page.goto('/panel/simulador');
  await expect(page.getByRole('progressbar', { name: 'Simulaciones de este mes' })).toHaveAttribute('aria-valuetext', '0 de 250 usadas · quedan 250');
  await expect(page.getByRole('button', { name: /Configuración IA/ })).toHaveCount(0);
  await auditar(page);

  await subirFoto(page);
  await expect.poll(() => page.locator('#lienzo-mascara').evaluate((c: HTMLCanvasElement) => [c.width, c.height])).toEqual([1024, 768]);
  await page.getByText('Rectángulo', { exact: true }).click();
  const caja = (await page.locator('#lienzo-mascara').boundingBox())!;
  await page.mouse.move(caja.x + caja.width * 0.2, caja.y + caja.height * 0.2);
  await page.mouse.down();
  await page.mouse.move(caja.x + caja.width * 0.6, caja.y + caja.height * 0.7, { steps: 4 });
  await page.mouse.up();

  let enviado: { image?: string; mask?: string; options?: unknown } = {};
  await page.route('**/api/panel/simulador', async (ruta) => {
    enviado = ruta.request().postDataJSON();
    const verde = await page.evaluate(() => {
      const c = document.createElement('canvas');
      c.width = 1024;
      c.height = 768;
      const k = c.getContext('2d')!;
      k.fillStyle = '#2f6b3a';
      k.fillRect(0, 0, 1024, 768);
      return c.toDataURL('image/png');
    });
    await ruta.fulfill({ json: { ok: true, afterImage: verde, cuota: cuota(200) } });
  });
  await page.getByRole('button', { name: 'Generar Reforma en Vivo' }).click();
  await expect(page.locator('#slider-wrapper')).toBeVisible();
  expect(enviado.image).toMatch(/^data:image\/jpeg;base64,/);
  expect(enviado.mask).toMatch(/^data:image\/png;base64,/);
  expect(enviado.options).toBeUndefined();
  expect(JSON.stringify(enviado)).not.toMatch(/token|apiKey|key/i);

  // Cosido: dentro de lo marcado, el resultado (verde); fuera, la foto de siempre.
  const pixel = (x: number, y: number) =>
    page.locator('#img-after').evaluate(
      (img: HTMLImageElement, [px, py]) => {
        const c = document.createElement('canvas');
        c.width = img.naturalWidth;
        c.height = img.naturalHeight;
        const k = c.getContext('2d')!;
        k.drawImage(img, 0, 0);
        return Array.from(k.getImageData(px!, py!, 1, 1).data.slice(0, 3));
      },
      [x, y],
    );
  await expect.poll(() => page.locator('#img-after').evaluate((img: HTMLImageElement) => img.naturalWidth)).toBe(1024);
  const dentro = await pixel(400, 350);
  expect(dentro[1]! - dentro[0]!).toBeGreaterThan(40);
  const fuera = await pixel(900, 700);
  expect(fuera[0]! - fuera[1]!).toBeGreaterThan(5);

  // Desde el 80 %, aviso naranja con lo que queda.
  await expect(page.locator('#cuota-aviso')).toHaveText('Te quedan 50 simulaciones este mes.');
  await expect(page.getByRole('progressbar', { name: 'Simulaciones de este mes' })).toHaveAttribute('aria-valuenow', '200');
  await auditar(page);

  // Al llegar al tope, el botón se bloquea hasta el mes que viene.
  await page.unroute('**/api/panel/simulador');
  await page.route('**/api/panel/simulador', (ruta) => ruta.fulfill({ status: 403, json: { ok: false, error: 'Has llegado al tope de simulaciones de este mes. El servicio se reactiva el día 1 del mes que viene.', cuota: cuota(250) } }));
  await page.getByRole('button', { name: 'Generar Reforma en Vivo' }).click();
  await expect(page.getByRole('button', { name: 'Generar Reforma en Vivo' })).toBeDisabled();
  await expect(page.locator('#cuota-aviso')).toContainText('día 1 del mes que viene');
  await expect(page.locator('#error-message')).toContainText('tope de simulaciones');
  await auditar(page);
});
