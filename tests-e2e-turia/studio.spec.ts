import { expect, test } from '@playwright/test';

// Turia Studio: el script se inicializa, «Crear borrador» funciona, se suben las fotos,
// la interpretación (simulada: no se llama a Gemini) pinta el alzado 2D, una cota editada
// lo redibuja y, al recargar, el borrador se recupera.
const cota = (valorMm: number | null) => ({ valorMm, precision: valorMm === null ? 'desconocida' : 'aproximada', origen: 'boceto', confirmada: false });
const png = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=', 'base64');

test('Studio: crear borrador, subir fotos, ver y editar el boceto 2D, y recuperarlo', async ({ page }) => {
  const errores: string[] = [];
  page.on('pageerror', (e) => errores.push(e.message));
  await page.goto('/panel/studio-bocetos');
  await expect(page.locator('#estado-boceto')).toHaveText(/Turia Studio listo/);
  await expect(page.locator('[data-version-codigo]')).toContainText('Versión del código');

  const titulo = `Lavadero ${Date.now()}`;
  await page.fill('#titulo-boceto', titulo);
  const creado = page.waitForResponse((r) => r.url().endsWith('/api/panel/studio-bocetos') && r.request().method() === 'POST');
  await page.getByRole('button', { name: 'Crear borrador' }).click();
  expect((await creado).status()).toBe(201);
  await expect(page.locator('#editor-boceto')).toBeVisible();
  await expect(page.locator('#estado-boceto')).toHaveText(/Borrador creado/);
  await expect(page.locator('#resultado-boceto svg')).toHaveCount(1);

  await page.setInputFiles('#foto-espacio', { name: 'espacio.png', mimeType: 'image/png', buffer: png });
  await page.setInputFiles('#foto-dibujo', { name: 'boceto.png', mimeType: 'image/png', buffer: png });
  await page.getByRole('button', { name: 'Guardar interpretación manual' }).click();
  await expect(page.locator('#estado-boceto')).toHaveText('Fotografías e interpretación guardadas.');

  // Interpretación simulada con dos módulos (el servidor real necesita Gemini y R2).
  await page.route('**/api/panel/studio-interpretar', async (ruta) => {
    const { id } = ruta.request().postDataJSON();
    const bocetos = await (await page.request.get('/api/panel/studio-bocetos')).json();
    const b = bocetos.bocetos.find((x: { id: string }) => x.id === id);
    await ruta.fulfill({
      json: {
        revision: b.revision,
        interpretacion: { version: 1, estado: 'pendiente', categoria: 'lavadero', fotoEspacioId: 'x', fotoBocetoId: 'y', obstaculos: [], preguntas: [], modulos: [
          { id: 'bajo-1', tipo: 'bajo', orden: 0, ancho: cota(800), alto: cota(850), fondo: cota(600), piezas: [] },
          { id: 'columna-1', tipo: 'columna', orden: 1, ancho: cota(600), alto: cota(null), fondo: cota(600), piezas: [] },
        ] },
      },
    });
  });
  await page.getByRole('button', { name: 'Interpretar dibujo con IA' }).click();
  await expect(page.locator('#resultado-boceto h3')).toHaveText('Distribución: 2 módulos');
  const svgAntes = await page.locator('#resultado-boceto [data-plano]').innerHTML();
  expect(svgAntes).toContain('<svg');
  await expect(page.locator('#resultado-boceto')).toContainText('Altura desconocida');

  // Editar una cota redibuja el alzado (y quita su aviso).
  const alto = page.locator('#resultado-boceto fieldset').nth(1).getByLabel('alto (mm)');
  await alto.fill('2100');
  await alto.dispatchEvent('change');
  await expect(page.locator('#resultado-boceto')).not.toContainText('Altura desconocida');
  expect(await page.locator('#resultado-boceto [data-plano]').innerHTML()).not.toBe(svgAntes);

  // Al recargar, el borrador sigue en la lista y se puede abrir.
  await page.reload();
  await expect(page.locator('#estado-boceto')).toHaveText(/Turia Studio listo/);
  await page.locator('#lista-bocetos button', { hasText: titulo }).click();
  await expect(page.locator('#editor-boceto')).toBeVisible();
  await expect(page.locator('#resultado-boceto svg')).toHaveCount(1);
  expect(errores).toEqual([]);
});
