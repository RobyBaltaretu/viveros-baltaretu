# Decisiones del panel propio

Decisiones tomadas durante la implementación, con su motivo. Las del propietario están en la definición (§3) y en sus instrucciones: él aprueba cada versión en Cloudflare, el panel lo usan propietario, gerente y como mucho un editor, solo se guardan los presupuestos y el asistente empieza guiado.

| # | Decisión | Motivo |
|---|---|---|
| 1 | **Fotos en D1 (BLOB de hasta 2 MB), no en R2** | R2 exige contratar su suscripción con un método de pago aunque no se pase del cupo gratuito, y la regla es no activar servicios de pago. Las fotos se comprimen en el móvil (~300 KB) y caben de sobra en los 500 MB de D1. Van detrás de `RepositorioFotos`: pasar a R2 más adelante es otra implementación |
| 2 | **Copia diaria con GitHub Actions** (artefacto de 30 días) además de D1 Time Travel (7 días) | Sin R2 ni KV y sin un Worker con Cron propio. Gratis en el cupo de Actions (un minuto al día) |
| 3 | Los presupuestos no van en la copia diaria | Son datos personales; ya llegan por email y Time Travel cubre 7 días |
| 4 | **El build descarga el contenido del propio Worker** (`/api/contenido/*` con `CONTENIDO_TOKEN`) | El token de Workers Builds no tiene permiso de D1; así no hay que crear otro token con más permisos |
| 5 | Sin variables de contenido, el build usa los archivos del repositorio; con ellas y un fallo, el build falla | Desarrollo y CI siguen igual, y nunca se publica una web vacía |
| 6 | El binding de D1 de producción no se añade hasta que el propietario cree la base; en local va en el entorno `desarrollo` | Un binding sin ID haría que Workers Builds intentara crear la base y fallara el despliegue |
| 7 | Migraciones aplicadas por el Worker al primer uso | Un paso manual menos y las migraciones futuras se aplican solas |
| 8 | Panel en páginas Astro renderizadas en el servidor, sin React, con JavaScript solo para fotos y guardado | Menos CPU (límite de 10 ms), funciona en móviles modestos y es más fácil de hacer accesible |
| 9 | Modelo `@cf/meta/llama-3.3-70b-instruct-fp8-fast` con modo JSON | Está en la lista oficial de modelos con salida estructurada y entiende español; ~270 órdenes/día gratis |
