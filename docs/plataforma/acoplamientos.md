# Acoplamientos al vivero

Inventario de lo que hoy está fijado en el código para **Viveros Baltaretu** o para un **vivero**. Está hecho sobre el código real (commit `4577ab6`). Cada línea dice dónde está, qué está acoplado y en qué fase de la [hoja de ruta](hoja-de-ruta.md) se resuelve. Mientras no se resuelva, el valor actual es el de Baltaretu, que es el cliente por defecto, y su comportamiento no cambia (ver [la red de seguridad](../../tests/baseline/README.md)).

## Marca e identidad (1.1 y 1.3)

| Dónde | Qué | Fase |
| --- | --- | --- |
| `wrangler.jsonc:3,23,37` | Nombre del Worker `viveros-baltaretu`, D1 `viveros-baltaretu` con su id y D1 local `viveros-baltaretu-local`. | 1.1: **no se toca**. Los demás clientes usan configuración generada aparte. |
| `package.json:2` | Nombre del paquete. | Se queda así. |
| `src/content/ajustes/empresa.yaml` | Nombre y datos de la empresa: contenido, no código. | 1.1: semilla por cliente en `clientes/<slug>/`. |
| `src/server/panel/plantas.ts:41` | `seoPorDefecto(…, empresa = 'Viveros Baltaretu')`. | 1.1 |
| `src/pages/panel/presupuestos/[id].astro:23` | Asunto del correo «Tu presupuesto de Viveros Baltaretu». | 1.1 |
| `src/components/panel/ui/Logo.astro:12-17`, `src/i18n/panel.ts:6` | Monograma, texto «Baltaretu» y «Panel del vivero». | 1.1 y 1.5 |
| `src/server/facturas/pdf.ts:9-13,63` | Colores de marca del PDF en RGB fijo; `setCreator('Panel del vivero')`. | 1.3 |
| `src/pages/api/presupuesto.ts:86` | Remitente «Web del vivero». | 1.5 |
| `src/styles/global.css:4-27` | Tokens `@theme` de Baltaretu. | 1.3: se inyectan desde la configuración; los de Baltaretu siguen siendo estos. |
| `astro.config.mjs:29-64` | Fuentes Bricolage Grotesque y DM Sans. | 1.3 |
| `public/` (logo, logo-oscuro, monograma, og-imagen, favicon, apple-touch-icon); `Cabecera.astro:23`, `Pie.astro:27`, `BaseLayout.astro:39` | Activos de marca. | 1.1: activos por cliente; los de Baltaretu se quedan en `public/`. |
| `scripts/generar-imagen-og.mjs` | Imagen social con palmera y olivo. | 2.2 |
| `src/pages/[interno].astro:44` | Texto del sistema de diseño «Vivero mediterráneo…». | 2.2 |
| `src/lib/presupuesto/lista.ts:14`, `src/lib/cookies/consentimiento.ts:7` | Claves de `localStorage` con el prefijo `vivero:`. | Se quedan así: cada cliente tiene su propio dominio y, por tanto, su propio almacenamiento. Cambiarlas borraría la lista de los visitantes de Baltaretu. |
| `src/i18n/ui.ts:68` | `lemaEmpresa` «Vivero mayorista…». | 1.5 |
| `src/lib/seo/datos-estructurados.ts:20,24,46` | `LocalBusiness` con `areaServed: España`; `Product` con nombre científico. | 2.4 |

## Vocabulario (1.5)

| Dónde | Qué |
| --- | --- |
| `src/i18n/ui.ts:27-33,431-447` | `slugFamilia`, `familias`, `formatos` y `disponibilidades`. |
| `src/i18n/ui.ts` (≈82-235 y 269-422) | Especie, altura, perímetro de tronco, «persona de 1,80 m» y textos de WhatsApp con `{cientifico}`. |
| `src/server/panel/navegacion.ts` | Zona `plantas`, nombre «AgricolAI», secciones Catálogo, Inventario y Fotos descritas en términos de plantas; la barra del móvil prioriza `plantas`. |
| `src/server/panel/inventario.ts:22-44` | Motivos «Traslado a otro vivero», «Se ha muerto», «Plaga o enfermedad», «Helada…». |
| `src/server/gastos/gastos.ts:10-24` | Categorías de gasto: planta, sustratos, macetas, fitosanitarios, riego (con palabras clave como palmera y olivo). |
| `src/server/gastos/lector.ts:31` | Instrucción del lector de tickets: «tickets… de un vivero». |
| `src/server/panel/fotos.ts:37` | Texto alternativo «… en el vivero». |
| `src/pages/panel/inventario/resumen.astro:31`, `src/pages/panel/plantas/[id]/index.astro:76`, `src/pages/panel/asistente.astro:87,158` | «vivero» en textos de interfaz. |
| `src/server/panel/textos.ts:24,40-51` | Ayudas del editor: condiciones, familias y proyectos «con las plantas usadas». |
| `src/components/ilustraciones/siluetas.ts`, `ficha/ComparadorEscala.astro`, `portada/Familias.astro`, `portada/Heroe.astro` | Dibujos de plantas, comparador con una persona de 1,8 m y tarjetas por familia. Son componentes del paquete vivero (2.2). |

