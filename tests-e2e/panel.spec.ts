import { expect, test } from '@playwright/test';
import { auditar, controlesGrandes } from './ayudas';

// El build de los e2e usa el entorno `desarrollo`: D1 local con el contenido importado
// y entrada al panel sin Access desde localhost como propietario@example.com.
const PANTALLAS = ['/panel', '/panel/personas', '/panel/plantas', '/panel/plantas/nueva', '/panel/plantas/washingtonia-robusta', '/panel/plantas/washingtonia-robusta/precio', '/panel/plantas/washingtonia-robusta/disponibilidad', '/panel/plantas/washingtonia-robusta/datos', '/panel/plantas/washingtonia-robusta/archivar', '/panel/plantas/phoenix-canariensis/fotos', '/panel/textos/ajustes/empresa', '/panel/textos/ajustes/portada?parte=pasos', '/panel/textos/ajustes/catalogo', '/panel/textos/paginas/reparto', '/panel/textos/proyectos', '/panel/textos/proyectos/proyecto-de-ejemplo', '/panel/textos/guias/nuevo', '/panel/publicar', '/panel/cambios', '/panel/plantas/washingtonia-robusta/vista', '/panel/presupuestos?estado=archivado', '/panel/asistente', '/panel/textos/proyectos/proyecto-de-ejemplo/fotos', '/panel/fotos', '/panel/textos', '/panel/ayuda', '/panel/presupuestos', '/panel/facturas', '/panel/facturas/nueva', '/panel/facturas/clientes', '/panel/facturas/clientes/nuevo', '/panel/facturas/datos', '/panel/gastos', '/panel/gastos/nuevo', '/panel/informes', '/panel/informes?periodo=anio'];

test.describe('panel: accesibilidad y tamaño de los controles', () => {
  for (const ruta of PANTALLAS) {
    test(ruta, async ({ page }) => {
      await page.goto(ruta);
      await expect(page.locator('h1')).toBeVisible();
      await auditar(page);
      await controlesGrandes(page);
    });
  }
});

test('inicio con las tarjetas principales', async ({ page }) => {
  await page.goto('/panel');
  for (const nombre of ['Mis plantas', 'Presupuestos recibidos', 'Fotos', 'Textos de la web', 'Ayuda']) {
    await expect(page.getByRole('link', { name: new RegExp(nombre) })).toBeVisible();
  }
});

test('el propietario da y quita acceso con el teclado', async ({ page }) => {
  // En la CI, con los dos proyectos a la vez, este recorrido puede pasar de 30 s.
  test.setTimeout(60_000);
  await page.goto('/panel/personas');
  const email = `gerente-${test.info().project.name}@example.com`;
  await page.getByLabel('Correo electrónico').fill(email);
  await page.getByLabel('Nombre', { exact: true }).fill('Gerente');
  await page.getByLabel('Nombre', { exact: true }).press('Tab');
  await page.getByRole('button', { name: 'Dar acceso' }).press('Enter');
  await expect(page.getByRole('status')).toHaveText('Hecho.');
  const fila = page.getByRole('listitem').filter({ hasText: email });
  await fila.getByRole('button', { name: 'Quitar acceso' }).click();
  await expect(page.getByRole('listitem').filter({ hasText: email })).toContainText('sin acceso');
});

test('las peticiones de otra web se rechazan', async ({ request }) => {
  const r = await request.post('/panel/personas', { headers: { Origin: 'https://malo.example.com' }, form: { accion: 'alta', email: 'x@example.com' } });
  expect(r.status()).toBe(403);
});

