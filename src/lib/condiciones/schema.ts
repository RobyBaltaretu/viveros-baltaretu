import { z } from 'astro/zod';

const bilingue = z.object({ es: z.string().trim().min(1), en: z.string().trim().min(1) });

/** Condiciones de venta, editables desde el panel (singleton "Condiciones de venta"). */
export const esquemaCondiciones = z.object({
  /** Pedido mínimo de la venta al por mayor. */
  pedidoMinimo: bilingue,
  /** Plazos de entrega de los pedidos al por mayor. */
  plazosMayor: bilingue,
  /** Gastos y plazos de envío de la venta por unidad. */
  envioUnidad: bilingue,
});

export type Condiciones = z.infer<typeof esquemaCondiciones>;