## Esquema del contenido (1.6)

| Dónde | Qué |
| --- | --- |
| `src/lib/catalogo/constantes.ts:3-9` | `ALTURA_MAXIMA = 4`, `FAMILIAS`, `DISPONIBILIDADES`, `FORMATOS` y `SILUETAS`. |
| `src/lib/catalogo/schema.ts:36-71` | `crearEsquemaEspecie`: forma plana de Baltaretu. **Se conserva tal cual** (decisión 3). |
| `src/content.config.ts` | Conjunto fijo de colecciones. Se evalúa una vez en Node durante el build y **puede leer `process.env.CLIENTE_ID`**: se comprobó con un build de prueba que imprimía la variable. Por tanto sí permite elegir el esquema por cliente en build. |
| `src/lib/condiciones/schema.ts:6-13` | Pedido mínimo, plazos al por mayor y envío por unidad. |
| `src/lib/paginas/schema.ts:36-37` | Un proyecto tiene `especies: slug[]`. |
| `src/server/panel/plantas.ts:92` | Mensaje «El vivero trabaja plantas de hasta 4 m». |
| `src/lib/pruebas/datos.ts` | Contenido de demostración del vivero. |

## Rutas (1.5)

| Dónde | Qué |
| --- | --- |
| `src/i18n/ui.ts:8-23` | `/catalogo/`↔`/en/catalogue/`, `/presupuesto/`↔`/en/quote/`, `/reparto/`↔`/en/delivery/`, proyectos, guías, nosotros. |
| `src/pages/catalogo/[slug].astro`, `reparto.astro`, `en/delivery.astro`, `indice-especies.json.ts` | Páginas del vivero. |
| `src/pages/panel/plantas/**`, `panel/inventario/**`, `panel/fotos.astro` | Rutas del panel del vivero: **se mantienen** (regla suprema 5). |
| `src/server/panel/fotos.ts:8` | Las fotos van en `catalogo/<planta>/`. |

## Idiomas (1.4)

| Dónde | Qué |
| --- | --- |
| `astro.config.mjs:66-72` | `locales: ['es', 'en']` fijo. |
| `src/i18n/ui.ts:3-5` | `IDIOMAS` e `IDIOMA_POR_DEFECTO`. |
| `src/lib/catalogo/schema.ts:69`, `src/lib/condiciones/schema.ts:3` | `seo {es, en}`, `textoBilingue` y `bilingue`: exigen las claves `en`. |
| `src/lib/presupuesto/esquema.ts:44` | `idioma: z.enum(['es', 'en'])`. |
| `src/server/panel/facturacion.ts:28` | Lee `nombre.es`. |

## IVA y facturación (1.1 y 3.2)

| Dónde | Qué |
| --- | --- |
| `src/server/facturas/importes.ts:8-12` | `TIPOS_IVA = [21, 10, 4, 0]`, `IVA_POR_DEFECTO = 10` (planta viva) y tabla `RECARGO`. |
| `src/server/facturas/facturas.ts:22-37,190,257` | `AJUSTES_VACIOS` (transferencia, 30 días), `FORMAS_PAGO` y `lineaVacia` con el IVA por defecto. |
| `src/server/panel/facturacion.ts:24-39` | El libro CSV fija `[21, 10, 4, 0]`; `plantasParaFacturar`. |
| `src/server/data/tipos.ts:220-221` | La línea de factura tiene `planta?`, que descuenta del inventario. |
| `src/server/asistente/instrucciones.ts:27`, `src/server/panel/pruebas.ts:53-54` | «Plantas al 10 %, transporte al 21 %». Ningún código aplica el 21 % al transporte: solo lo dicen el asistente y los datos de prueba. |

No existe un «tipo de IVA general» configurable (1.1 lo añade a `cliente.config.json`; el de Baltaretu es 10, el valor actual).

## Base de datos (3.x)

| Dónde | Qué |
| --- | --- |
| `src/server/data/d1/migraciones.ts:21`, `src/server/data/tipos.ts:7` | `entradas.coleccion CHECK IN ('catalogo', 'ajustes', 'paginas', 'proyectos', 'guias')`. Ver la [discrepancia D-03](discrepancias.md). |
| `migraciones.ts:213` | `inventario_movimientos.planta`. |
| `migraciones.ts:68,88` | `presupuestos.tipo_pedido` y `provincia`. |
| `src/server/data/tipos.ts:140-144` | `LineaPresupuesto.especie`. |
| `scripts/contenido/archivos.mjs:12-13` | Colección → carpeta (catalogo → `.md`). |

