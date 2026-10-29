# Plataforma multicliente: plan

El objetivo es convertir la web y el panel de Viveros Baltaretu en una **plataforma por suscripción**. Cada cliente tiene su propia web y su propio panel, con sus datos aislados. Todo funciona sobre Cloudflare y lo mantiene una sola persona.

**Regla suprema:** Viveros Baltaretu, que está en producción, **no se rompe**. Lo garantiza la [red de seguridad](../../tests/baseline/README.md) (PR 0.2).

Documentos relacionados:

- [hoja de ruta](hoja-de-ruta.md), con las fases y las escalas;
- [estado del plan](estado-plan.md), desde donde se retoma cada sesión;
- [acoplamientos al vivero](acoplamientos.md);
- [discrepancias](discrepancias.md);
- [preguntas](preguntas.md);
- [dominio de la carpintería](dominio-carpinteria.md).

## Arquitectura

```
repositorio único
├── src/                     núcleo (web, panel, datos, asistente)
├── paquetes-sector/
│   ├── vivero/              vocabulario, tipos de contenido, formulario, datos de prueba, asistente
│   └── carpinteria/
├── clientes/
│   ├── baltaretu/           cliente.config.json (= el comportamiento de hoy), sin activos nuevos
│   └── turia/               cliente.config.json, activos, semilla
└── tests/baseline/          red de seguridad de Baltaretu
```

- **Una instalación por cliente.** Cada cliente tiene su Worker, su D1 y su dominio. El cliente se elige en el build con `CLIENTE_ID`, que por defecto vale `baltaretu`.
  - `astro.config.mjs` carga y valida `clientes/<id>/cliente.config.json`.
  - Pasa al prerender (workerd) el id y la configuración con `vite.define`, igual que hoy `WORKERS_CI_BRANCH` ([D-10](discrepancias.md)).
  - `content.config.ts` se evalúa en Node y elige los esquemas del paquete del cliente (comprobado).
- **`wrangler.jsonc` de Baltaretu no cambia.** Los demás clientes tienen un `wrangler.<id>.jsonc` generado a partir de su configuración. Se despliegan con `wrangler deploy --config` y el adaptador recibe `configPath`.
- **Módulos.** Lista cerrada: portafolio/catalogo, presupuestosWeb, presupuestosCliente, obras, agenda, proveedores, materiales, pedidosProveedor, facturas, gastos, informes, asistente, simulador y whatsapp. Cada módulo apagado:
  - se oculta en `navegacion.ts`;
  - se bloquea en el middleware y en `/api/*` (404);
  - desaparece de las herramientas del asistente.

  En Baltaretu siguen activos los de hoy (catálogo, presupuestosWeb, facturas, gastos, informes, asistente, whatsapp e inventario como parte de catálogo) y los nuevos quedan apagados.
- **Datos.**
  - Contenido público: las cinco colecciones de hoy ([D-03](discrepancias.md)). Cada paquete declara sus tipos y en qué colección se guardan.
  - Datos privados: tablas nuevas, solo aditivas, a partir de la migración **10** ([D-01](discrepancias.md)), con repositorios en `src/server/data/`.
  - Dinero: igual que `importes.ts`, es decir, euros en los datos, cálculos en céntimos y redondeo por línea.
- **Acceso.** Cloudflare Access sigue, detrás de una interfaz `ProveedorDeAcceso` (`acceso.ts` ya concentra todo).
- **Fotos.** Siguen en D1, detrás de una interfaz `Almacen` que permitirá pasar a R2.
  - Las fotos privadas (obras, espacio del visitante, tickets) van en una tabla privada `adjuntos`. Nunca van en `fotos`, que se publica en el build.
- **Idiomas por cliente.** Un cliente que solo tiene español no genera `/en/`, no emite hreflang, no muestra el selector y no exige claves `en`.
- **Tema por cliente.** Los tokens `@theme` salen de la configuración. `tests/tokens.test.ts` recorre todos los clientes.

### Lo que no se hace

- No hay paquetes para sectores sin requisitos: las distribuidoras solo reutilizan módulos del núcleo.
- Nada de VeriFactu. La interfaz sigue diciendo que no lo es.
- Ni R2 ni acceso propio, salvo que se pida expresamente.
- Ningún servicio de pago sin una decisión expresa ([P-01](preguntas.md)).