test('alta guiada de una planta, paso a paso', async ({ page }) => {
  const nombre = `Olivo prueba ${test.info().project.name}`;
  await page.goto('/panel/plantas/nueva');
  await page.getByLabel('Nombre en la web').fill(nombre);
  await page.getByLabel('Nombre científico').fill('Olea europaea');
  await page.getByRole('button', { name: 'Siguiente' }).click();
  await page.getByLabel('Olivos').check();
  await page.getByRole('button', { name: 'Siguiente' }).click();
  await page.getByLabel(/Altura más baja/).fill('1,5');
  await page.getByLabel(/Altura más alta/).fill('5');
  await page.getByRole('button', { name: 'Siguiente' }).click();
  await expect(page.getByRole('alert')).toContainText('hasta 4 m');
  await page.getByLabel(/Altura más alta/).fill('3');
  await page.getByRole('button', { name: 'Siguiente' }).click();
  await page.getByLabel(/Precio al por mayor/).fill('25');
  await page.getByRole('button', { name: 'Siguiente' }).click();
  await page.getByLabel('Disponible', { exact: true }).check();
  await page.getByLabel('Contenedor').check();
  await page.getByRole('button', { name: 'Siguiente' }).click();
  await page.getByLabel('Descripción', { exact: true }).fill('Olivo joven en contenedor.');
  await page.getByLabel('Nombre en inglés').fill('Olive tree');
  await page.getByLabel('Descripción en inglés').fill('Young olive tree in a container.');
  await page.getByRole('button', { name: 'Siguiente' }).click();
  await page.getByLabel('Origen de la planta').fill('Valencia');
  await auditar(page);
  await page.getByRole('button', { name: 'Guardar la planta' }).click();
  // Tras el alta, el panel lleva a añadir fotos.
  await expect(page.getByRole('heading', { level: 1 })).toHaveText(`Fotos de ${nombre}`);
  await expect(page.getByRole('status').first()).toContainText('Ahora añade una foto');
  await page.getByLabel('Añadir una foto').setInputFiles('src/assets/catalogo/phoenix-canariensis/foto-prueba-1.jpg');
  await page.getByRole('button', { name: 'Subir la foto' }).click();
  await expect(page.getByRole('status').first()).toContainText('Foto subida');
  await expect(page.getByRole('img', { name: `${nombre} en el vivero` })).toBeVisible();
  await expect.poll(() => page.getByRole('img').first().evaluate((i: HTMLImageElement) => i.naturalWidth)).toBeGreaterThan(0);
  await page.getByLabel('Qué se ve en la foto').fill('Olivo joven en maceta');
  await page.getByRole('button', { name: 'Guardar el texto' }).click();
  await expect(page.getByRole('img', { name: 'Olivo joven en maceta' })).toBeVisible();
  await auditar(page);
  await page.getByRole('link', { name: '← Volver' }).click();
  await expect(page.getByRole('heading', { level: 1 })).toHaveText(nombre);
  await expect(page.getByText('Falta marcarla como revisada')).toBeVisible();

  await page.getByRole('link', { name: 'Cambiar el precio' }).click();
  await page.getByLabel(/Precio de una planta suelta/).fill('40');
  await page.getByRole('button', { name: 'Guardar el precio' }).click();
  await expect(page.getByRole('alert')).toContainText('solo se usa si la planta también se vende por unidad');
  await page.getByLabel('También se vende por unidad, con envío').check();
  await page.getByRole('button', { name: 'Guardar el precio' }).click();
  await expect(page.getByText('sí, desde 40 €')).toBeVisible();

  await page.getByRole('link', { name: 'Quitar de la web (archivar)' }).click();
  await page.getByRole('button', { name: 'Sí, quitarla' }).click();
  await expect(page.getByRole('status')).toContainText('Planta quitada');
  await expect(page.getByRole('link', { name: new RegExp(nombre) })).toHaveCount(0);
});

test('textos: cambiar condiciones, añadir un paso y crear una guía', async ({ page }) => {
  const p = test.info().project.name;
  await page.goto('/panel/textos/ajustes/condiciones');
  const minimo = page.getByRole('group', { name: 'Pedido mínimo' }).getByLabel('En español');
  await minimo.fill('');
  await page.getByRole('button', { name: 'Guardar' }).click();
  await expect(page.getByRole('alert')).toContainText('Falta: Pedido mínimo (en español).');
  await page.getByRole('group', { name: 'Pedido mínimo' }).getByLabel('En español').fill(`Mínimo 10 plantas (${p})`);
  await page.getByRole('button', { name: 'Guardar' }).click();
  await expect(page.getByRole('status')).toContainText('Guardado');
  await expect(page.getByRole('group', { name: 'Pedido mínimo' }).getByLabel('En español')).toHaveValue(`Mínimo 10 plantas (${p})`);

  await page.goto('/panel/textos/guias/nuevo');
  await page.getByRole('group', { name: 'Título', exact: true }).first().getByLabel('En español').fill(`Guía de riego ${p}`);
  await page.getByRole('button', { name: 'Añadir otro' }).click();
  await expect(page.getByRole('status')).toContainText('Rellena el nuevo apartado');
  await expect(page.getByRole('group', { name: 'Apartados · 2' })).toBeVisible();
  await page.getByRole('button', { name: 'Quitar este' }).nth(1).click();
  await expect(page.getByRole('group', { name: 'Apartados · 2' })).toHaveCount(0);
  for (const [grupo, es, en] of [
    ['Título', `Guía de riego ${p}`, 'Watering guide'],
    ['Resumen', 'Cuándo regar.', 'When to water.'],
    ['Resumen para Google (una o dos frases)', 'Guía de riego.', 'Watering guide.'],
  ]) {
    const g = page.getByRole('group', { name: grupo, exact: true }).first();
    await g.getByLabel('En español').fill(es);
    await g.getByLabel('En inglés').fill(en);
  }
  const apartado = page.getByRole('group', { name: 'Apartados · 1' });
  await apartado.getByRole('group', { name: 'Título' }).getByLabel('En español').fill('Verano');
  await apartado.getByRole('group', { name: 'Título' }).getByLabel('En inglés').fill('Summer');
  await apartado.getByRole('group', { name: 'Texto' }).getByLabel('En español').fill('Riega al atardecer.');
  await apartado.getByRole('group', { name: 'Texto' }).getByLabel('En inglés').fill('Water at dusk.');
  await page.getByRole('button', { name: 'Guardar' }).click();
  await expect(page.getByRole('status')).toContainText('Guardado');
  await expect(page.getByRole('heading', { level: 1 })).toHaveText(`Guía de riego ${p}`);
  await auditar(page);
});