## Asistente (3.11)

| Dónde | Qué |
| --- | --- |
| `src/server/asistente/instrucciones.ts:11-30` | Identidad «AgricolAI… Viveros Baltaretu, vivero mayorista… hasta 4 m», ejemplos de plantas y «Solo ayudas con el vivero». |
| `src/server/asistente/herramientas.ts` | Herramientas `resumen_vivero`, `buscar_plantas`, `cambiar_planta`, `crear_planta`, `quitar_o_recuperar_planta`, `cambiar_plantas`, `ver_inventario` y `mover_inventario`; temas con expresiones regulares (palmer, olivo, higuer, cica, cepell…). |
| `src/server/asistente/interprete.ts:57,98,105`, `conversacion.ts:13`, `coincidencia.ts:3`, `agente.ts:51` | El modo básico y los mensajes hablan del vivero. |
| `tests/asistente/frases.json`, `frases-control.json` | Banco de frases del vivero. |

## Infraestructura y despliegue (1.1 y 5.x)

| Dónde | Qué |
| --- | --- |
| `wrangler.jsonc:13-37` | Un solo binding `DB`, `run_worker_first`, `PROPIETARIO_EMAIL` y `PANEL_PRUEBA_EMAIL` en desarrollo. |
| `astro.config.mjs:4-7,76-79` | `SITE_URL` y las constantes de `vite.define` (`WORKERS_CI_BRANCH` y `PRODUCTION_BRANCH`): es la forma de pasar variables de build al prerender, que corre en workerd. `CLIENTE_ID` tendrá que ir igual. |
| `scripts/contenido/desplegar.ts:11-12` | `CONTENIDO_TOKEN`, `CONTENIDO_URL` y `SITE_URL`. |
| `.github/workflows/copia-diaria.yml:31-34`, `importar-contenido.yml` | **Una sola web**: una `WEB_URL` y un `CONTENIDO_TOKEN`, sin matriz. |
| `scripts/contenido/copia.ts`, `src/server/contenido/copia.ts:3-5` | La copia es del **contenido publicado y sus fotos**, por HTTP. No incluye clientes, facturas, gastos, inventario ni presupuestos. Ver la [discrepancia D-04](discrepancias.md). |
| `scripts/guia-gerente.ts:6` | «Guía rápida del panel del vivero». |

## Acceso, fotos y formularios (verificado)

- **Acceso**: todo está en `src/server/panel/acceso.ts`: `emailDeAccess` (JWT de Access con jose), `panelActivado`, `sesionPanel` (crea al propietario desde `PROPIETARIO_EMAIL` y registra los intentos denegados) y `mismoOrigen` (CSRF). Ya está casi encapsulado; 1.2 lo pone detrás de una interfaz `ProveedorDeAcceso`.
- **Permisos**: solo por rol (`permisos.ts`). **No hay módulos ni flags.** El middleware solo comprueba el origen y la sesión; cada página aplica su permiso con `sesionCon(locals, accion)`. 1.2 añade los módulos.
- **Fotos**: una sola interfaz, `RepositorioFotos` (guardar, obtener, listar, borrar), con BLOB en la tabla `fotos`. **Nadie anónimo sube fotos hoy.** `api/contenido/foto` exige `CONTENIDO_TOKEN`.
- **Formulario de petición** (`src/pages/api/presupuesto.ts`): **Turnstile es opcional** (solo si hay `TURNSTILE_SECRET_KEY`); sin la clave, solo protege el campo trampa. Los campos son del vivero: `tipoPedido mayor|unidad` y `lineas[{slug, cantidad}]` validadas contra el catálogo.
- **Arquitectura**: `tests/panel/arquitectura.test.ts` impide consultas a la base fuera de `src/server/data/`.
- **Factura desde presupuesto**: `lineasDePresupuesto` y `clienteDePresupuesto` (`src/server/facturas/facturas.ts:199-209`), usadas en `panel/facturas/nueva.astro`.

## Tests que dependen del vivero

Usan datos del vivero (no hay que cambiarlos: son los tests de Baltaretu): `catalogo.*`, `presupuesto`, `lista`, `seo`, `asistente/agente`, `panel/repositorios`, `facturas/facturas`, `informes`, `panel/navegacion` (lista exacta de zonas), `panel/plantas`, `cobertura`, `inventario`, `publicar`, `asistente-acciones`, `gastos`, `fotos` y los e2e. Neutrales: `tokens`, `cookies`, `panel/esquema`, `desplegar`, `acceso`, `textos`, `ayuda`, `arquitectura` y `copia`.

Regla para las fases siguientes: estos tests se ejecutan siempre con el cliente por defecto (sin `CLIENTE_ID`). Los tests de otros clientes van aparte y no cambian los de Baltaretu.
