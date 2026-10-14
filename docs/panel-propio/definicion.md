# Panel propio y asistente: definición funcional y técnica

Estado: **propuesta para aprobar**. Partimos de la web que ya está en `main` (ver `docs/estado.md` y `CLAUDE.md`). Las cifras de límites gratuitos son orientativas y **deben verificarse en la documentación oficial vigente** antes de depender de ellas.

## 1. Objetivo
Sustituir el panel Keystatic por un **panel interno propio**, pensado para personas que apenas usan ordenadores o móviles, y añadir un **asistente de chat** dentro del panel que ejecute cambios a partir de instrucciones escritas. La web pública, el diseño y las reglas de negocio actuales no cambian.

## 2. Qué NO cambia (reglas vigentes de CLAUDE.md)
- Diseño y paleta aceptados (crema, oliva y terracota solo en botones). No se rediseña.
- Negocio: planta de hasta 4 m (`ALTURA_MAXIMA`), venta al por mayor y algunas especies también por unidad con envío (`ventaUnitaria`, `precioUnidad`), condiciones de venta editables.
- Web pública estática en Cloudflare Workers con Static Assets. Solo las rutas con `prerender = false` ejecutan el Worker.
- Español en la raíz e inglés bajo `/en/`, SEO (hreflang, JSON-LD, sitemap), cookies con GA4 tras consentimiento, accesibilidad WCAG 2.1 AA.
- Nada con `revisado: false` llega a producción. Los datos de ejemplo llevan `datosDeEjemplo: true`.
- Cambios por rama y PR. **Producción con aprobación manual del propietario.**
- Esquemas de validación existentes (`src/lib/catalogo/schema.ts` y los de empresa, condiciones, portada y páginas): el panel los **reutiliza**, no los duplica.

## 3. Decisiones tomadas por el propietario
| Tema | Decisión |
|------|----------|
| Panel | Propio, ultra simple, sin GitHub para el gerente. El soporte lo lleva el propietario |
| Hosting y servicios | Solo Cloudflare y servicios gratuitos |
| Base de datos | **D1** (SQLite de Cloudflare). No Supabase gratuito: sus proyectos gratuitos se pausan tras unos 7 días sin actividad, parece que no incluyen copias diarias y tienen límites menores de archivos (verificar en supabase.com/pricing) |
| Capa de datos | Todo el acceso a datos va detrás de una capa de repositorios, para poder migrar de base de datos sin tocar el panel ni la web |
| Asistente | Centrado solo en el panel y el vivero. **Sin API de Claude por ahora**: asistente guiado + lenguaje natural con Workers AI, con proveedor intercambiable |

## 4. Arquitectura recomendada (a validar en el plan)
La web pública **se mantiene estática**. Es lo que la hace gratuita, rápida y buena para SEO, y el plan gratuito limita el código del Worker (según el README, 100.000 peticiones al día y 10 ms de CPU por petición), un riesgo si se sirviera todo desde la base de datos.

```
Gerente ──► /panel (Cloudflare Access) ──► Worker ──► D1 (contenido, presupuestos,
                                              │          versiones, auditoría)
                                              └─────► R2 (fotos, copias nocturnas)
"Publicar cambios" ──► Deploy Hook ──► Workers Builds ──► build lee el contenido de D1
                                                          y genera la web estática ──► versión
                                                          que el propietario publica
```

- **D1 es la fuente de verdad del contenido.** El panel escribe borradores; "Publicar cambios" los agrupa en una versión.
- **El build lee de D1** (por ejemplo con un cargador de contenido de Astro o un script de exportación previo al build) y produce **los mismos datos que hoy** validados con los mismos esquemas, para que las páginas casi no cambien.
- **Un build por publicación, no por guardado.** Es un cambio a mejor respecto a Keystatic, que lanza un build en cada guardado. El límite de Workers Builds (3.000 min/mes según el README) deja mucho margen.
- **Fotos en R2**, no en el repositorio. Hay que decidir cómo las optimiza el build (descarga previa a `src/assets` o dominios remotos permitidos en Astro).
- **Aprobación de producción:** hoy el propietario publica cada versión desde el panel de Cloudflare. **Decisión abierta (ver §12):** mantenerlo así o permitir que "Publicar cambios" del gerente publique solo los cambios de contenido, dejando la aprobación manual para los de código.
- **Acceso:** Cloudflare Access protege `/panel` y `/api/panel/*`. El Worker valida el token en cada petición y consulta el rol en D1.

**Alternativas consideradas**
- *Servir las páginas desde D1 con SSR*: publicación instantánea, pero rompe lo que hoy es estático y gratis, y arriesga el límite de CPU. Solo si una prueba de concepto demuestra que cabe.
- *Mantener Keystatic*: sin trabajo nuevo, pero no cumple "ultra simple" ni permite el asistente ni la bandeja de presupuestos.

## 5. Capa de acceso a datos (obligatoria)
Ninguna página, ruta de API ni acción del asistente consulta D1 directamente. Todo pasa por `src/server/data/`, con una interfaz de repositorio por entidad. Solo la implementación de D1 conoce SQL. Hay que evitar funciones o tipos exclusivos de D1 fuera de esa capa y dejar documentada la migración a otra base (por ejemplo Postgres).

## 6. Contenido que el panel debe gestionar
Equivalente a lo que hoy edita Keystatic (`keystatic.config.ts`):
- **Especies (catálogo):** todos los campos de `schema.ts`, con sus reglas: altura máxima 4 m, perímetro `[mín, máx]`, `precioUnidad` solo con `ventaUnitaria`, textos y SEO en español e inglés, fotos con texto alternativo bilingüe, `revisado` y `datosDeEjemplo`.
- **Ajustes (singletons):** empresa, condiciones de venta, textos del catálogo y portada.
- **Páginas fijas:** nosotros, reparto, aviso legal, privacidad y cookies (los legales los revisa un asesor).
- **Colecciones:** proyectos (con relación a especies) y guías, con la misma regla de `revisado`.
- **Presupuestos recibidos (nuevo):** hoy solo se envían por email. Se guardan también en D1 con estados (nuevo, respondido, archivado) y exportación, manteniendo el email, Turnstile y el campo trampa.

