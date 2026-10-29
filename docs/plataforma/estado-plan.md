# Estado del plan

Cada sesión **empieza por aquí** y lo actualiza al cerrar cada PR. El plan está en [plan.md](plan.md); las dudas abiertas, en [preguntas.md](preguntas.md).

## Hecho

| PR | Estado | Notas |
| --- | --- | --- |
| 0.1 Documentación e inventario de acoplamientos | Fusionada (#62) | Este documento y los demás de `docs/plataforma/`. |
| 0.2 Red de seguridad | Fusionada (#63) | `tests/baseline/`: web (producción y pruebas), esquema y migración de D1, panel y asistente por rol. Ver `tests/baseline/README.md`. |
| 1.1 Configuración de clientes | Fusionada (#64) | `clientes/<id>/cliente.config.json` (Baltaretu = valores de hoy; Turia en español, IVA 21 % fijo), esquema en `src/plataforma/configuracion.ts`, carga en `astro.config.mjs` (inyecta `CLIENTE_ID` y la configuración) y `clienteActual()`. Todavía no la lee ninguna página. |

## Siguiente

1. **1.2** (en curso) Módulos con guardias (navegación, middleware, API y asistente) y `ProveedorDeAcceso`.
2. **1.3** Tema por cliente.
3. **1.4** Idiomas por cliente.

## Avisos para la próxima sesión

- Turia **no tiene web pública**: solo un portafolio privado en el panel (F2 rehecha). Se trabaja **por orden**.

- Si una comprobación de `tests/baseline/` falla, **se para**: o es un error o es un cambio que tiene que aprobar el propietario (`npm run baseline:actualizar` solo entonces).

- La próxima migración es la **10** ([D-01](discrepancias.md)).
- Decisiones del propietario del 29-10-2026 en `preguntas.md` («Respuestas»): pasar a Workers Paid más adelante, cupo de IA pensado sobre todo para Turia, datos de Baltaretu en D1 desechables, Turia = `creacionesturia` y no fusionar la PR 61.
- `developers.cloudflare.com` no se puede abrir desde la sesión. Las cifras van «por confirmar» ([P-07](preguntas.md)).
- Prettier no tiene configuración en el repositorio. **No se pasa a archivos existentes**: reformatea todo ([D-15](discrepancias.md)).
