# Red de seguridad de Viveros Baltaretu

Viveros Baltaretu es el cliente en producción. Mientras el repositorio evoluciona hacia una plataforma para varios clientes (`docs/plataforma/`), su web, su panel, sus datos y su asistente tienen que seguir exactamente igual. Esta carpeta guarda una **línea base** con lo que hoy genera el código, y la CI falla si algo cambia.

| Archivo | Qué guarda | Lo comprueba |
| --- | --- | --- |
| `web-produccion.json` | Build de producción (sin fichas de ejemplo): rutas generadas; huella del HTML de cada página en es y en; huella de CSS, JS, JSON, `_headers`…; huella del JSON-LD por página; sitemap y robots.txt enteros. | `npm run contenido:equivalencia` (trabajo «Build desde D1 igual al actual» de la CI) |
| `web-pruebas.json` | Lo mismo con `WORKERS_CI_BRANCH=pruebas`, es decir, con las fichas de ejemplo y los datos de prueba. | Igual, en su segunda pasada |
| `d1-esquema.json` | Esquema de D1 tras todas las migraciones: tablas, columnas, índices, SQL y versión. | `tests/baseline/d1.test.ts` (`npm test`) |
| `d1-datos.json` | Una base en la versión 9 con datos sintéticos en todas las tablas (contenido del repositorio, datos de prueba del panel, usuarios, asistente, inventario…). | `tests/baseline/d1.test.ts`: se carga, se migra a la última versión y ninguna fila ni columna puede cambiar o desaparecer. |
| `panel-navegacion.json` | Por rol: permisos, zonas y pestañas del panel y barra del móvil. | `tests/baseline/panel.test.ts` |
| `asistente-herramientas.json` | Herramientas del asistente (nombre, tipo, permiso y huella de su descripción y argumentos), las que tiene cada rol y la huella de las instrucciones. | `tests/baseline/panel.test.ts` |

## Qué no cubre (y cómo se cubre)

- **El contenido real de producción.** El build de producción descarga el contenido publicado desde D1 (`scripts/contenido/descargar.ts`). La línea base se hace con los archivos del repositorio. Lo que prueba es que, con el mismo contenido, el código genera la misma web. Que el contenido de D1 da la misma web que los archivos lo prueba la propia equivalencia.
- **Los bytes de las imágenes y fuentes.** Su codificación puede variar entre máquinas, así que solo cuentan por su nombre. El nombre ya lleva el hash de su origen.
- **El año del pie** (© AAAA). Se normaliza para que la CI no falle cada 1 de enero.
- **El panel en el navegador.** Lo cubren los e2e existentes (`tests-e2e/`), con sus mismas expectativas.

## Si una comprobación falla

1. Lee la lista de diferencias, que nombra rutas, páginas o tablas.
2. Si el cambio **no** es a propósito, es un fallo: corrígelo.
3. Si es a propósito, el PR se detiene. Hay que explicar por qué cambia Baltaretu y debe aprobarlo el propietario. Solo entonces se ejecuta:
   - `npm run baseline:actualizar`, para la web, el panel y el esquema;
   - `npx tsx scripts/baseline/generar-d1.ts`, solo si se quiere una base de datos de referencia nueva, en un PR propio.

   Después se revisa el diff de esta carpeta en el PR.

Las migraciones nuevas no necesitan regenerar `d1-datos.json`. El test aplica las nuevas sobre esa base y comprueba que no se pierde nada. Solo cambia `d1-esquema.json`, y esas diferencias deben ser únicamente aditivas: tablas, columnas o índices nuevos.

Aquí no hay secretos ni datos personales: todo es sintético, con correos en example.com.
