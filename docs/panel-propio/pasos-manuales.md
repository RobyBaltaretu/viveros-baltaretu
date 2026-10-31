# Pasos manuales del propietario

El código está preparado para que el panel funcione en cuanto se hagan estos pasos. Hasta entonces, `/panel` muestra "El panel todavía no está activado" y la web sigue construyéndose con los archivos del repositorio. Todo es gratuito. Se irá completando a medida que avancen las tareas.

## 1. Base de datos D1 (hecho)
La base `viveros-baltaretu` está creada y conectada en `wrangler.jsonc`. Si el despliegue de Workers Builds falla por permisos, añade *Account → D1 → Edit* al token de Workers Builds (*My Profile → API Tokens*).

## 2. Token de contenido
1. Genera un token: `node -e "console.log(crypto.randomUUID()+crypto.randomUUID())"`.
2. Guárdalo como **secreto** `CONTENIDO_TOKEN` en *Workers & Pages → viveros-baltaretu → Settings → Variables and Secrets* (runtime) y también en *Settings → Build → Variables and secrets* (build).

## 3. Importar el contenido actual (una vez, con la base y el token creados y la versión publicada)
Opción sin instalar nada: en GitHub, *Settings → Secrets and variables → Actions → New repository secret*, nombre `CONTENIDO_TOKEN` y el mismo valor que en Cloudflare. Después, *Actions → Importar contenido al panel → Run workflow*, con la dirección normal de la web (no la *Preview URL*, que está detrás de Access).

Opción desde tu ordenador:
```bash
CONTENIDO_TOKEN=<el token> npm run contenido:importar -- --url https://<tu web>
```
Importa todas las fichas, ajustes, páginas, proyectos, guías y fotos. Si algo no pasa la validación, no importa nada y dice qué falla.

## 4. Cloudflare Access para el panel (gratis hasta 50 usuarios)
1. *Zero Trust*. La primera vez, elige el plan **Free** y un nombre de equipo, por ejemplo `viveros-baltaretu`.
2. Inicio de sesión con código por email: *Zero Trust → Integrations → Identity providers → Add new identity provider → One-time PIN*. (Las organizaciones nuevas traen por defecto "Cloudflare" como método, que solo deja entrar a miembros de la cuenta; el gerente no lo es, por eso hace falta One-time PIN.)
3. La aplicación de Access. **En una dirección `*.workers.dev`, Access protege la dirección entera, no solo `/panel`**, así que:
   - **Con dominio propio en Cloudflare (lo definitivo):** *Access → Applications → Add an application → Self-hosted*, nombre `Panel del vivero`, destinos tu dominio con las rutas `panel`, `panel/*`, `api/panel` y `api/panel/*`, y política *Allow* con *Emails*: tu correo y el del gerente.
   - **Sin dominio (solo para probar):** *Workers & Pages → viveros-baltaretu → Settings → Domains & Routes*: activa Access **solo en las *Preview URLs*** (no en `workers.dev`, o toda la web pediría código). En *Zero Trust → Access → Applications* abre la aplicación creada y deja en la política tu correo, con One-time PIN como método. Se prueba en la *Preview URL* de cada versión + `/panel`.
4. Copia el **Application Audience (AUD) Tag** de la aplicación (*Additional settings*).
5. En el Worker (*Settings → Variables and Secrets*, runtime), añade como variables de texto:
   - `ACCESS_EQUIPO` = el nombre del equipo (lo que va antes de `.cloudflareaccess.com`).
   - `ACCESS_AUD` = el AUD Tag.
   - `PROPIETARIO_EMAIL` = tu correo. La primera vez que entres quedarás como propietario y podrás dar de alta al gerente.

Mientras falte alguna de estas variables o la base D1, `/panel` responde "El panel todavía no está activado" y no deja entrar a nadie.

