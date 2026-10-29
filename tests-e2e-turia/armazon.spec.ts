import { expect, test } from '@playwright/test';
import { auditar, controlesGrandes } from '../tests-e2e/ayudas';

// Diseño nuevo del panel: barra lateral (ordenador) o barra de abajo (móvil) y «Crear».
test('«Crear» abre el menú y lleva a un presupuesto nuevo', async ({ page, isMobile }) => {
  await page.goto('/panel/facturas');
  const crear = isMobile ? page.locator('.nv-inferior').getByRole('button', { name: 'Crear' }) : page.locator('header').getByRole('button', { name: 'Crear' });
  await crear.click();
  const menu = page.getByRole('dialog', { name: '¿Qué quieres crear?' });
  await expect(menu).toBeVisible();
  await auditar(page);
  await menu.getByRole('link', { name: /Presupuesto/ }).click();
  await expect(page).toHaveURL(/\/panel\/presupuestos-cliente\/nuevo$/);
  await expect(page.getByRole('heading', { level: 1 })).toContainText('Nuevo presupuesto');
});

test('la sección actual se marca y todas están a mano', async ({ page, isMobile }) => {
  await page.goto('/panel/facturas');
  if (isMobile) {
    await expect(page.locator('.nv-inferior').getByRole('link', { name: 'Ventas' })).toHaveAttribute('aria-current', 'page');
  } else {
    const lateral = page.locator('.nv-lateral');
    await expect(lateral.getByRole('link', { name: 'Facturas' })).toHaveAttribute('aria-current', 'page');
    for (const s of ['Presupuestos', 'Clientes', 'Portafolio', 'Gastos', 'Informes']) await expect(lateral.getByRole('link', { name: s })).toBeVisible();
  }
  await auditar(page);
  await controlesGrandes(page);
});
