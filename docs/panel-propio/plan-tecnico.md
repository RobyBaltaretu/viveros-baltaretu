# Plan técnico: panel propio y asistente

Tarea 0.2 de la hoja de ruta. Verificado el 14 de octubre de 2026 en la documentación oficial de Cloudflare (repositorio `cloudflare/cloudflare-docs`, rama `production`). Las decisiones que cambian la definición están en [decisiones.md](decisiones.md) y lo que tiene que hacer el propietario, en [pasos-manuales.md](pasos-manuales.md).

## 1. Límites gratuitos verificados
| Servicio | Límite del plan gratuito | Uso previsto |
|---|---|---|
| Workers | 100.000 peticiones/día; 10 ms de CPU por petición (las esperas a D1 o `fetch` no cuentan); 50 subpeticiones; 5 Cron Triggers | Panel y API: decenas de peticiones al día. Páginas del panel renderizadas en el servidor sin frameworks pesados |
| D1 | 10 bases; 500 MB por base; 5 GB por cuenta; 5 M filas leídas/día; 100.000 filas escritas/día; filas y BLOB de hasta 2 MB; 50 consultas por invocación; Time Travel de **7 días** | Contenido (~25 entradas), fotos comprimidas (~300 KB cada una), presupuestos |
| R2 | 10 GB-mes, 1 M operaciones A y 10 M B al mes, salida gratis. **Exige contratar la suscripción de R2 con un método de pago** | No se usa (ver decisiones) |
| KV | 1 GB, 1.000 escrituras/día | No hace falta |
| Cloudflare Access (Zero Trust Free) | Hasta 50 usuarios; inicio de sesión con código de un solo uso por email (One-time PIN), sin proveedor de identidad | 3 usuarios como máximo |
| Workers AI | 10.000 neuronas/día gratis en el plan Free; sin pago posible por encima (se corta) | ~37 neuronas por orden con Llama 3.3 70B: unas 270 órdenes/día |
| Workers Builds | 3.000 min/mes; 1 build a la vez; 20 min por build; Deploy Hooks: 10/min por Worker | Un build (~2 min) por "Publicar cambios" |

## 2. Cómo funciona cada pieza
- **Access con código por email:** Access envía un código de un solo uso a las direcciones permitidas en la política de la aplicación. En cada petición añade el JWT en la cabecera `Cf-Access-Jwt-Assertion` (y la cookie `CF_Authorization`). El Worker valida la firma RS256 con las claves de `https://<equipo>.cloudflareaccess.com/cdn-cgi/access/certs` (eligiendo la clave por `kid`), el emisor y la audiencia (`AUD` de la aplicación) con la librería `jose`, como en el ejemplo oficial para Workers. Además de Access, el Worker comprueba el rol del email en D1: sin validación correcta no se sirve nada del panel.
- **Deploy Hook:** se crea en *Workers & Pages → Worker → Settings → Builds → Deploy Hooks* para la rama `main`. Un `POST` sin cabeceras a `https://api.cloudflare.com/client/v4/workers/builds/deploy_hooks/<ID>` lanza un build; si ya hay uno en cola devuelve el mismo (`already_exists`). El build ejecuta el comando de despliegue `npm run desplegar`, que publica solo si lleva publicaciones del panel (decisión 22).
- **Cómo lee D1 el build:** el token que crea Workers Builds no tiene permiso de D1 (solo Workers Scripts, KV y R2). En vez de dar más permisos, el build descarga el contenido publicado desde el propio Worker: `GET /api/contenido/exportacion` y `/api/contenido/foto`, protegidos con un token compartido (`CONTENIDO_TOKEN`, secreto de runtime y de build). `npm run build` ejecuta antes `scripts/contenido/descargar.mjs`, que escribe `src/content` y `src/assets` con el mismo formato de hoy; sin las variables, construye con los archivos del repositorio (desarrollo, CI y hasta que se active el panel). Si las variables existen y la descarga falla, el build falla: nunca se publica una web vacía o a medias.
- **Recuperación de D1 en el plan gratuito:** Time Travel guarda 7 días de historial y permite restaurar a un minuto concreto (`wrangler d1 time-travel restore`). Además, una copia diaria con GitHub Actions descarga la exportación y la guarda como artefacto del repositorio 30 días; `npm run contenido:restaurar` la vuelve a cargar. Los presupuestos no van en esa copia (datos personales): ya llegan por email y quedan cubiertos por Time Travel.
- **Modelo de Workers AI:** `@cf/meta/llama-3.3-70b-instruct-fp8-fast`, que figura en la lista oficial de modelos con modo JSON (`response_format` con esquema) y es multilingüe. Coste: 26.668 neuronas por millón de tokens de entrada y 204.805 por millón de salida; una orden (~800 de entrada y ~80 de salida) gasta unas 37. Alternativa más barata dentro del proveedor intercambiable: `@cf/qwen/qwen3-30b-a3b-fp8`.

