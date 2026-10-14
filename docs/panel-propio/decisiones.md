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
| 10 | Textos del panel en `src/i18n/panel.ts`, solo en español | El panel es interno y lo usan personas de aquí; `ui.ts` sigue siendo el de la web pública bilingüe |
| 11 | Además de Access, el Worker valida el JWT (firma, emisor, audiencia y caducidad con `jose`) y el rol en D1 en cada petición, y comprueba el origen en los envíos | Defensa en profundidad: si Access se configura mal, el panel sigue cerrado |
| 12 | Modo de prueba sin Access (`PANEL_PRUEBA_EMAIL`) solo en el entorno `desarrollo` y solo desde localhost | Poder probar el panel en local y en los e2e sin abrirlo en producción |
| 13 | Permisos: propietario todo; gerente todo salvo personas; editor solo prepara cambios (no publica ni ve presupuestos) | Lo más simple que cubre los tres roles decididos |
| 14 | Los textos para buscadores (título y descripción) se generan solos al guardar cada planta, con la misma plantilla que las fichas actuales | El gerente no tiene que entender qué es SEO y nunca quedan desfasados respecto al nombre o al precio |
| 15 | Si se escribe un precio por unidad sin marcar "también se vende por unidad", el panel lo explica en vez de borrarlo | Nunca se pierde en silencio algo que la persona ha escrito; la regla del esquema se mantiene |
| 16 | Para probar sin dominio propio, Access solo en las *Preview URLs* del Worker | En `*.workers.dev` Access protege la dirección entera; activarlo ahí cerraría la web pública |
| 17 | Los textos de la web se editan con un formulario que se dibuja a partir de los datos (texto, sí/no, español + inglés, listas) en vez de una pantalla a mano por cada uno | Cubre los 9 textos fijos, proyectos y guías con un solo componente, y cualquier campo nuevo del esquema aparece solo; la validación es siempre la del build |
| 18 | Una petición de presupuesto cuenta como recibida si se guarda en el panel **o** se envía el email (antes solo el email) | Que nunca se pierda una petición por un fallo de uno de los dos; el cliente no tiene que repetirla |
