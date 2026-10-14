/** Mete un presupuesto de prueba en la D1 local (solo desarrollo y e2e). Datos inventados en example.com. */
import { reposLocales } from './plataforma.ts';

const { repos, cerrar } = await reposLocales();
try {
  for (const quien of ['movil', 'escritorio']) await repos.presupuestos.guardar({
    id: `prueba-${quien}-${Date.now()}`,
    fecha: new Date().toISOString(),
    estado: 'nuevo',
    idioma: 'es',
    tipoPedido: 'mayor',
    nombre: `Cliente de prueba ${quien}`,
    email: 'cliente@example.com',
    telefono: '+34 600 000 000',
    empresa: 'Jardines de prueba',
    provincia: 'Valencia',
    mensaje: '=Necesito 20 palmeras para una obra.',
    lineas: [{ especie: 'phoenix-canariensis', nombre: 'Palmera canaria', cantidad: 20 }],
  });
  console.log('Presupuestos de prueba guardados.');
} finally {
  await cerrar();
}
