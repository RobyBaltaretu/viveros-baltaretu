# Estado del plan

Cada sesión **empieza por aquí** y lo actualiza al cerrar cada PR. El plan está en [plan.md](plan.md); las dudas abiertas, en [preguntas.md](preguntas.md).

## Hecho

| PR | Estado | Notas |
| --- | --- | --- |
| 0.1 Documentación e inventario de acoplamientos | Fusionada (#62) | Este documento y los demás de `docs/plataforma/`. |
| 0.2 Red de seguridad | Fusionada (#63) | `tests/baseline/`: web (producción y pruebas), esquema y migración de D1, panel y asistente por rol. Ver `tests/baseline/README.md`. |
| 1.1 Configuración de clientes | Fusionada (#64) | `clientes/<id>/cliente.config.json` (Baltaretu = valores de hoy; Turia en español, IVA 21 % fijo), esquema en `src/plataforma/configuracion.ts`, carga en `astro.config.mjs` (inyecta `CLIENTE_ID` y la configuración) y `clienteActual()`. Todavía no la lee ninguna página. |
| Turia sin web pública (F2 rehecha) | Fusionada (#66) | Portafolio privado en el panel. |
| 1.2 Módulos | Fusionada (#67) | `src/plataforma/modulos.ts`: rutas y herramientas por módulo. Un módulo apagado no sale en el menú, da 404 en el middleware (también `/api/presupuesto`) y el asistente no lo ve ni puede aplicarlo. `ProveedorDeAcceso` en `acceso.ts` (Cloudflare Access por defecto). |
| 1.3 Tema por cliente | Fusionada (#68) | `src/plataforma/tema.ts` y `TemaCliente.astro`: si los colores del cliente no son los del núcleo, un `<style>` con `html:root` en la cabecera (gana a `@theme`). Turia con colores provisionales en tonos madera (T-18). `tests/tokens.test.ts` recorre todos los clientes. Pendiente: colores del PDF por cliente, en 3.2 (tocarlos ahora cambiaría el JS de Baltaretu). |
| 1.4 Web pública por cliente | Fusionada (#69) | `webPublica: false` (Turia): del build solo queda el panel, la portada lleva a `/panel` y robots bloquea todo. El idioma único con web pública queda aplazado hasta que haga falta. |
| 1.5 Vocabulario por sector | Fusionada (#70) | `paquetes-sector/<sector>/vocabulario.ts` (título del panel, nombre del asistente y zona del catálogo) y `marca` en la configuración (nombre corto y monograma, o iniciales). Las pantallas y herramientas de plantas, inventario y fotos son del sector vivero: en Turia no existen. Turia: «Creaciones Turia», «Panel de la carpintería», «Asistente». Pendiente para 3.11: el nombre dentro del chat del asistente (está en su script del navegador). |
| 1.6 (rehecha) Sin web pública, sin zona «Web» | Fusionada (#71) | En clientes sin `webPublica`: no hay textos, publicar ni cambios, ni sus herramientas, ni `/api/contenido/*`. Los tipos de contenido declarativos quedan aplazados hasta que un cliente con web pública los necesite. **F1 terminada.** |
| 2.1 Portafolio privado: datos | Fusionada (#72) | **Migración 10** (`adjuntos` y `portafolio`, solo aditiva: la base de la versión 9 migra sin pérdidas). Repositorios en `src/server/data/d1/portafolio.ts`; reglas en `src/server/portafolio/portafolio.ts` (validación; fotos de antes y después comprobadas por sus bytes, como mucho 1,9 MB y 8 por lado; nunca en `fotos`). |
| 2.2 Portafolio privado: pantallas | Fusionada (#73) | `/panel/portafolio`: lista con filtro por tipo de trabajo, alta, ficha con **comparador antes/después** (control deslizante nativo, con teclado y `aria-valuetext`), datos y fotos (se reducen en el móvil antes de subir). API privada `/api/panel/adjunto`. Datos de ejemplo de Turia en «Datos de prueba». e2e propios: `npm run test:e2e:turia` (también en la CI). Mismo permiso que el inventario (propietario y gerente, P-13). **F2 terminada.** |
| Turia desplegable | Fusionada (#74) | `wrangler.creacionesturia.jsonc` (Worker y D1 `creacionesturia`) y `cloudflare.wrangler` en la configuración: el adaptador lo usa con `CLIENTE_ID=turia` (Baltaretu sigue con `wrangler.jsonc`). Pasos en `docs/panel-propio/pasos-manuales.md` («Creaciones Turia»). Falta el id real de la D1 (lo crea el propietario). |
| 3.1a Presupuestos a cliente: datos | En revisión | **Migración 11** (`presupuestos_cliente`, solo aditiva). Cálculo en céntimos (`calcularPresupuesto`: total con IVA, anticipo = total × %, restante; los extras no suman), numeración correlativa `P2026-0001` por serie y año (sin repetidos, también con altas a la vez), estados (borrador → enviado → aceptado/rechazado; caduca al pasar la validez), cobros del anticipo y del resto, IVA fijo del cliente. |

## Siguiente

1. **3.1b** Presupuestos a cliente: pantallas, versión para imprimir o guardar en PDF, envío (correo y WhatsApp) y paso a factura (de anticipo o completa).
2. **3.2** Clientes y facturas con IVA fijo (y colores del PDF por cliente).
3. **3.3** Inicio con resumen, alertas y accesos.

## Avisos para la próxima sesión

- Las pantallas nuevas del panel usan **solo clases de Tailwind que ya existen** y `<style is:inline>` / `<script is:inline>`: así no cambian el CSS ni el JS públicos de Baltaretu (la línea base lo vigila).
- Para ver Turia en local: `CLIENTE_ID=turia CLOUDFLARE_ENV=desarrollo npm run build && npx astro preview`, y en «Ajustes › Datos de prueba» cargar los ejemplos.

- El JS del navegador (`_astro/*.js`) cuenta en la línea base: un cambio en un script del cliente cambia la web de Baltaretu. Lo que dependa del cliente en el navegador debe llegar como datos desde la página, sin tocar el script común.

- Toda pantalla o API nueva del panel tiene que estar en `src/plataforma/modulos.ts` o en la lista del núcleo de `tests/plataforma/modulos.test.ts` (el test lo exige).

- Turia **no tiene web pública**: solo un portafolio privado en el panel (F2 rehecha). Se trabaja **por orden**.

- Si una comprobación de `tests/baseline/` falla, **se para**: o es un error o es un cambio que tiene que aprobar el propietario (`npm run baseline:actualizar` solo entonces).

- La próxima migración es la **12** (10: portafolio; 11: presupuestos a cliente).
- Decisiones del propietario del 29-10-2026 en `preguntas.md` («Respuestas»): pasar a Workers Paid más adelante, cupo de IA pensado sobre todo para Turia, datos de Baltaretu en D1 desechables, Turia = `creacionesturia` y no fusionar la PR 61.
- `developers.cloudflare.com` no se puede abrir desde la sesión. Las cifras van «por confirmar» ([P-07](preguntas.md)).
- Prettier no tiene configuración en el repositorio. **No se pasa a archivos existentes**: reformatea todo ([D-15](discrepancias.md)).
