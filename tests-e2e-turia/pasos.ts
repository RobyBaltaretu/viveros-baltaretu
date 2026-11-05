import type { Page } from '@playwright/test';

/** En el móvil, presupuesto y factura van por pasos: abre el paso si la guía está a la vista. */
export async function paso(page: Page, nombre: string) {
  const b = page.getByRole('list', { name: 'Pasos' }).getByRole('button', { name: new RegExp(nombre) });
  if (await b.isVisible()) await b.click();
}
