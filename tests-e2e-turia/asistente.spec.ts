import { expect, test } from '@playwright/test';
import { auditar } from '../tests-e2e/ayudas';

// El asistente de Turia es Gubia (carpintería): nada de AgricolAI ni de plantas, y dice qué IA contesta.
test('asistente: se llama Gubia, habla de la carpintería y dice qué IA usa', async ({ page }) => {
  await page.goto('/panel/asistente');
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Gubia');
  await expect(page).toHaveTitle(/^Gubia/);
  await expect(page.locator('[data-modelo-ia]')).toHaveText(/^IA: /);
  await expect(page.getByRole('button', { name: /palmeras/ })).toHaveCount(0);
  await expect(page.getByLabel('Añadir fotos para las plantas')).toHaveCount(0);
  await auditar(page);

  await page.getByLabel('Escribe a Gubia').fill('¿Qué tengo pendiente hoy?');
  await page.getByLabel('Escribe a Gubia').press('Enter');
  await expect(page.locator('#conversacion article').first()).toBeVisible();
  await expect(page.locator('#conversacion')).toContainText('Gubia', { timeout: 30_000 });
  await expect(page.locator('#conversacion article').last()).toHaveAttribute('aria-label', /^Gubia, /, { timeout: 30_000 });
  await expect(page.locator('body')).not.toContainText('AgricolAI');
});