test('publicar cambios y deshacer', async ({ page }) => {
  const [id, nombre] = test.info().project.name === 'movil' ? ['cycas-revoluta', 'Cica'] : ['higuera-comun', 'Higuera'];
  await page.goto(`/panel/plantas/${id}/precio`);
  await page.getByLabel(/Precio al por mayor/).fill('77');
  await page.getByRole('button', { name: 'Guardar el precio' }).click();
  await page.goto('/panel/publicar');
  await expect(page.getByRole('listitem').filter({ hasText: new RegExp(`Planta: ${nombre}.*cambiada`) })).toBeVisible();
  await page.getByRole('button', { name: /Sí, publicar/ }).click();
  // En local no hay Deploy Hook: los cambios quedan listos y el panel lo explica.
  await expect(page.getByRole('status')).toContainText('falta configurar la publicación automática');

  await page.goto('/panel/cambios');
  const fila = page.getByRole('listitem').filter({ hasText: new RegExp(`Planta: ${nombre}.*: cambiada`) }).first();
  await fila.getByRole('button', { name: 'Deshacer' }).click();
  await expect(page.getByRole('status')).toContainText('Deshecho');
  await page.goto(`/panel/plantas/${id}`);
  await expect(page.getByText('desde 77 €')).toHaveCount(0);
});

test('la ayuda se abre con el teclado', async ({ page }) => {
  await page.goto('/panel/ayuda');
  const tema = page.locator('details#publicar');
  await tema.locator('summary').focus();
  await page.keyboard.press('Enter');
  await expect(tema).toHaveAttribute('open', '');
  await expect(tema.getByRole('link', { name: 'Ir a Publicar cambios' })).toBeVisible();
  await auditar(page);
});

test('bandeja de presupuestos: ver, marcar como respondido y descargar', async ({ page }) => {
  const nombre = `Cliente de prueba ${test.info().project.name}`;
  await page.goto('/panel/presupuestos');
  await page.getByRole('link', { name: new RegExp(nombre) }).click();
  await expect(page.getByRole('heading', { level: 1 })).toHaveText(nombre);
  await expect(page.getByText('20 × Palmera canaria')).toBeVisible();
  await auditar(page);
  await controlesGrandes(page);
  await page.getByRole('button', { name: 'Marcar como respondido' }).click();
  await expect(page.getByRole('status')).toHaveText('Marcado como respondido.');
  await page.goto('/panel/presupuestos?estado=respondido');
  await expect(page.getByRole('link', { name: new RegExp(nombre) })).toBeVisible();
  const descarga = page.waitForEvent('download');
  await page.getByRole('link', { name: 'Descargar todos en una hoja de cálculo' }).click();
  const csv = await (await descarga).createReadStream();
  let texto = '';
  for await (const trozo of csv) texto += trozo;
  expect(texto).toContain(nombre);
  // Un texto que empieza por "=" no se convierte en fórmula al abrirlo en Excel.
  expect(texto).toContain(`"'=Necesito 20 palmeras`);
});