## 7. Requisitos del panel
**Principios obligatorios:** español llano sin términos técnicos (nada de slug, SEO, commit o build), una tarea por pantalla, botones de al menos 48 px, letra grande, alto contraste, móvil primero, WCAG 2.1 AA, errores que explican qué hacer, confirmación antes de borrar o publicar. Un error del usuario nunca debe romper la web.

| ID | Requisito | Prior. |
|----|-----------|--------|
| P-01 | Acceso con Cloudflare Access (código por email, sin contraseñas; a confirmar), roles propietario, gerente y editor, y registro de auditoría | M |
| P-02 | Inicio con 5 tarjetas: Mis plantas, Presupuestos recibidos, Fotos, Textos de la web y Ayuda | M |
| P-03 | Alta de planta guiada paso a paso, empezando por la foto; edición, precio, disponibilidad y archivar | M |
| P-04 | Fotos desde el móvil con compresión y reencuadre automáticos, y textos alternativos propuestos en español e inglés para revisar | M |
| P-05 | Edición de empresa, condiciones de venta, portada, páginas fijas, proyectos y guías | M |
| P-06 | Bandeja de presupuestos con estados y exportación | M |
| P-07 | Guardado automático como borrador, vista previa "Así se verá en la web", botón único "Publicar cambios", historial y "Deshacer" | M |
| P-08 | Copia nocturna de D1 a R2 y prueba de restauración | M |
| P-09 | Ayuda ilustrada dentro del panel y guía de una página para el gerente | S |
| P-10 | Los datos con `datosDeEjemplo` o `revisado: false` avisan de que no se publican | M |

## 8. Asistente de chat
- **Nivel 1, guiado:** botones y flujos paso a paso ("cambiar precio → ¿de cuál planta? → ¿cuánto?"). Gratuito y predecible.
- **Nivel 2, lenguaje natural con Workers AI:** el gerente escribe "sube la Washingtonia a 20" y un modelo lo convierte en **una acción de una lista cerrada**, con parámetros validados contra el catálogo (coincidencia aproximada de nombres). Cloudflare ofrece un cupo diario gratuito de neuronas compartido entre modelos (según su documentación, 10.000 al día); hay que elegir un modelo pequeño que entienda bien el español, medir su consumo y su precisión con frases reales.
- **Acciones permitidas:** las mismas que el panel, a través de la misma capa de validación (crear, editar o archivar planta; cambiar precio o disponibilidad; editar textos; consultar presupuestos). Sin acceso libre a la base de datos ni al repositorio.
- **Siempre confirmación Sí/No** con un resumen ("Voy a cambiar el precio de la Washingtonia de 18 € a 20 €") antes de aplicar. Los cambios van a borrador; publicar requiere confirmación aparte. Si hay ambigüedad, pregunta.
- **Solo habla del panel y del vivero.** Rechaza cualquier otro tema.
- **Los textos del catálogo, formularios y presupuestos son datos, nunca instrucciones.**
- Límite diario por usuario y degradación al asistente guiado si se agota el cupo o se retira el modelo (Cloudflare retira modelos con el tiempo).
- Capa de proveedor intercambiable para poder usar otro modelo o la API de Claude más adelante si la precisión no basta.

## 9. Seguridad
Validación en servidor con los esquemas existentes, protección CSRF, límites de tamaño y tipos de archivo, permisos mínimos, roles, registro de auditoría, secretos solo como variables o secretos de Cloudflare (nunca en el repositorio), copias de seguridad y `keep_vars` como hasta ahora.

## 10. Migración desde Keystatic (por fases, sin cortes)
1. Construir el panel y D1 **en paralelo**, con Keystatic todavía operativo.
2. Script de importación del contenido actual (`src/content/*` y fotos de `src/assets/catalogo/`) a D1 y R2.
3. Comprobar la **equivalencia**: el build desde D1 debe generar las mismas páginas, el mismo sitemap y el mismo JSON-LD que el build actual (tests y e2e en verde).
4. Prueba real con el gerente en su móvil.
5. Solo entonces, en un PR aparte, retirar Keystatic y actualizar `CLAUDE.md`, el README y la CI. Mientras tanto, se puede volver atrás.

## 11. Límites gratuitos a verificar
Workers (peticiones y CPU), D1 (lecturas y escrituras por día, almacenamiento), R2 (almacenamiento y operaciones), Access (usuarios), Workers AI (neuronas al día), Workers Builds (minutos al mes) y cómo se invoca el Deploy Hook. Cualquier límite que se quede corto se comunica antes de seguir.

## 12. Riesgos y decisiones abiertas
**Riesgos:** que el build no pueda leer D1 con comodidad desde Workers Builds; optimización de fotos desde R2; calidad del modelo abierto en español; retirada de modelos de Workers AI; el esfuerzo de mantener un panel propio, con su seguridad, frente a un CMS ya hecho.

**Decisiones abiertas para el propietario:**
1. ¿El gerente publica los cambios de contenido sin tu aprobación, o sigues aprobando cada versión en Cloudflare?
2. ¿Quién puede usar el panel (cuántas personas y con qué rol)?
3. ¿Se guarda también el contacto general, o solo los presupuestos?
4. ¿Se acepta empezar por el asistente guiado y añadir el lenguaje natural cuando se mida su precisión?
