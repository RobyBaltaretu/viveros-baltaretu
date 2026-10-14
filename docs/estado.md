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

## Panel propio y asistente (en curso)
Plan aprobado por el propietario y en ejecución por fases: `docs/panel-propio/` (definición, hoja de ruta, [plan técnico](panel-propio/plan-tecnico.md), [decisiones](panel-propio/decisiones.md) y [pasos manuales](panel-propio/pasos-manuales.md)). Keystatic sigue siendo el panel en uso hasta la tarea 5.3.
- 0.2 Plan técnico: hecho. Prueba de concepto sin diferencias entre el build actual y el que pasa por el formato de D1.
- 1.1 Esquema de D1: migraciones versionadas en `src/server/data/d1/migraciones.ts`, aplicadas por el Worker al primer uso; D1 local en el entorno `desarrollo` de `wrangler.jsonc`.
- 1.2 Capa de repositorios: interfaces en `src/server/data/tipos.ts` e implementación de D1 en `src/server/data/d1/` (el único sitio con SQL; un test lo comprueba).
- 1.3 Importación: `npm run contenido:importar` (D1 local) o con `--url` a la base real a través de `/api/contenido/*` (token `CONTENIDO_TOKEN`). Valida con los esquemas del build y no importa nada si algo falla.
- 1.4 Build desde D1: `npm run build` descarga antes el contenido publicado (`/api/contenido/exportacion`) si existe `CONTENIDO_TOKEN`; si no, usa los archivos. La CI comprueba en cada PR (`npm run contenido:equivalencia`) que el build desde D1 da las mismas páginas, sitemap y JSON-LD, con y sin fichas de ejemplo.
- 2.1 Acceso: Cloudflare Access + validación del JWT y del rol en el Worker (`src/middleware.ts`, `src/server/panel/`), auditoría de accesos denegados, protección de origen y cabeceras `noindex`/`no-store`. Sin base o sin Access, `/panel` dice que no está activado.
- 2.2 Inicio del panel: tarjetas Mis plantas, Presupuestos recibidos, Fotos, Textos de la web y Ayuda (y Personas para el propietario, con alta de gerente y de un editor como máximo). Pruebas e2e del panel con axe y controles de al menos 48 px (`tests-e2e/panel.spec.ts`), con D1 local en el build de los e2e.
- 2.3 Plantas: listado con avisos de lo que no se publica, alta guiada en 7 pasos, y pantallas separadas para precio, disponibilidad, datos y archivar. Valida con las reglas del catálogo (4 m como máximo, precio por unidad solo con venta por unidad) y con mensajes en español llano.
- Base D1 de producción conectada en `wrangler.jsonc` (`viveros-baltaretu`). El panel sigue sin activarse en producción hasta configurar Access (paso manual 4).
- Acción de GitHub "Importar contenido al panel" (`.github/workflows/importar-contenido.yml`), que se lanza a mano y usa el secreto `CONTENIDO_TOKEN` del repositorio.
- 2.4 Fotos: subida desde el móvil con reencuadre 4:3 y reducción a 1600 px en el navegador; tipo comprobado por el contenido; textos alternativos ES/EN propuestos para revisar; poner primera, cambiar texto y quitar (se puede deshacer). Tras el alta guiada, el panel lleva a añadir fotos. Pantalla «Fotos» con las plantas ordenadas por las que menos tienen.