## Plan por PRs

Cada PR cumple estas condiciones:

- es pequeña;
- lleva lint, tests, build, `check:worker`, e2e y equivalencia en verde;
- actualiza `docs/estado.md` y `estado-plan.md`;
- incluye la sección **«Impacto en Baltaretu»**: archivos comunes que toca, cómo se comprobó que no cambia (prueba y resultado) y cómo volver atrás.

En todas, **«Baltaretu no cambia»** significa que sin `CLIENTE_ID` se cumple todo esto:

- `npm run contenido:equivalencia` no da diferencias con `tests/baseline/web-*.json`;
- `tests/baseline/*.test.ts` pasa sin regenerar instantáneas, salvo `d1-esquema.json`, y en ese caso solo con cambios aditivos;
- los tests y los e2e existentes pasan sin tocar sus expectativas.

### F0 · Preparación

| PR | Descripción | Archivos | Migraciones | Tests nuevos | Terminado cuando |
| --- | --- | --- | --- | --- | --- |
| 0.1 | Documentación de la plataforma e inventario de acoplamientos | `docs/plataforma/*` | — | — | Documentos revisables; discrepancias y preguntas con recomendación |
| 0.2 | Red de seguridad de Baltaretu | `tests/baseline/*`, `scripts/baseline/generar-d1.ts`, `scripts/contenido/huella-build.mjs`, `equivalencia.ts`, `package.json` (`baseline:actualizar`), `CLAUDE.md` | — | `d1.test.ts` (esquema, versiones consecutivas, migración sin pérdidas), `panel.test.ts` (navegación, permisos, herramientas e instrucciones por rol), `huella.test.ts` | La CI compara la web (producción y pruebas) con la línea base; un cambio de texto o una migración que pierde datos la hacen fallar (comprobado a mano) |

### F1 · Cimientos multicliente (nada visible cambia en Baltaretu)

| PR | Descripción | Archivos | Migraciones | Tests nuevos | Terminado cuando |
| --- | --- | --- | --- | --- | --- |
| 1.1 | `cliente.config.json`, `CLIENTE_ID` y cargador tipado (Zod) con valores por defecto iguales a hoy | `src/plataforma/cliente.ts` (esquema y cargador), `clientes/baltaretu/cliente.config.json`, `clientes/turia/cliente.config.json` (con `[PLACEHOLDER]`), `astro.config.mjs` (lee la config e inyecta `import.meta.env.CLIENTE_ID` y la config) | — | La config de cada cliente valida; Baltaretu da exactamente los valores que hoy están fijos (idiomas, IVA 10, módulos, nombres de Worker y D1, tokens); un `CLIENTE_ID` desconocido corta el build | Sin `CLIENTE_ID`, línea base idéntica; `CLIENTE_ID=turia` construye |
| 1.2 | Módulos: guardias en el servidor, la navegación y el asistente; `ProveedorDeAcceso` | `src/plataforma/modulos.ts`, `navegacion.ts` (campo `modulo`), `middleware.ts` (404 si el módulo está apagado), `herramientas.ts` (filtro), `acceso.ts` (interfaz) | — | Con un módulo apagado: no sale en el menú, la ruta da 404, la API da 404 y no hay herramienta; Baltaretu conserva sus módulos de hoy | `panel-navegacion.json` y `asistente-herramientas.json` sin cambios |
| 1.3 | Tema por cliente | `global.css` (tokens desde la config en el build), `pdf.ts` (colores de la config), `tests/tokens.test.ts` (todos los clientes) | — | Contraste AA de cada cliente | CSS de Baltaretu idéntico (`textos` de la línea base) |
| 1.4 | Idiomas por cliente | `astro.config.mjs` (`i18n.locales` de la config), `ui.ts`, esquemas con claves `en` opcionales si el cliente no tiene inglés, `seo/` (sin hreflang con un solo idioma), selector | — | Un cliente solo en español: sin `/en/`, sin hreflang, sin selector; Baltaretu sigue con es y en | Sitemap y JSON-LD de Baltaretu iguales |
| 1.5 | Vocabulario por sector y alias de rutas | `paquetes-sector/vivero/vocabulario.ts` (los textos de hoy), `paquetes-sector/carpinteria/vocabulario.ts`, `ui.ts` (combina núcleo y paquete) | — | Las rutas de Baltaretu (`/catalogo`, `/en/catalogue`, `/panel/plantas`…) siguen existiendo; carpintería usa `/portafolio` y `/panel/proyectos` como alias | HTML idéntico |
| 1.6 | Tipos de contenido declarativos y esquema generado | `paquetes-sector/*/contenido.ts`, `content.config.ts` (elige el paquete), `lib/catalogo/schema.ts` (sin cambios, lo usa el paquete vivero) | — | El esquema generado del paquete vivero acepta y rechaza exactamente lo mismo que `crearEsquemaEspecie` (mismas fichas válidas e inválidas de `catalogo.schema.test.ts`) | Cero migración de contenido |

