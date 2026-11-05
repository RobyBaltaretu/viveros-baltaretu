import { expect, test } from '@playwright/test';
import { auditar } from '../tests-e2e/ayudas';

// Turia Studio por pasos: proyecto, fotos (se suben al elegirlas), leer el boceto (IA simulada:
// no se llama a Gemini), revisar medidas con el alzado que se redibuja, guardar y recuperar.
const cota = (valorMm: number | null) => ({ valorMm, precision: valorMm === null ? 'desconocida' : 'aproximada', origen: 'boceto', confirmada: false });

async function foto(page: import('@playwright/test').Page) {
  const b64 = await page.evaluate(() => {
    const c = document.createElement('canvas');
    c.width = 400;
    c.height = 300;
    const k = c.getContext('2d')!;
    k.fillStyle = '#ccc';
    k.fillRect(0, 0, 400, 300);
    return c.toDataURL('image/png').split(',')[1]!;
  });
  return Buffer.from(b64, 'base64');
}

test('Studio: crear, subir fotos, leer el boceto, revisar medidas y recuperar el proyecto', async ({ page }) => {
  const errores: string[] = [];
  page.on('pageerror', (e) => errores.push(e.message));
  await page.goto('/panel/studio-bocetos');
  await expect(page.locator('#estado-boceto')).toHaveText(/Turia Studio listo/);
  await expect(page.locator('[data-version-codigo]')).toContainText('Versión del código');
  await auditar(page);

  const titulo = `Lavadero ${Date.now()}`;
  await page.getByLabel('Nombre del proyecto').fill(titulo);
  await page.getByRole('button', { name: 'Crear proyecto' }).click();
  await expect(page.locator('#estado-boceto')).toHaveText('Proyecto creado. Ahora sube las dos fotos.');
  await expect(page.locator('#nombre-proyecto')).toHaveText(titulo);
  const leer = page.getByRole('button', { name: 'Leer el boceto con IA' });
  await expect(leer).toBeDisabled();

  const png = await foto(page);
  await page.locator('#foto-espacio').setInputFiles({ name: 'espacio.png', mimeType: 'image/png', buffer: png });
  await expect(page.locator('#estado-boceto')).toHaveText('Foto guardada. Falta la otra.');
  await page.locator('#foto-dibujo').setInputFiles({ name: 'boceto.png', mimeType: 'image/png', buffer: png });
  await expect(page.locator('#estado-boceto')).toHaveText('Fotos guardadas. Ya puedes leer el boceto.');
  await expect(leer).toBeEnabled();
  await auditar(page);

  await page.route('**/api/panel/studio-interpretar', async (ruta) => {
    const { id } = ruta.request().postDataJSON();
    const bocetos = await (await page.request.get('/api/panel/studio-bocetos')).json();
    const b = bocetos.bocetos.find((x: { id: string }) => x.id === id);
    await ruta.fulfill({
      json: {
        revision: b.revision,
        interpretacion: { version: 1, estado: 'requiere-revision', categoria: 'mueble', fotoEspacioId: 'x', fotoBocetoId: 'y', obstaculos: [], preguntas: ['¿Altura del zócalo?'], modulos: [
          { id: 'modulo-0', tipo: 'cajonera', orden: 0, ancho: cota(800), alto: cota(850), fondo: cota(600), piezas: [{ id: 'pieza-0-0', tipo: 'cajon', catalogoVarianteId: null, acabadoId: null }] },
          { id: 'modulo-1', tipo: 'armario', orden: 1, ancho: cota(600), alto: cota(null), fondo: cota(600), piezas: [] },
        ] },
      },
    });
  });
  await leer.click();
  await expect(page.locator('#estado-boceto')).toHaveText(/He encontrado 2 módulos/);
  await expect(page.getByRole('heading', { name: '3. Revisar medidas y materiales' })).toBeVisible();
  await expect(page.locator('#plano svg')).toHaveCount(1);
  await expect(page.locator('#aviso-plano')).toContainText('alto del módulo 2');
  await expect(page.locator('#modulos fieldset').first().getByText('Aproximada (IA)').first()).toBeVisible();
  await expect(page.locator('#preguntas')).toContainText('¿Altura del zócalo?');
  await auditar(page);

  // Escribir una medida la confirma y redibuja el alzado.
  const svgAntes = await page.locator('#plano').innerHTML();
  const alto = page.locator('#modulos fieldset').nth(1).getByLabel('Alto (cm)');
  await alto.fill('210');
  await alto.dispatchEvent('change');
  await expect(page.locator('#aviso-plano')).toHaveText('Alzado con todas las medidas.');
  await expect(page.locator('#modulos fieldset').nth(1).getByText('Confirmada')).toBeVisible();
  expect(await page.locator('#plano').innerHTML()).not.toBe(svgAntes);
  await page.getByRole('button', { name: 'Guardar cambios' }).click();
  await expect(page.locator('#estado-boceto')).toHaveText('Cambios guardados.');
  // No se aprueba con medidas aproximadas sin confirmar; un botón las da por buenas.
  await page.getByRole('button', { name: 'Aprobar el diseño' }).click();
  await expect(page.locator('#estado-boceto')).toContainText('Aproximada (IA)');
  page.once('dialog', (d) => d.accept());
  await page.getByRole('button', { name: 'Dar por buenas las medidas de la IA' }).click();
  await expect(page.getByRole('button', { name: 'Dar por buenas las medidas de la IA' })).toBeHidden();
  await page.getByRole('button', { name: 'Guardar cambios' }).click();
  await expect(page.locator('#estado-boceto')).toHaveText('Cambios guardados.');

  // Al recargar, el proyecto sigue en la lista con sus fotos y medidas.
  await page.reload();
  await expect(page.locator('#estado-boceto')).toHaveText(/Turia Studio listo/);
  await page.locator('#lista-bocetos button', { hasText: titulo }).click();
  await expect(page.locator('#nombre-proyecto')).toHaveText(titulo);
  await expect(page.locator('#vista-espacio')).toBeVisible();
  await expect(page.locator('#modulos fieldset')).toHaveCount(2);
  await expect(page.locator('#modulos fieldset').nth(1).getByLabel('Alto (cm)')).toHaveValue('210');
  expect(errores).toEqual([]);
});

