import { expect, test } from '@playwright/test';
import { auditar } from '../tests-e2e/ayudas';

// Rediseño UX, fase 2: bienvenida, formularios por pasos en el móvil y «¿Cómo funciona?».
test('bienvenida de tres pantallas: se puede recorrer, es accesible y se cierra', async ({ page }) => {
  await page.goto('/panel?bienvenida=1');
  const dialogo = page.getByRole('dialog', { name: /Bienvenido a/ });
  await expect(dialogo).toBeVisible();
  await auditar(page);
  await dialogo.getByRole('button', { name: /Siguiente/ }).click();
  await expect(page.getByRole('dialog', { name: 'Todo empieza en «Crear»' })).toBeVisible();
  await page.getByRole('button', { name: /Siguiente/ }).click();
  await page.getByRole('button', { name: /Empezar/ }).click();
  await expect(page.locator('#nv-bienvenida')).not.toBeVisible();
  // Sin el parámetro (y en un navegador automático) no vuelve a salir.
  await page.goto('/panel');
  await expect(page.locator('#nv-bienvenida')).not.toBeVisible();
});

test('nuevo presupuesto por pasos en el móvil, con el total abajo', async ({ page }, info) => {
  await page.goto('/panel/presupuestos-cliente/nuevo');
  const guia = page.getByRole('list', { name: 'Pasos' });
  if (info.project.name !== 'movil') {
    // En escritorio se ve todo junto, como siempre.
    await expect(guia).toBeHidden();
    await expect(page.getByRole('heading', { name: 'Trabajos y materiales' })).toBeVisible();
    return;
  }
  await expect(guia.getByRole('button', { name: /Cliente/ })).toHaveAttribute('aria-current', 'step');
  await expect(page.getByRole('heading', { name: 'Trabajos y materiales' })).toBeHidden();
  await expect(page.locator('[data-total-pie]')).toHaveText(/0,00/);
  await page.getByRole('button', { name: 'Siguiente: Trabajos' }).click();
  await expect(page.getByRole('heading', { name: 'Trabajos y materiales' })).toBeVisible();
  await page.getByRole('button', { name: 'Siguiente: Condiciones' }).click();
  await expect(page.getByRole('button', { name: 'Guardar el presupuesto' })).toBeVisible();
  await page.getByRole('button', { name: 'Atrás' }).click();
  await expect(page.getByRole('heading', { name: 'Trabajos y materiales' })).toBeVisible();
  await auditar(page);
});

test('«¿Cómo funciona?» se abre y explica el concepto', async ({ page }) => {
  await page.goto('/panel/catalogo');
  await page.getByText('¿Cómo funciona el catálogo?').click();
  await expect(page.getByText(/la receta de un mueble \(el escandallo\)/)).toBeVisible();
  await auditar(page);
});