### F2 · Web de Creaciones Turia

| PR | Descripción | Migraciones | Tests nuevos | Terminado cuando |
| --- | --- | --- | --- | --- |
| 2.1 | Paquete `carpinteria`: tipos Proyecto (título, categoría, descripción, materiales, año, localidad, galería antes/después, destacado) y Servicio | — | Esquemas y fichas de ejemplo (`datosDeEjemplo: true`, `revisado: false`) | `CLIENTE_ID=turia` genera páginas con datos de ejemplo solo en pruebas |
| 2.2 | Plantilla visual de Turia y portafolio interactivo: filtros, galería con teclado, comparador antes/después con teclado, animación al desplazarse con CSS y JS solo en islas, `prefers-reduced-motion` | — | e2e y axe en móvil y escritorio; presupuesto de rendimiento (peso de JS y LCP de laboratorio) medido en e2e | AA y presupuesto en verde |
| 2.3 | Formulario de petición configurable: modo catálogo (el de Baltaretu, igual) y modo proyecto (tipo de trabajo, descripción, medidas aproximadas, localidad, plazo y hasta 3 fotos) | **10** `adjuntos y detalles de petición`: `CREATE TABLE adjuntos (id TEXT PRIMARY KEY, ambito TEXT NOT NULL, ref TEXT NOT NULL, tipo TEXT NOT NULL, bytes BLOB NOT NULL, tamano INTEGER NOT NULL, creado TEXT NOT NULL, creado_por TEXT NOT NULL)`; `CREATE INDEX adjuntos_ref ON adjuntos (ambito, ref)`; `ALTER TABLE presupuestos ADD COLUMN detalles TEXT NOT NULL DEFAULT '{}'` | Tipo comprobado por los bytes (JPEG, PNG, WebP), tamaño y número máximos, Turnstile obligatorio para las fotos ([D-05](discrepancias.md)), fotos nunca publicadas y revisión en el panel; la petición de Baltaretu es idéntica | e2e del formulario de Turia; la base de Baltaretu migra sin pérdida |
| 2.4 | Secciones del sector (servicios, proceso, nosotros, FAQ, opiniones, guías) y SEO local (`LocalBusiness` y `Service` sin `[PLACEHOLDER]`) | — | JSON-LD válido y sin huecos | — |
| 2.5 | Muestrario público de materiales y acabados (solo los marcados como visibles, sin coste) | — (depende de 3.5; antes, contenido de ejemplo) | El coste interno nunca aparece en el HTML | — |

### F3 · Panel operativo

**Mínimo para salir** (3.1–3.3):

