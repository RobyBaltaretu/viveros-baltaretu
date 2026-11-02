import { expect, test } from '@playwright/test';

// Capturas de la interfaz real, con los datos que contiene la D1 local.
// Se conservan como artefacto de CI para revisar escritorio, tableta y móvil.
for (const [ancho, alto] of [[375, 812], [390, 844], [430, 932], [768, 1024], [1024, 768], [1440, 900]]) {
  test(`inicio responsive ${ancho} × ${alto}`, async ({ page }, testInfo) => {
    test.skip(testInfo.project.name !== 'escritorio', 'Una captura por tamaño es suficiente');
    await page.setViewportSize({ width: ancho, height: alto });
    await page.goto('/panel');
    await expect(page.getByRole('heading', { level: 1, name: 'Creaciones Turia' })).toBeVisible();
    await expect(page.locator('.ux-hero-foto')).toBeVisible();
    expect(await page.locator('.ux-hero-foto').evaluate((img: HTMLImageElement) => img.complete && img.naturalWidth > 0)).toBe(true);
    const desborde = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
    expect(desborde, `Desborde horizontal de ${desborde}px a ${ancho}px`).toBeLessThanOrEqual(1);
    await page.screenshot({ path: testInfo.outputPath(`inicio-${ancho}.png`), fullPage: true, animations: 'disabled' });
  });
}
