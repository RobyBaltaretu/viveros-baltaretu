import { expect, test } from '@playwright/test';
import { auditar, controlesGrandes } from '../tests-e2e/ayudas';

// Diseño nuevo del panel: barra lateral (ordenador) o barra de abajo (móvil) y «Crear».
test('«Crear» abre el menú y lleva a un presupuesto nuevo', async ({ page, isMobile }) => {
  await page.goto('/panel/facturas');
  const crear = isMobile ? page.locator('.nv-inferior').getByRole('button', { name: 'Abrir menú de creación' }) : page.locator('header').getByRole('button', { name: 'Abrir menú de creación' });
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

test('inicio: accesos reales, cifras, proyectos y evolución accesible', async ({ page, isMobile }) => {
  await page.goto('/panel');
  await expect(page.getByRole('heading', { level: 1, name: 'Creaciones Turia' })).toBeVisible();
  if (isMobile) await page.getByText('Ver los otros indicadores').click();
  const indicadores = page.locator(isMobile ? '.nv-estudio-mas-metricas' : '.nv-estudio-metricas');
  for (const k of (isMobile ? ['Por cobrar', 'Presupuestos en juego', 'Aceptación (90 días)'] : ['Facturado en', 'Por cobrar', 'Presupuestos en juego', 'Aceptación (90 días)'])) await expect(indicadores.getByText(k)).toBeVisible();
  const atajos = page.getByRole('region', { name: 'Accesos rápidos' });
  await expect(atajos.getByRole('link', { name: /presupuesto/i })).toHaveAttribute('href', '/panel/presupuestos-cliente/nuevo');
  await expect(atajos.getByRole('link', { name: /factura/i })).toHaveAttribute('href', '/panel/facturas/nueva');
  await expect(page.getByRole('heading', { name: 'Proyectos en curso' })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Por hacer' })).toBeVisible();
  await expect(page.getByText('Facturado sin IVA')).toBeVisible();
  await page.getByText('Valores por mes').click();
  await expect(page.locator('.nv-estudio-grafico details li')).toHaveCount(6);
  if (isMobile) await expect(atajos.locator('li').nth(4)).toBeHidden();
  await auditar(page);
  await controlesGrandes(page);
});
