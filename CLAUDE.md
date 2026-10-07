# CLAUDE.md: web del vivero mayorista

## Proyecto
Web corporativa y de catálogo para un vivero mayorista de plantas ornamentales (provincia de Valencia, reparto a toda España). Objetivos: posicionar en Google, mostrar el catálogo con fotos reales y convertir visitas en peticiones de presupuesto o contactos por WhatsApp. No es una tienda online.

## Stack
- Astro (páginas estáticas, JavaScript solo en componentes interactivos) y Tailwind CSS.
- Catálogo en archivos Markdown con frontmatter, en `src/content/catalogo/`, validado con un esquema en cada build.
- Panel interno con Keystatic para el gerente, que no tiene GitHub: acceso por Keystatic Cloud (gratuito hasta 3 usuarios). El GitHub y el soporte los lleva el propietario del proyecto.
- Hosting en Vercel (plan Pro por uso comercial). Funciones serverless para formularios y presupuestos.
- Todo lo demás debe ser gratuito. Antes de elegir un servicio, comprobar sus límites actuales.

## Idiomas
Español en la raíz (`/`) e inglés bajo `/en/`. Cada texto se escribe en los dos idiomas, sin traducción literal. Etiquetas `hreflang` entre versiones.

## Reglas
- No inventar datos de la empresa. Lo que falte se marca como `[PLACEHOLDER]`.
- Los datos de ejemplo del catálogo llevan `datosDeEjemplo: true` y `revisado: false`. Nada con `revisado: false` se publica en producción.
- Precio visible como "desde X €"; si falta, "precio bajo presupuesto".
- Cambios siempre en rama con PR. No hacer push a `main`. Producción requiere aprobación manual.
- Ejecutar lint, tests y build antes de dar una tarea por terminada.
- Claves y secretos solo como variables de entorno, nunca en el repositorio.
- Accesibilidad WCAG 2.1 AA: etiquetas en formularios, contraste, navegación con teclado, textos alternativos.
- Cookies: Google Analytics 4 solo se carga tras el consentimiento del usuario.
- Textos legales: los revisa un asesor. No presentarlos como definitivos.

## Esquema de cada especie
`slug`, `familia` (palmeras, olivos, higueras, otras-ornamentales), `nombre {es,en}`, `nombreCientifico`, `descripcion {es,en}`, `alturaMin/Max` (m), `perimetroTroncoCm` (opcional), `formatos`, `disponibilidad` (disponible, bajo-pedido, agotado), `precioDesde` y `unidadPrecio`, `origen`, `destacada`, `seo {es,en}`, `revisado`.

## Comandos
Se definirán al crear el proyecto base (dev, build, lint y test).

## Documentos de referencia
Hoja de ruta, definición funcional y técnica, y estrategia SEO con el mapa de páginas.