| PR | Descripción | Migración (SQL) | Tests nuevos |
| --- | --- | --- | --- |
| 3.1 | Presupuestos a cliente con PDF, envío (mailto y WhatsApp, [D-13](discrepancias.md)) y paso a factura o factura de anticipo (reutiliza `lineasDePresupuesto`) | **11** `presupuestos a cliente`: `CREATE TABLE presupuestos_cliente (id TEXT PRIMARY KEY, serie TEXT, numero INTEGER, codigo TEXT UNIQUE, estado TEXT NOT NULL DEFAULT 'borrador' CHECK (estado IN ('borrador','enviado','aceptado','rechazado','caducado')), fecha TEXT NOT NULL, validez TEXT, cliente_id TEXT NOT NULL, obra_id TEXT, anticipo_pct REAL NOT NULL DEFAULT 0, total REAL NOT NULL DEFAULT 0, datos TEXT NOT NULL, creado TEXT NOT NULL, actualizado TEXT NOT NULL, actualizado_por TEXT NOT NULL, UNIQUE (serie, numero))`; `CREATE INDEX presupuestos_cliente_estado ON presupuestos_cliente (estado, fecha)` | Numeración correlativa por serie y año; anticipo = total con IVA × porcentaje y restante = total − anticipo, redondeados a céntimos (casos límite); estados y caducidad; el PDF no lleva costes internos; la factura de anticipo es una factura `ordinaria` con la marca `anticipoDe` en `datos` (el `CHECK` de `tipo` no se toca) |
| 3.2 | Clientes y facturas: campos nuevos opcionales en `clientes.datos` ([D-06](discrepancias.md)); IVA fijo del cliente; precio con IVA por línea en la interfaz y el PDF | **12** `vínculos de factura`: `ALTER TABLE facturas ADD COLUMN presupuesto_cliente_id TEXT` | El NIF/CIF se valida igual que hoy; con `ivaFijo`, la interfaz no ofrece elegir; los datos personales no van a registros; las reglas de emisión, rectificativas y huella no cambian (tests actuales) |
| 3.3 | Inicio: resumen del mes, agenda próxima, alertas calculadas en el servidor y accesos a los módulos activos | — | Cada alerta con sus datos de prueba; con los módulos de Baltaretu, el inicio de Baltaretu no cambia |

**Segunda versión** (3.4–3.11):

| PR | Descripción | Migración (SQL) |
| --- | --- | --- |
| 3.4 | Proveedores: alta, edición, búsqueda, archivado y CSV | **13**: `CREATE TABLE proveedores (id TEXT PRIMARY KEY, nombre TEXT NOT NULL, nif TEXT NOT NULL DEFAULT '', datos TEXT NOT NULL, archivado INTEGER NOT NULL DEFAULT 0, actualizado TEXT NOT NULL, actualizado_por TEXT NOT NULL)` |
| 3.5 | Materiales: árbol de categorías gestionable, atributos por categoría, alta rápida en el móvil y visibilidad en la web y el simulador | **14**: `CREATE TABLE materiales_categorias (id TEXT PRIMARY KEY, nombre TEXT NOT NULL, orden INTEGER NOT NULL DEFAULT 0, atributos TEXT NOT NULL DEFAULT '[]', archivada INTEGER NOT NULL DEFAULT 0)`; `CREATE TABLE materiales (id TEXT PRIMARY KEY, categoria_id TEXT NOT NULL, tipo TEXT NOT NULL CHECK (tipo IN ('interior','exterior')), ubicacion TEXT CHECK (ubicacion IN ('frontal','trasero')), nombre TEXT NOT NULL, coste REAL, proveedor_id TEXT, visible INTEGER NOT NULL DEFAULT 0, datos TEXT NOT NULL, archivado INTEGER NOT NULL DEFAULT 0, actualizado TEXT NOT NULL, actualizado_por TEXT NOT NULL)`; `CREATE INDEX materiales_categoria ON materiales (categoria_id, tipo)` |
| 3.6 | Pedidos a proveedor: desde el catálogo interno, PDF y mensaje **sin precios internos**, estados borrador, enviado y recibido | **15**: `CREATE TABLE pedidos_proveedor (id TEXT PRIMARY KEY, codigo TEXT UNIQUE, estado TEXT NOT NULL DEFAULT 'borrador' CHECK (estado IN ('borrador','enviado','recibido')), proveedor_id TEXT NOT NULL, obra_id TEXT, presupuesto_cliente_id TEXT, fecha TEXT NOT NULL, coste REAL NOT NULL DEFAULT 0, datos TEXT NOT NULL, actualizado TEXT NOT NULL, actualizado_por TEXT NOT NULL)` |
| 3.7 | Obras y hoja de medidas, con documentos y fotos privados en `adjuntos` y resumen económico | **16**: `CREATE TABLE obras (id TEXT PRIMARY KEY, cliente_id TEXT NOT NULL, estado TEXT NOT NULL DEFAULT 'visita-pendiente' CHECK (estado IN ('visita-pendiente','medidas-tomadas','diseno','presupuesto-enviado','aceptada','en-fabricacion','lista-para-montaje','montada','entregada','cerrada')), tipo_trabajo TEXT NOT NULL DEFAULT '', datos TEXT NOT NULL, creada TEXT NOT NULL, actualizada TEXT NOT NULL, actualizada_por TEXT NOT NULL)`; `ALTER TABLE facturas ADD COLUMN obra_id TEXT`; `ALTER TABLE gastos ADD COLUMN obra_id TEXT` |
| 3.8 | Agenda: visitas, entregas y montajes; lista del día y de la semana; ICS | **17**: `CREATE TABLE agenda (id TEXT PRIMARY KEY, tipo TEXT NOT NULL CHECK (tipo IN ('visita','entrega','montaje','otro')), inicio TEXT NOT NULL, fin TEXT, obra_id TEXT, titulo TEXT NOT NULL, datos TEXT NOT NULL DEFAULT '{}', actualizado TEXT NOT NULL, actualizado_por TEXT NOT NULL)`; `CREATE INDEX agenda_inicio ON agenda (inicio)` |
| 3.9 | Garantía e incidencias por obra (sin plazos inventados, T-11) | **18**: `CREATE TABLE incidencias (id TEXT PRIMARY KEY, obra_id TEXT NOT NULL, fecha TEXT NOT NULL, estado TEXT NOT NULL DEFAULT 'abierta' CHECK (estado IN ('abierta','resuelta')), datos TEXT NOT NULL, actualizado TEXT NOT NULL, actualizado_por TEXT NOT NULL)` |
| 3.10 | Informes y KPIs del sector, que reutilizan `informes.ts` (conversión, importe medio, pendiente de cobro y de anticipos, gasto por proveedor, margen por obra, obras por estado, tiempo de la petición al presupuesto) | — |
| 3.11 | Herramientas, instrucciones y banco de frases del asistente por sector, filtrados por módulos | — |

