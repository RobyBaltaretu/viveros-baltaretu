import { expect, test } from '@playwright/test';
import { auditar } from '../tests-e2e/ayudas';

// Tickets en Turia: cámara a un toque, la foto se sube sola y, al guardar el gasto, se ofrece guardar la tienda como proveedor.
test('ticket: foto a un toque, gasto guardado y su tienda como proveedor', async ({ page }) => {
  await page.goto('/panel/gastos/nuevo');
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Añadir un ticket');
  await expect(page.locator('input[capture="environment"]')).toHaveCount(1);
  await auditar(page);

  const png = await page.evaluate(() => {
    const c = document.createElement('canvas');
    c.width = 300;
    c.height = 600;
    const k = c.getContext('2d')!;
    k.fillStyle = '#fff';
    k.fillRect(0, 0, 300, 600);
    return c.toDataURL('image/png').split(',')[1]!;
  });
  // Sin pulsar nada más: al elegir la foto se sube y se abre la revisión.
  await page.getByText('Elegir una foto de la galería').locator('input').setInputFiles({ name: 't.png', mimeType: 'image/png', buffer: Buffer.from(png, 'base64') });
  await expect(page).toHaveURL(/\/panel\/gastos\/[^/]+\?leido=/, { timeout: 30_000 });

  const tienda = `Maderas Prueba ${Date.now()}`;
  await page.getByLabel('Dónde se compró').fill(tienda);
  await page.getByLabel('Total pagado (€)').fill('45,30');
  await page.getByLabel('Tipo de gasto').selectOption({ index: 1 });
  await page.getByRole('button', { name: 'Guardar el gasto' }).click();

  await expect(page.getByRole('heading', { name: `¿Guardo también «${tienda}» como proveedor?` })).toBeVisible();
  await auditar(page);
  await page.getByRole('button', { name: 'Sí, guardar el proveedor' }).click();
  await expect(page.getByRole('status')).toContainText('Gasto y proveedor guardados.');

  await page.goto('/panel/proveedores');
  await expect(page.getByText(tienda)).toBeVisible();
});
