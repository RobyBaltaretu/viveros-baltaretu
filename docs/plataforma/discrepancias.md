# Discrepancias entre el encargo y el código o los límites reales

Cada punto dice qué se pidió, qué se encontró al comprobarlo y la alternativa más sencilla. Si una alternativa necesita una decisión del propietario, está también en [preguntas.md](preguntas.md).

**Nota sobre las fuentes.** Desde esta sesión, `developers.cloudflare.com` no se puede abrir (la red de la sesión no permite ese dominio). Las cifras de Cloudflare de abajo salen de búsquedas que citan esa documentación, y van marcadas **«por confirmar»**. Hay que confirmarlas en la página oficial antes de decidir nada que dependa de ellas, y volver a comprobarlas al llegar a cada escala.

## D-01 · Numeración de migraciones

- **Encargo:** «migraciones versionadas consecutivas (la 8 en adelante)».
- **Código:** la última es la **9** (`inventario`, `src/server/data/d1/migraciones.ts:208`). La 8 ya existe (conversaciones anteriores del asistente).
- **Alternativa:** la primera migración nueva será la **10**. `tests/baseline/d1.test.ts` comprueba que las versiones son consecutivas.

## D-02 · Una D1 por cliente en el plan gratuito

- **Encargo:** una instalación por cliente (un Worker, una D1 y un dominio) en la misma cuenta, para 6, 10, 20 y 50 clientes, todo gratis.
- **Límites (por confirmar):**
  - D1 Free: **10 bases por cuenta**, 500 MB por base y **5 GB en total por cuenta** ([límites de D1](https://developers.cloudflare.com/d1/platform/limits/)).
  - Workers Builds Free: **3.000 minutos al mes y 1 build a la vez por cuenta**, con 20 minutos como máximo por build ([límites de Builds](https://developers.cloudflare.com/workers/ci-cd/builds/limits-and-pricing/)).
  - Workers Free: 100.000 peticiones al día y 10 ms de CPU por petición ([límites de Workers](https://developers.cloudflare.com/workers/platform/limits/)).
  - Número de Workers por cuenta en Free: una fuente secundaria dice 100. **No está confirmado.**
- **Consecuencias:**
  - Con una sola cuenta gratuita caben como mucho **unas 9 instalaciones**. Baltaretu ya usa una base, y conviene dejar margen para una de pruebas.
  - Las fotos guardadas en D1 comparten los 5 GB de toda la cuenta.
  - Los builds de todos los clientes van en cola, uno detrás de otro.
- **Alternativa más sencilla:** mantener la decisión 1 hasta 6–9 clientes. Antes del cliente 9 hay que elegir entre tres caminos:
  - (a) Pasar la cuenta a Workers Paid (de pago, solo con decisión expresa del propietario).
  - (b) Repartir los clientes en varias cuentas de Cloudflare, por oleadas. Hay que revisar si las condiciones de uso lo permiten.
  - (c) Poner varios clientes pequeños en una D1 compartida con una columna de cliente. Esto **contradice** el aislamiento de la decisión 1: no se recomienda.
- **Recomendación por defecto:** (a) cuando haya ingresos por suscripción. El código no cambia entre (a) y (b), porque cada cliente ya tiene su configuración propia (1.1).

## D-03 · Las colecciones de contenido están cerradas en D1

- **Encargo:** tipos de contenido declarativos por paquete (Proyecto, Servicio…).
- **Código:** `entradas.coleccion` tiene `CHECK (coleccion IN ('catalogo', 'ajustes', 'paginas', 'proyectos', 'guias'))` (`migraciones.ts:21`). En SQLite un `CHECK` no se cambia sin rehacer la tabla, y la regla 3 prohíbe rehacer o reinterpretar lo que existe.
- **Alternativa:** cada tipo de contenido de un paquete declara en qué **colección física** se guarda, que tiene que ser una de esas cinco.
  - En el vivero, todo queda igual.
  - En carpintería: Proyecto → `proyectos`; Servicio → `catalogo`; páginas del sector (proceso, nosotros, FAQ) → `paginas`; guías → `guias`.
  - El esquema Zod y el nombre visible son los del paquete.
  - Así no hace falta ninguna migración. Si algún día un sector necesitara un sexto tipo, se añadiría una tabla nueva (aditiva), no un `CHECK` nuevo.

## D-04 · `npm run contenido:copia` no copia los datos de gestión

> **Resuelta (P-03):** los datos de Baltaretu en D1 no se usan, así que no hace falta copia previa. Para cuando haya datos reales, la copia diaria multicliente (5.2) incluirá la exportación completa.

- **Encargo:** antes del primer cambio de base de datos, el propietario hace una copia con `npm run contenido:copia`.
- **Código:** esa copia descarga por HTTP el **contenido publicado y sus fotos** (`src/server/contenido/copia.ts:3-5`). **No incluye** usuarios, clientes, facturas, gastos, tickets, inventario, presupuestos ni conversaciones, que son justo las tablas que tocan las migraciones.
- **Alternativa (sin coste):** antes de desplegar la primera migración nueva (la 10), el propietario hace **además**:
  - una exportación completa con `npx wrangler d1 export viveros-baltaretu --remote --output=copia-AAAA-MM-DD.sql`, guardada fuera del repositorio porque contiene datos personales y fiscales;
  - una comprobación de que D1 Time Travel está disponible: según las búsquedas, permite volver hasta 7 días atrás en el plan gratuito (por confirmar en la [documentación de Time Travel](https://developers.cloudflare.com/d1/reference/time-travel/)).

  Queda anotado en `pasos-manuales.md` cuando llegue esa PR. La copia diaria multicliente (5.2) debería incluir también esta exportación.

## D-05 · Turnstile es opcional hoy

- **Código:** `src/pages/api/presupuesto.ts:54,81` solo verifica Turnstile si existe `TURNSTILE_SECRET_KEY`. Si no existe, la única protección es el campo trampa.
- **Encargo:** las fotos que suba un visitante anónimo exigen Turnstile.
- **Alternativa:** el formulario de Baltaretu se queda como está. La **subida de fotos anónima** (2.3 y simulador) solo se activa si hay clave de Turnstile; sin clave, el formulario no ofrece fotos y el servidor las rechaza.

## D-06 · Datos ampliados de clientes sin migración

- **Código:** la tabla `clientes` guarda casi todo en una columna JSON, `datos` (`migraciones.ts:105-113`). Faltan la dirección de obra, el contacto y la forma de pago habitual. Hoy el contacto se mete en `notas` cuando el cliente viene de una petición web (`facturas.ts:208`).
- **Alternativa:** los campos nuevos son **opcionales dentro de `datos`**. Es aditivo y no necesita SQL; los clientes ya guardados se leen igual.

## D-07 · No hay un «tipo de IVA general»

- **Código:** `IVA_POR_DEFECTO = 10` es una constante (`importes.ts:10`), y el 21 % del transporte solo lo mencionan el asistente y los datos de prueba.
- **Alternativa:** `cliente.config.json` lleva `ivaGeneral`, que es 10 en Baltaretu (el valor actual) y 21 en Turia. Turia, además, no muestra el selector de IVA (`ivaFijo: true`). `TIPOS_IVA` y el recargo de equivalencia no cambian.

## D-08 · Facturas: casi todo existe ya

- **Código:**
  - Ya existen la fecha de expedición (`fecha`), el cobro (`cobradaEl`), el vencimiento, `formaPago` y `notas`.
  - Los datos de la empresa emisora vienen de `ajustes_privados`.
  - El «precio con IVA» por línea no se guarda: se calcula (`importes.ts`).
- **Alternativa:** 3.2 solo añade lo que falte en la interfaz y en el PDF (precio con IVA por línea, desglose único del 21 %) y el vínculo opcional con la obra. No cambia las reglas de emisión, numeración ni huella.

## D-09 · Dos tipos de «presupuesto»

- **Código:** la tabla `presupuestos` son las **peticiones de la web**. Sus estados son nuevo, respondido y archivado.
- **Alternativa:** los presupuestos a cliente van en una tabla nueva, `presupuestos_cliente`, con su numeración. En la interfaz se llaman «Peticiones» (web) y «Presupuestos» (a cliente) solo en los clientes que tengan el módulo `presupuestosCliente`. En Baltaretu, la sección sigue llamándose «Presupuestos».

## D-10 · Variables de build en el prerender

- **Código:** el prerender corre en workerd. Por eso `astro.config.mjs` pasa `WORKERS_CI_BRANCH` y `PRODUCTION_BRANCH` con `vite.define`. `content.config.ts`, en cambio, se evalúa en Node y sí lee `process.env`: se comprobó con un build que imprimió `CLIENTE_ID`.
- **Alternativa:** `CLIENTE_ID` se lee en `astro.config.mjs`, se carga la configuración del cliente y se inyecta igual que esas dos variables (`import.meta.env.CLIENTE_ID` y la configuración ya validada). Sin la variable, vale `baltaretu`.

## D-11 · Copias y despliegue de una sola web

- **Código:** `copia-diaria.yml` e `importar-contenido.yml` trabajan con una sola `WEB_URL` y un solo `CONTENIDO_TOKEN`.
- **Alternativa:** en 5.2 se añade una matriz por cliente que lee `clientes/*/cliente.config.json`, con los secretos por cliente con prefijo (`CONTENIDO_TOKEN_TURIA`…). Baltaretu conserva sus nombres actuales.

## D-12 · El cupo gratuito de Workers AI es por cuenta, no por cliente

- **Límites (por confirmar):** 10.000 neuronas al día gratis **por cuenta**; después, 0,011 $ por cada 1.000 ([precios de Workers AI](https://developers.cloudflare.com/workers-ai/platform/pricing/)).
  - FLUX.2 [klein] 4B: 5,37 neuronas por bloque de entrada de 512×512 y 26,05 por bloque de salida.
- **Código:** hoy el asistente de Baltaretu tiene un tope propio de 7.000 neuronas al día.
- **Consecuencia:** todos los asistentes y simuladores de los clientes de la misma cuenta comparten esas 10.000. Con un segundo cliente, el tope de Baltaretu ya no cabe en el cupo gratuito.
- **Alternativa:**
  - Antes de activar el asistente o el simulador en un segundo cliente, el tope pasa a la configuración de cada cliente: Baltaretu conserva 7.000 mientras sea el único con IA, y los demás reparten el resto.
  - El uso se cuenta en la D1 de cada cliente, pero el límite real es de la cuenta. Hay que decidir el reparto (ver preguntas).
  - Un cálculo orientativo, sin medir: una imagen de 1024×1024 son 4 bloques de salida, unas 104 neuronas más las de entrada. El spike 4.2 debe medirlo de verdad.

## D-13 · «Envío por correo» de presupuestos al cliente final

- **Código:** `wrangler.jsonc` explica que Cloudflare Email Service, en el plan gratuito, solo envía a direcciones de destino verificadas en Email Routing (`EMAIL_DESTINO`). No puede enviar a cualquier cliente del negocio.
- **Alternativa:**
  - En 3.1, «Enviar» abre el correo de la persona (`mailto:` con el asunto y el texto preparados) y le pide adjuntar el PDF descargado, o comparte por WhatsApp un enlace o el texto.
  - Enviar directamente desde el servidor a cualquier dirección necesitaría otro servicio. Antes de elegirlo hay que comprobar sus límites y precios.

## D-14 · Fotos en D1 y tamaño de fila

- **Código:** las fotos se guardan como BLOB en D1 (`fotos` y `tickets`).
- **Consecuencia:** con varios clientes, la suma de fotos cuenta contra los 5 GB de la cuenta (D-02). Además, hay un tamaño máximo por fila; no se pudo confirmar la cifra desde esta sesión.
- **Alternativa:** mantener D1 (decisión 9) y limitar el tamaño en el servidor, reduciendo la foto en el navegador como hoy. Hay que pasar a R2 antes de llegar al 70 % de los 5 GB. La interfaz de almacenamiento (1.x) deja hecho ese cambio.

## D-15 · Formato de código de la PR 60

- **Hallazgo:** al cerrar la PR 60 (resumen del inventario) se pasó Prettier sin la configuración del repositorio. Cinco archivos quedaron con comillas dobles y líneas cortas:
  - `src/server/panel/inventario.ts`, `navegacion.ts` e `iconos.ts`;
  - `tests-e2e/panel.spec.ts` y `tests/panel/inventario.test.ts`.
- **Impacto:** es solo de estilo; el comportamiento no cambió (CI en verde).
- **Alternativa:** una PR pequeña de estilo que los devuelva al formato del resto del repositorio, sin cambiar nada más. El repositorio no tiene configuración de Prettier: se propone no añadirla para no reformatear todo.

## D-16 · PDF de los presupuestos

- **Encargo:** un PDF profesional del presupuesto.
- **Código:** las facturas generan el PDF en el navegador con un script empaquetado (pdf-lib). Si se añade otro script empaquetado, cambian los archivos JavaScript del build de Baltaretu, que vigila la línea base. Generarlo en el Worker gasta CPU, con un límite de 10 ms por petición en el plan gratuito.
- **Alternativa aplicada (3.1b):** una página para imprimir (`/panel/presupuestos-cliente/[id]/imprimir`), con estilos de impresión. Se guarda como PDF desde el diálogo del navegador, en el ordenador y en el móvil. El PDF sale nítido y el Worker no gasta CPU. Si se quiere un archivo PDF generado directamente, se puede reutilizar pdf-lib cuando se ajuste la línea base para los scripts que solo usa el panel. Esa decisión la toma el propietario.
