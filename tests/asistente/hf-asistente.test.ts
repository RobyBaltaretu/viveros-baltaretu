import { describe, expect, test } from 'vitest';
import { processCarpentryAssistantMessage } from '../../src/services/aiAssistantService.ts';

describe('Asistente Operativo de Carpintería (Hugging Face)', () => {
  test('processCarpentryAssistantMessage procesa peticiones de facturas localmente cuando no hay token', async () => {
    const result = await processCarpentryAssistantMessage('Crear borrador de factura de 580€ para Cliente Taller');

    expect(result.ok).toBe(true);
    expect(result.actionExecuted).toBeDefined();
    expect(result.actionExecuted?.type).toBe('createInvoice');
    expect(result.actionExecuted?.title).toContain('Factura');
  });

  test('processCarpentryAssistantMessage procesa altas de material localmente', async () => {
    const result = await processCarpentryAssistantMessage('Dar de alta tablero Roble Maya 19mm a 48.50€');

    expect(result.ok).toBe(true);
    expect(result.actionExecuted).toBeDefined();
    expect(result.actionExecuted?.type).toBe('registerMaterial');
    expect(result.actionExecuted?.details.nombre).toContain('Roble');
  });

  test('processCarpentryAssistantMessage procesa consultas de inventario', async () => {
    const result = await processCarpentryAssistantMessage('Consultar inventario de tableros en almacén');

    expect(result.ok).toBe(true);
    expect(result.actionExecuted).toBeDefined();
    expect(result.actionExecuted?.type).toBe('checkInventory');
  });

  test('processCarpentryAssistantMessage calcula estimaciones de reforma', async () => {
    const result = await processCarpentryAssistantMessage('Calcular presupuesto reforma cocina 12m2 calidad premium');

    expect(result.ok).toBe(true);
    expect(result.actionExecuted).toBeDefined();
    expect(result.actionExecuted?.type).toBe('generateRenovationEstimate');
    expect(result.actionExecuted?.summary).toContain('12 m²');
  });
});
