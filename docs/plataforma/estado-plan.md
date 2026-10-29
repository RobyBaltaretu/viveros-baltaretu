# Estado del plan

Cada sesión **empieza por aquí** y lo actualiza al cerrar cada PR. El plan está en [plan.md](plan.md); las dudas abiertas, en [preguntas.md](preguntas.md).

## Hecho

| PR | Estado | Notas |
| --- | --- | --- |
| 0.1 Documentación e inventario de acoplamientos | En revisión | Este documento y los demás de `docs/plataforma/`. |

## Siguiente

1. **0.2 Red de seguridad**: línea base de la web, de D1, del panel y del asistente en `tests/baseline/`.
2. **1.1** `cliente.config.json`, `CLIENTE_ID` y cargador tipado.
3. **1.2** Módulos con guardias.

## Avisos para la próxima sesión

- La próxima migración es la **10** ([D-01](discrepancias.md)).
- Antes de desplegar la primera migración nueva, el propietario hace la copia completa de D1 ([D-04](discrepancias.md) y [P-03](preguntas.md)).
- `developers.cloudflare.com` no se puede abrir desde la sesión. Las cifras van «por confirmar» ([P-07](preguntas.md)).
- Prettier no tiene configuración en el repositorio. **No se pasa a archivos existentes**: reformatea todo ([D-15](discrepancias.md)).