test('Studio: sin IA, se ponen las medidas a mano y se elige el material del catálogo', async ({ page }) => {
  // Catálogo de partida: artículos sin variantes, que también se pueden elegir.
  await page.goto('/panel/catalogo');
  const cargar = page.getByRole('button', { name: 'Cargar el catálogo de partida' });
  if (await cargar.isVisible()) await cargar.click();
  await page.goto('/panel/studio-bocetos');
  await expect(page.locator('#estado-boceto')).toHaveText(/Turia Studio listo/);
  const nombre = `Armario ${Date.now()}`;
  await page.getByLabel('Nombre del proyecto').fill(nombre);
  await page.getByRole('button', { name: 'Crear proyecto' }).click();
  await expect(page.locator('#editor-boceto')).toBeVisible();
  await page.getByRole('button', { name: 'Poner yo las medidas' }).click();
  await expect(page.locator('#modulos fieldset')).toHaveCount(1);
  for (const [d, v] of [['Ancho (cm)', '120'], ['Alto (cm)', '240'], ['Fondo (cm)', '60']]) {
    const campo = page.locator('#modulos fieldset').first().getByLabel(d);
    await campo.fill(v);
    await campo.dispatchEvent('change');
  }
  await expect(page.locator('#aviso-plano')).toHaveText('Alzado con todas las medidas.');
  await page.locator('#modulos fieldset').first().getByLabel('Qué lleva').fill('lavadora y secadora apiladas, altillo encima');
  await page.locator('#modulos fieldset').first().getByLabel('Qué lleva').dispatchEvent('change');
  await page.getByRole('button', { name: 'Añadir una pieza' }).click();
  await expect(page.locator('#modulos .st-pieza')).toHaveCount(1);
  // Elegir material: carga el catálogo al abrirlo, también los artículos sin variantes.
  await page.getByRole('button', { name: 'Elegir material' }).click();
  const materiales = page.getByRole('group', { name: 'Materiales del catálogo' }).locator('.st-material');
  await expect(materiales.first()).toBeVisible();
  expect(await materiales.count()).toBeGreaterThan(5);
  await page.getByLabel('Buscar material').fill('melamina');
  await expect(materiales.first()).toContainText(/melamina/i);
  await materiales.first().click();
  await expect(materiales.first()).toHaveAttribute('aria-pressed', 'true');
  await expect(page.locator('#modulos .st-elegido')).toContainText(/melamina/i);
  // Una puerta no ofrece cantos ni encimeras.
  await page.getByLabel('Buscar material').fill('canto');
  await expect(page.getByRole('group', { name: 'Materiales del catálogo' })).toContainText('No hay materiales para esta pieza');
  await page.getByRole('button', { name: 'Guardar cambios' }).click();
  await expect(page.locator('#estado-boceto')).toHaveText('Cambios guardados.');
  // Al recargar, se conservan las medidas en cm y lo que lleva el módulo.
  await page.reload();
  await expect(page.locator('#estado-boceto')).toHaveText(/Turia Studio listo/);
  await page.locator('#lista-bocetos button', { hasText: nombre }).click();
  await expect(page.locator('#modulos fieldset').first().getByLabel('Ancho (cm)')).toHaveValue('120');
  await expect(page.locator('#modulos fieldset').first().getByLabel('Qué lleva')).toHaveValue('lavadora y secadora apiladas, altillo encima');
  // Si la pieza pasa a ser un canto, solo se ofrecen cantos.
  await page.locator('#modulos .st-pieza').first().getByLabel('Pieza').selectOption('canto');
  await expect(page.locator('#modulos .st-elegido')).toContainText('Sin material');
  await page.getByRole('button', { name: 'Elegir material' }).click();
  const cantos = page.getByRole('group', { name: 'Materiales del catálogo' }).locator('.st-material');
  await expect(cantos.first()).toBeVisible();
  for (const texto of await cantos.allInnerTexts()) expect(texto).toMatch(/canto/i);
  await auditar(page);
});
