# Estado del proyecto

Resumen para retomar el trabajo en una sesión nueva. Actualizado el 14 de octubre de 2026, tras el PR #15. Las reglas fijas están en `CLAUDE.md`; aquí va lo que ha pasado y lo que falta.

## Qué hay en `main`
- Web completa en Astro sobre Cloudflare Workers: portada, catálogo con filtros, fichas, lista y petición de presupuesto (`/api/presupuesto`, Turnstile y Email Service), nosotros, reparto, proyectos, guías, legales, panel Keystatic, SEO (hreflang, JSON-LD, sitemap, robots) y e2e de accesibilidad.
- PR #13: negocio real (Viveros Baltaretu, planta hasta 4 m, venta al por mayor y algunas especies por unidad con envío), condiciones de venta en el panel, aviso de cookies con GA4 tras consentimiento, datos de prueba solo fuera de producción y fotos de prueba en las fichas de ejemplo.
- PR #14: rediseño más sencillo. Paleta de vivero (crema, oliva y terracota solo para botones), portada en seis bloques (héroe, familias, dos formas de comprar, pasos, confianza y llamada final), tarjetas y ficha con menos datos, y "Más filtros" para formato y perímetro.
- PR #15: herramientas de Claude y repaso con Impeccable y Emil. Sin antetítulos (Impeccable los prohíbe), "Pasos" rehecho como camino semilla → brote → planta con una línea que se traza al hacer scroll, las plantas del héroe brotan al cargar, botones con respuesta al pulsar y barra de scroll, cursor y casillas con la paleta.

## Preferencias del propietario
- Sencillez y mensaje claro por encima del efecto visual. Rechazó un diseño anterior por parecer "generado por IA" y por cargar demasiada información.
- Colores que encajen con una empresa agrícola. La paleta actual (`src/styles/global.css`) es la aceptada; no cambiarla sin preguntar.
- Público: jardinerías, paisajistas y obra; particulares solo en las especies que se venden por unidad.
- Prefiere que avance sin preguntar y que deje las preguntas para el final. Producción siempre con aprobación manual.

## Pendiente antes de publicar
1. **Catálogo vacío en producción.** Las 10 fichas son de ejemplo (`datosDeEjemplo: true`, `revisado: false`), igual que el proyecto y la guía de ejemplo. Hacen falta especies reales con fotos, revisadas desde el panel.
2. **Datos de empresa provisionales** en `src/content/ajustes/empresa.yaml` (teléfono +34 600 000 000, info@example.com, "Calle Ejemplo 1… (dirección provisional)"). Sí se publican: hay que cambiarlos por los reales desde el panel.
3. **`[PLACEHOLDER]` sin rellenar:** condiciones de venta (pedido mínimo, plazos, envío por unidad), portada (bloque de confianza), nosotros, reparto y los tres textos legales. Los legales los revisa un asesor.
4. **Cloudflare:** pasos manuales del README (dominio, Email Routing, Turnstile, Keystatic Cloud, variables, dominio propio). `PUBLIC_GA4_ID` es opcional.
5. **Rutas en inglés** provisionales hasta tener el mapa SEO definitivo.

## Herramientas de Claude en el repositorio
- `.claude/settings.json` activa el plugin [Impeccable](https://impeccable.style) (`pbakaus/impeccable`), con comandos `/impeccable audit`, `critique`, `polish`, etc. Sus hooks revisan la interfaz al empezar la sesión, tras cada edición y al terminar cada respuesta. En sesiones en la nube solo se instala si la red del entorno permite `github.com`; si no, se puede clonar el repositorio y ejecutar `plugin/skills/impeccable/scripts/impeccable detect` a mano.
- `.claude/skills/` contiene las habilidades de [emilkowalski/skills](https://github.com/emilkowalski/skills) (licencia MIT, commit `2d22863`): `emil-design-eng`, `review-animations`, `find-animation-opportunities`, `animate`, `mobile-native`, `break-ui`, etc. Para actualizarlas, se vuelven a copiar desde ese repositorio.

## Siguiente fase: panel propio y asistente (propuesta)
Documentada en `docs/panel-propio/` (definición, hoja de ruta y prompt de arranque). Pendiente de aprobar el plan técnico y de responder las decisiones abiertas del apartado 12 de la definición. Keystatic sigue siendo el panel en uso hasta entonces.