test('asistente guiado: cambiar un precio con confirmación', async ({ page }) => {
  const planta = test.info().project.name === 'movil' ? 'Palmito' : 'Yuca';
  await page.goto('/panel/asistente');
  await page.getByRole('button', { name: 'Cambiar un precio' }).click();
  await expect(page.getByRole('status')).toHaveText('¿De qué planta?');
  await page.getByRole('button', { name: planta, exact: true }).click();
  await page.getByLabel('¿Cuál es el precio nuevo, en euros?').fill('31');
  await page.getByRole('button', { name: 'Siguiente' }).click();
  await expect(page.getByRole('status')).toContainText(`Voy a cambiar el precio de ${planta}`);
  await auditar(page);
  await controlesGrandes(page);
  await page.getByRole('button', { name: 'No' }).click();
  await expect(page.getByRole('status')).toHaveText('Vale, no he cambiado nada.');

  await page.getByRole('button', { name: 'Cambiar un precio' }).click();
  await page.getByRole('button', { name: planta, exact: true }).click();
  await page.getByLabel('¿Cuál es el precio nuevo, en euros?').fill('31');
  await page.getByRole('button', { name: 'Siguiente' }).click();
  await page.getByRole('button', { name: 'Sí, hazlo' }).click();
  await expect(page.getByRole('status')).toContainText('Hecho');
  await page.getByRole('button', { name: '¿Cuántos presupuestos nuevos hay?' }).click();
  await expect(page.getByRole('status')).toContainText('presupuesto');
});

test('asistente: lenguaje natural con confirmación y rechazo de otros temas', async ({ page }) => {
  await page.goto('/panel/asistente');
  await page.getByLabel('Escribe lo que quieres hacer').fill('el naranjo amargo esta agotado');
  await page.getByRole('button', { name: 'Enviar' }).click();
  await expect(page.getByRole('status')).toContainText('Voy a marcar Naranjo amargo como «agotado»');
  await expect(page.getByRole('button', { name: 'Sí, hazlo' })).toBeVisible();
  await page.getByRole('button', { name: 'No' }).click();
  await page.getByLabel('Escribe lo que quieres hacer').fill('escríbeme un poema');
  await page.getByRole('button', { name: 'Enviar' }).click();
  await expect(page.getByRole('status')).toContainText('Solo puedo ayudarte con el panel y el vivero');
  await auditar(page);
});

test('fotos de un proyecto y dibujo de una planta', async ({ page }) => {
  await page.goto('/panel/textos/proyectos/proyecto-de-ejemplo');
  await page.getByRole('link', { name: 'Fotos del proyecto' }).click();
  await page.getByLabel('Añadir una foto').setInputFiles('src/assets/catalogo/phoenix-canariensis/foto-prueba-1.jpg');
  await page.getByRole('button', { name: 'Subir la foto' }).click();
  await expect(page.getByRole('status').first()).toContainText('Foto subida');
  await expect(page.getByRole('img').first()).toHaveAttribute('alt', /^Proyecto:/);
  await page.goto('/panel/plantas/naranjo-amargo/datos');
  await expect(page.getByLabel(/Dibujo mientras no haya foto/)).toBeVisible();
  await expect(page.getByLabel('Es una ficha de ejemplo (no se publica)')).toBeChecked();
});

test('navegación: menú fijo y, tras guardar, ir atrás no vuelve al formulario', async ({ page }) => {
  await page.goto('/panel/plantas/washingtonia-robusta');
  const menu = page.getByRole('navigation', { name: 'Secciones del panel' });
  await expect(menu.getByRole('link', { name: 'Plantas' })).toHaveAttribute('aria-current', 'page');
  await page.getByRole('link', { name: 'Cambiar el precio' }).click();
  await page.getByRole('button', { name: 'Guardar el precio' }).click();
  await expect(page).toHaveURL(/\/panel\/plantas\/washingtonia-robusta$/);
  await page.goBack();
  await expect(page).toHaveURL(/\/panel\/plantas\/washingtonia-robusta$/);
  await expect(page.getByRole('button', { name: 'Guardar el precio' })).toHaveCount(0);
  await menu.getByRole('link', { name: 'Inicio' }).click();
  await expect(page.getByRole('heading', { level: 1 })).toContainText('Hola');
});