Tests de cada PR de la segunda versión:

- repositorio sobre D1 local;
- reglas puras (cálculos, estados, CSV);
- e2e y axe de cada pantalla (controles de 48 px);
- la base de Baltaretu migra sin pérdida (`tests/baseline/d1.test.ts`, automático);
- módulo apagado en Baltaretu: ni rutas, ni menú, ni herramientas.

La numeración de las migraciones sigue el orden en que se fusionan las PRs. Si cambia el orden, cambia el número, pero nunca el contenido de una migración ya fusionada.

### F4 · Simulador

| PR | Descripción |
| --- | --- |
| 4.1 | Entrega A, sin IA: foto recortada y reducida en el navegador, opciones del muestrario, ficha de configuración, montaje visual con las muestras y envío como petición. Generador simulado en desarrollo y en la CI. e2e y axe del flujo. |
| 4.2 | Spike: banco de fotos reales (con y sin máscara) con FLUX.2 klein 4B, FLUX.2 dev y SD 1.5 inpainting, midiendo calidad, tiempo, fallos y neuronas. Se confirman en la documentación oficial los límites de tamaño, el formato multipart y el precio. Decisión documentada: si la calidad no es aceptable, se queda solo la entrega A. |
| 4.3 | Entrega B, con la interfaz `GeneradorDeImagen` y un adaptador para Workers AI. Incluye: <ul><li>topes diario y mensual por cliente, con el uso contado en D1 (migración `simulador_uso`, con número según el orden);</li><li>Turnstile y límite por visitante;</li><li>consentimiento antes de subir y la cláusula «Imagen orientativa generada automáticamente; no vinculante»;</li><li>nada se guarda si no se envía, los temporales se borran y la foto nunca va a registros ni a analítica.</li></ul> |

### F5 · Operación

| PR | Descripción |
| --- | --- |
| 5.1 | Comando de alta, baja y exportación de un cliente: genera `wrangler.<id>.jsonc` y pasos manuales. **No crea recursos reales**: los crea el propietario. |
| 5.2 | Copia diaria multicliente, una matriz que incluye la exportación completa de D1 ([D-04](discrepancias.md) y [D-11](discrepancias.md)). |
| 5.3 | Estado operativo por cliente: versión, última publicación, uso de IA y tamaño de D1. |

Solo bajo petición expresa: R2, acceso propio y VeriFactu.