## 5. "Publicar cambios" (Deploy Hook y lectura del contenido en el build)
Cuando el contenido ya esté importado (paso 3):
1. En el Worker, *Settings → Build → Variables and secrets*: añade el **secreto** `CONTENIDO_TOKEN` con el mismo valor del paso 2. Desde ese momento, cada build construye la web con el contenido publicado del panel.
2. *Settings → Builds → Deploy Hooks*: crea uno llamado `Panel del vivero` para la rama `main` y copia su dirección (`https://api.cloudflare.com/client/v4/workers/builds/deploy_hooks/...`).
3. *Settings → Variables and Secrets* (runtime): añade el **secreto** `DEPLOY_HOOK_URL` con esa dirección.
4. *Settings → Build → Build configuration*: cambia el **Deploy command** de `npx wrangler versions upload` a `npm run desplegar`. Comprueba que `SITE_URL` (o `CONTENIDO_URL`) y `CONTENIDO_TOKEN` están en las variables de build.
5. Publica la versión una última vez a mano. Desde entonces, «Publicar cambios» en el panel lanza un build que **sale solo a la web** en unos minutos; en el panel, «Últimas publicaciones» dice cuándo ya está.

Los cambios de código (los PR fusionados en `main`) siguen subiendo una versión que tú publicas en *Deployments*. Si quieres que también salgan solos, añade la variable de build `PUBLICAR_SIEMPRE` con valor `1`. Ojo: cuando el gerente publica, sale la última versión de `main`, así que un cambio de código ya fusionado y aún sin publicar sale con ella.

Sin `DEPLOY_HOOK_URL`, el panel guarda los cambios como listos para publicar y avisa de que falta configurarlo.

## 6. Copia diaria del contenido
1. En GitHub, *Settings → Secrets and variables → Actions*: además del secreto `CONTENIDO_TOKEN` (paso 3), en la pestaña *Variables* crea `WEB_URL` con la dirección pública de la web (sin barra final).
2. Cada noche, la acción *Copia diaria del contenido* guarda una copia de 30 días (fichas, textos y fotos; sin presupuestos). También se puede lanzar a mano con *Run workflow*.

**Para recuperar contenido:**
- Un cambio concreto: en el panel, *Cambios recientes → Deshacer*.
- Toda la base a un momento de los últimos 7 días (incluidos los presupuestos): D1 Time Travel, `npx wrangler d1 time-travel restore viveros-baltaretu --timestamp=<fecha ISO>`.
- Desde una copia diaria: descarga el artefacto de la acción y ejecuta `CONTENIDO_TOKEN=<token> npm run contenido:restaurar -- copia-contenido.json --url https://<tu web>`. Sin `--url` la carga en la base local para revisarla antes.

## 7. Asistente con Workers AI (gratis, 10.000 neuronas al día)
- El binding `AI` ya está en `wrangler.jsonc`: no hay que hacer nada para activarlo. Si el despliegue de Workers Builds fallara por permisos, añade *Account → Workers AI → Read* al token de Workers Builds.
- Para medir la precisión real del modelo (opcional): crea un token con *Workers AI → Read* y ejecuta en tu ordenador `CLOUDFLARE_ACCOUNT_ID=<id> CLOUDFLARE_API_TOKEN=<token> npm run asistente:banco -- --workers-ai`. Escribe `docs/panel-propio/precision-asistente-workers-ai.md`; súbelo en un PR o pásame el resultado.

### 7.1 Asistente completo (opcional: más capacidad gratis con Groq)
El asistente usa Workers AI (`glm-4.7-flash`, unas 90 conversaciones al día dentro del cupo gratuito, compartido con la lectura de tickets). Si se agota, sigue en modo básico hasta el día siguiente. Para tener un respaldo gratuito:
1. Crea una cuenta en https://console.groq.com (sin tarjeta) y genera una *API key*.
2. En Cloudflare, *Workers & Pages → viveros-baltaretu → Settings → Variables & Secrets*, añade el **secreto** `GROQ_API_KEY` con esa clave.
3. Ten en cuenta que con Groq los mensajes del asistente (que pueden incluir datos de clientes y facturas) pasan por sus servidores. Según sus condiciones no los usan para entrenar, pero decide tú si te parece bien.

