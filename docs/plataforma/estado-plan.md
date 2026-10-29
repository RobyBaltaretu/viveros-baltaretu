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
| 1.6 (rehecha) Sin web pública, sin zona «Web» | En revisión | En clientes sin `webPublica`: no hay textos, publicar ni cambios, ni sus herramientas, ni `/api/contenido/*`. Los tipos de contenido declarativos quedan aplazados hasta que un cliente con web pública los necesite. **F1 terminada.** |

## Siguiente

1. **2.1** Portafolio privado: proyectos y fotos (migración 10).
2. **2.2** Pantallas del portafolio con el comparador antes/después.
3. **3.1** Presupuestos a cliente con PDF y paso a factura.

## Avisos para la próxima sesión

- El JS del navegador (`_astro/*.js`) cuenta en la línea base: un cambio en un script del cliente cambia la web de Baltaretu. Lo que dependa del cliente en el navegador debe llegar como datos desde la página, sin tocar el script común.

- Toda pantalla o API nueva del panel tiene que estar en `src/plataforma/modulos.ts` o en la lista del núcleo de `tests/plataforma/modulos.test.ts` (el test lo exige).

- Turia **no tiene web pública**: solo un portafolio privado en el panel (F2 rehecha). Se trabaja **por orden**.

- Si una comprobación de `tests/baseline/` falla, **se para**: o es un error o es un cambio que tiene que aprobar el propietario (`npm run baseline:actualizar` solo entonces).

- La próxima migración es la **10** ([D-01](discrepancias.md)).
- Decisiones del propietario del 29-10-2026 en `preguntas.md` («Respuestas»): pasar a Workers Paid más adelante, cupo de IA pensado sobre todo para Turia, datos de Baltaretu en D1 desechables, Turia = `creacionesturia` y no fusionar la PR 61.
- `developers.cloudflare.com` no se puede abrir desde la sesión. Las cifras van «por confirmar» ([P-07](preguntas.md)).
- Prettier no tiene configuración en el repositorio. **No se pasa a archivos existentes**: reformatea todo ([D-15](discrepancias.md)).