## 3. Prueba de concepto (medida)
`scripts/contenido/archivos.mjs` lee todo el contenido (21 entradas y 4 fotos), lo pasa a JSON tal como lo guardaría D1 (fotos en base64), lo vuelve a escribir como archivos y se reconstruye la web. `scripts/contenido/huella-build.mjs` compara los dos builds archivo por archivo (hash), el sitemap y los bloques JSON-LD de cada página:
- Build de producción (sin fichas de ejemplo): 47 archivos, **0 diferencias**.
- Build de rama de prueba (con las fichas de ejemplo): 128 archivos, 36 páginas con JSON-LD, **0 diferencias**.

El formato intermedio no pierde información y el build que lee de D1 genera la misma web.

## 4. Esquema de D1
Las migraciones van en `src/server/data/d1/migraciones.ts` y el Worker las aplica solo la primera vez que las necesita (tabla `esquema_version`), así que no hay que ejecutarlas a mano.

| Tabla | Para qué |
|---|---|
| `usuarios(email PK, nombre, rol, activo, creado)` | Rol `propietario`, `gerente` o `editor` (máximo un editor) |
| `entradas(coleccion, id, borrador, publicado, archivada, actualizado, actualizado_por)` | Contenido. `borrador` y `publicado` son JSON `{datos, cuerpo}` con los mismos datos que los archivos de hoy. Colecciones: `catalogo`, `ajustes`, `paginas`, `proyectos`, `guias` |
| `cambios(id, fecha, email, coleccion, entrada_id, antes, despues, origen)` | Historial y "Deshacer". `origen`: panel o asistente |
| `fotos(ruta PK, tipo, bytes BLOB, tamano, subida, subida_por)` | Fotos comprimidas; `ruta` es la misma que hoy bajo `src/assets` |
| `publicaciones(id, fecha, email, estado, detalle)` | Cada "Publicar cambios" |
| `auditoria(id, fecha, email, accion, detalle)` | Quién hizo qué |
| `presupuestos(id, fecha, estado, idioma, tipo_pedido, nombre, email, telefono, empresa, mensaje, lineas)` | Peticiones de presupuesto; estado `nuevo`, `respondido` o `archivado` |
| `asistente_uso(email, dia, usos)` | Límite diario del asistente |

## 5. Capa de repositorios (`src/server/data/`)
- `tipos.ts`: interfaces por entidad (`RepositorioContenido`, `RepositorioFotos`, `RepositorioUsuarios`, `RepositorioPresupuestos`, `RepositorioAuditoria`, `RepositorioPublicaciones`, `RepositorioUsoAsistente`) con tipos propios, sin tipos de D1.
- `d1/`: la única implementación y el único sitio con SQL. `crearRepositorios(db)` devuelve todas.
- `index.ts`: `repositorios(env)` para el Worker; los scripts de Node usan la misma función con el D1 local de `getPlatformProxy`.
- Validación: el panel, la importación y el asistente validan con los esquemas de `src/lib/*/schema.ts` antes de llamar al repositorio. Migrar a otra base (por ejemplo Postgres) es escribir otra implementación de las mismas interfaces.

## 6. Configuración de Cloudflare
- `wrangler.jsonc` de producción **no cambia** hasta que el propietario cree la base: si se añadiera el binding de D1 sin ID, Workers Builds intentaría crearla con un token sin permiso y los despliegues fallarían. El entorno `desarrollo` de `wrangler.jsonc` lleva D1 local para `npm run dev`, los tests y los e2e (`CLOUDFLARE_ENV=desarrollo`).
- Mientras falten D1 o Access, `/panel` responde "El panel todavía no está activado" y nunca se sirve sin autenticación.

## 7. Orden de PRs
Una tarea por PR, en el orden de la hoja de ruta: 0.2 (este plan), 1.1 esquema, 1.2 repositorios, 1.3 importación, 1.4 build desde D1 y comprobación de equivalencia en la CI, 2.1 acceso, 2.2 inicio, 2.3 plantas, 2.4 fotos, 2.5 resto de contenido, 2.6 publicar, historial y deshacer, 2.7 copias, 2.8 ayuda, 3.1 y 3.2 presupuestos, 4.1 a 4.4 asistente, 5.1 tests del panel y 5.3 retirada de Keystatic. Las tareas 0.3, 5.2 y 5.4 son del propietario y el gerente.

## 8. Pasos manuales del propietario
Resumen; el detalle con nombres exactos está en [pasos-manuales.md](pasos-manuales.md): crear la base D1 y pegar su ID en `wrangler.jsonc`, crear la aplicación de Access para `/panel` y `/api/panel/*`, definir las variables y secretos (`CONTENIDO_TOKEN`, `ACCESS_EQUIPO`, `ACCESS_AUD`, `PROPIETARIO_EMAIL`, `DEPLOY_HOOK_URL`), crear el Deploy Hook, importar el contenido actual y añadir los secretos de la copia diaria en GitHub.