## 8. Facturas
1. En el panel, **Facturas → Datos de facturación**: razón social, NIF, dirección fiscal y, si cobráis por transferencia, el IBAN. Sin esos datos el panel no deja emitir.
2. Si este año ya habéis hecho facturas con otro programa, consulta con el asesor antes de emitir la primera: el panel empieza la serie `F2026` en el número 1. Si hace falta, se puede cambiar la serie en el código.
3. Pregunta al asesor por **VeriFactu** (el sistema de la AEAT para los programas de facturación): el panel numera, guarda copia inalterable y encadena huellas, pero no envía los registros a Hacienda ni pone el código QR. Si os afecta, habrá que añadirlo o facturar con un programa certificado.
4. De vez en cuando, en **Facturas**, pulsa «Descargar la copia» y guárdala fuera del panel.


## Creaciones Turia (segundo cliente, solo panel)
El mismo repositorio construye el panel de Turia con la variable `CLIENTE_ID=turia`. Usa su propio Worker y su propia D1 (`wrangler.creacionesturia.jsonc`), y nada de Baltaretu cambia. Todo es gratuito. Mientras no haya dominio propio, la dirección será `https://creacionesturia.<tu-subdominio>.workers.dev`.

1. **Base de datos (hecho).** La D1 `creacionesturia` está creada y su Database ID está en `wrangler.creacionesturia.jsonc`. Las tablas las crea el Worker la primera vez que se usa.
2. **Worker con Workers Builds.** Ve a *Workers & Pages → Create → Import a repository* y elige este repositorio:
   - Nombre del proyecto: `creacionesturia`. Rama de producción: `main`.
   - *Build command*: `npm run build`.
   - *Deploy command*: `npx wrangler deploy` la primera vez. Después, cámbialo a `npx wrangler versions upload` para aprobar tú cada cambio de código en *Deployments*, igual que en Baltaretu.
   - *Build variables* (**obligatorias**: sin ellas el build falla con «Falta la variable de build SITE_URL» y, sin `CLIENTE_ID`, construiría Baltaretu): `CLIENTE_ID` = `turia` y `SITE_URL` = la dirección `https://creacionesturia.<tu-subdominio>.workers.dev`, sin barra final. Ponlas en *Settings → Build → Variables and secrets* del proyecto `creacionesturia` (no en las variables del Worker, que son las de ejecución).
   - El build deja en `dist/` la configuración de Turia (Worker `creacionesturia` con la D1 `creacionesturia`), y es la que usa `wrangler` sin `-c` (comprobado con `wrangler deploy --dry-run`). No pongas `-c wrangler.creacionesturia.jsonc` en el comando: falla porque esa configuración apunta al código sin construir.
3. **Acceso (Cloudflare Access, gratis hasta 50 usuarios).** Turia no tiene web pública, así que Access puede proteger la dirección **entera**:
   - En *Zero Trust → Access → Applications → Add an application → Self-hosted*, el destino es `creacionesturia.<tu-subdominio>.workers.dev`, con política *Allow* y *Emails* para las personas de Turia. Usa el mismo equipo y el mismo One-time PIN del paso 4.
   - En el Worker `creacionesturia`, en *Settings → Variables and Secrets*, añade `ACCESS_EQUIPO`, `ACCESS_AUD` (el AUD de esta aplicación) y `PROPIETARIO_EMAIL` (el correo de quien será el propietario del panel de Turia).
4. **Probarlo.** Entra en la dirección: lleva a `/panel`. En *Ajustes → Datos de prueba* puedes cargar 3 proyectos de ejemplo en *Portafolio*, y quitarlos después.
5. **Asistente con Groq.** En Turia el asistente prueba primero Groq (`openai/gpt-oss-120b`, gratis con límites por minuto y por día) y, si falla, Workers AI y las reglas locales. Crea una clave en https://console.groq.com (sin tarjeta) y, en el Worker `creacionesturia`, *Settings → Variables and Secrets*, añade el **secreto** `GROQ_API_KEY`. Sin él, Turia usa solo Workers AI, cuyo cupo diario comparte con Baltaretu (preguntas P-02). Si Groq responde «demasiadas peticiones» y nadie más puede, el chat lo dice y pide esperar un minuto. El modelo se cambia en `clientes/turia/cliente.config.json` (`ia.modelos.groq`).