test('facturas: datos, cliente, borrador, emitir, PDF y cobro', async ({ page, request }) => {
  test.setTimeout(90_000);
  const p = test.info().project.name;
  await page.goto('/panel/facturas/datos');
  await page.getByLabel('Razón social o nombre').fill('Viveros Prueba SL');
  await page.getByLabel('NIF').fill('B12345675');
  await page.getByLabel('Dirección').fill('Camino del Vivero 12');
  await page.getByLabel('Código postal').fill('46000');
  await page.getByLabel('Población').fill('Valencia');
  await page.getByLabel('Provincia').fill('Valencia');
  await page.getByRole('button', { name: 'Guardar' }).click();
  await expect(page.getByRole('alert')).toContainText('El NIF no es correcto');
  await page.getByLabel('NIF').fill('B12345674');
  await page.getByRole('button', { name: 'Guardar' }).click();
  await expect(page.getByRole('status')).toContainText('Guardado');

  await page.goto('/panel/facturas/nueva');
  await page.getByRole('link', { name: 'A un cliente nuevo' }).click();
  await page.getByLabel('Razón social o nombre completo').fill(`Jardinería ${p} SL`);
  await page.getByRole('button', { name: 'Guardar y seguir con la factura' }).click();
  await page.getByRole('button', { name: 'Empezar la factura' }).click();
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Factura (borrador)');
  await auditar(page);
  await controlesGrandes(page);

  await page.getByLabel('Concepto').fill('Olivo en maceta');
  await page.getByLabel('Cantidad').fill('10');
  await page.getByLabel('Precio sin IVA (€)').fill('25,50');
  await expect(page.locator('[data-total]')).toHaveText('280,50 €');
  await page.getByRole('button', { name: 'Añadir una línea en blanco' }).click();
  await expect(page.getByRole('group', { name: 'Línea 2' })).toBeVisible();
  await page.getByRole('group', { name: 'Línea 2' }).getByLabel('Concepto').fill('Transporte');
  await page.getByRole('group', { name: 'Línea 2' }).getByLabel('Precio sin IVA (€)').fill('60');
  await page.getByRole('group', { name: 'Línea 2' }).getByLabel('IVA', { exact: true }).selectOption('21');
  await page.getByRole('button', { name: 'Emitir la factura' }).click();
  // Al cliente le faltan el NIF y la dirección: no se puede emitir.
  await expect(page.getByRole('alert')).toContainText('Falta el NIF del cliente');
  const borrador = page.url();
  await page.getByRole('link', { name: `Jardinería ${p} SL` }).click();
  await page.getByLabel('NIF').fill('A58818501');
  await page.getByLabel('Dirección').fill('Calle Mayor 2');
  await page.getByLabel('Código postal').fill('28001');
  await page.getByLabel('Población').fill('Madrid');
  await page.getByRole('button', { name: 'Guardar' }).click();
  await expect(page.getByRole('status')).toContainText('Guardado');
  await page.goto(borrador);
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Factura (borrador)');
  await page.getByRole('button', { name: 'Emitir la factura' }).click();
  await expect(page.getByRole('heading', { name: '¿Emitir la factura?' })).toBeVisible();
  await expect(page.getByText('353,10 €')).toBeVisible();
  await page.getByRole('button', { name: 'Sí, emitir' }).click();
  await expect(page.getByRole('status')).toContainText('Factura emitida');
  await expect(page.getByRole('heading', { level: 1 })).toContainText(/Factura F\d{4}-\d{4}/);
  await auditar(page);

  const pdf = await request.get(await page.getByRole('link', { name: 'Ver el PDF' }).getAttribute('href') ?? '');
  expect(pdf.headers()['content-type']).toBe('application/pdf');
  expect((await pdf.body()).subarray(0, 5).toString()).toBe('%PDF-');

  await page.getByRole('button', { name: 'Marcar como cobrada' }).click();
  await expect(page.getByRole('status')).toContainText('cobrada');
  const csv = await request.get(`/api/panel/facturas.csv?anio=${new Date().getFullYear()}`);
  expect(await csv.text()).toContain(`Jardinería ${p} SL`);
});

test('gastos: subir la foto de un ticket, revisarlo y guardarlo', async ({ page }) => {
  test.setTimeout(60_000);
  const p = test.info().project.name;
  await page.goto('/panel/gastos/nuevo');
  await page.getByLabel('Foto del ticket').setInputFiles('src/assets/catalogo/phoenix-canariensis/foto-prueba-1.jpg');
  await page.getByRole('button', { name: 'Leer el ticket' }).click();
  // En las pruebas no hay lector automático: se escribe a mano mirando la foto.
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Revisar el gasto');
  await expect(page.getByRole('status')).toContainText('Escribe los datos mirando la foto');
  await expect(page.getByRole('img', { name: 'Foto del ticket de compra' })).toBeVisible();
  await auditar(page);
  await controlesGrandes(page);
  await page.getByLabel('Dónde se compró').fill(`Agrícola ${p}`);
  await page.getByLabel('Tipo de gasto').selectOption({ label: 'Sustratos y abonos' });
  await page.getByLabel('Concepto').fill('Sustrato 70 l');
  await page.getByLabel('Importe (€)').fill('23,85');
  await page.getByLabel('Total pagado (€)').fill('23,85');
  await page.getByRole('button', { name: 'Guardar el gasto' }).click();
  await expect(page.getByRole('status')).toContainText('Gasto guardado');
  await expect(page.getByRole('link', { name: new RegExp(`Agrícola ${p}`) })).toBeVisible();
  await auditar(page);
});
