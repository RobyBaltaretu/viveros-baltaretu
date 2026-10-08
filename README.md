# Web del vivero

Web corporativa y catálogo de un vivero mayorista de plantas ornamentales. Está hecha con Astro y Tailwind CSS y se publica en Cloudflare Workers (plan gratuito).

Las normas del proyecto están en [CLAUDE.md](CLAUDE.md). Los comandos de desarrollo, en su sección "Comandos".

## Cómo funciona

- Las páginas son estáticas: se generan en cada build a partir de `src/content/`. Cloudflare las sirve como *Static Assets*, gratis y sin límite de peticiones.
- Solo `/api/presupuesto` y el panel `/keystatic` ejecutan código en el Worker. El plan gratuito cubre 100.000 peticiones al día.
- El gerente edita el catálogo en `/keystatic` con Keystatic Cloud, sin cuenta de GitHub. Cada vez que guarda, Keystatic Cloud hace un commit en `main`, lo que lanza un build. Esa versión no se publica hasta que la apruebas.
- Las fotos subidas desde el panel se guardan en el repositorio, en `src/assets/catalogo/<ficha>/`, y Astro las optimiza en el build. No se usa Cloud Images porque es de pago.
- El esquema de cada ficha del catálogo está en `src/lib/catalogo/schema.ts`. Si una ficha no lo cumple, el build falla y la web sigue con la versión anterior.
- Las fichas con `revisado: false` no salen en producción. Sí se ven en local y en los builds de ramas que no son `main`.
- **Producción requiere aprobación manual.** Cada build de `main` sube una *versión* del Worker con `wrangler versions upload`, pero no la publica. La publicas tú desde el panel de Cloudflare (paso 10).

### Peticiones de presupuesto

1. El formulario envía los datos a `/api/presupuesto`.
2. El Worker valida los datos y comprueba el anti-spam: Cloudflare Turnstile, verificado en el servidor, y un campo trampa invisible.
3. Después envía un aviso por email a la dirección de la empresa con **Cloudflare Email Service**. Es gratuito si se envía a direcciones verificadas en Email Routing.
4. El email lleva la dirección del cliente en "Responder a", así que basta con contestarlo para escribirle.
5. El cliente ve la confirmación en la web. No recibe email automático, porque en el plan gratuito solo se puede enviar a direcciones verificadas.

### Servicios y límites del plan gratuito (comprobados el 7 de octubre de 2026)

| Servicio | Límite gratuito |
| --- | --- |
| Workers, archivos estáticos | Peticiones gratis e ilimitadas |
| Workers, código (`/api/*`) | 100.000 peticiones al día y 10 ms de CPU por petición |
| Workers Builds | 3.000 minutos de build al mes, 1 build a la vez |
| Turnstile | Gratis, sin límite de verificaciones, hasta 20 widgets |
| Email Service | Envío gratis a direcciones de destino verificadas |
| Keystatic Cloud | Hasta 3 usuarios por equipo |

## Cómo gastar pocos builds

En Workers el límite no es de 500 builds al mes (ese es el de Cloudflare Pages), sino de **3.000 minutos de build al mes**. Un build de esta web tarda 1 o 2 minutos. Aun así, cada guardado en el panel genera un build, así que conviene no gastarlos sin necesidad:

1. **Rutas que disparan build (*Build watch paths*).** Configura que solo construyan los cambios que afectan a la web. Así, cambiar el README, CLAUDE.md, los tests o la CI no gasta build (paso 6.4).
2. **Sin *Preview Builds*.** La CI de GitHub ya compila cada PR sin gastar minutos de Cloudflare. Para ver una rama, usa `npm run preview` en local.
3. **Caché de build activada.** Guarda las dependencias y las imágenes ya optimizadas (`node_modules/.astro`), así que cada build tarda menos.
4. **Agrupar cambios en el panel.** Cada vez que el gerente pulsa "Guardar" se genera un build. Lo mejor es rellenar la ficha entera y guardar una vez. Como nada se publica sin tu aprobación, no hace falta guardar "para ver cómo queda".
5. **Si aun así no llega:** se pueden desactivar los builds automáticos de `main` y lanzarlos con un *Deploy Hook*, ya sea con un botón "Publicar" o una vez al día. No está montado; pídelo si hace falta.

Referencia: 30 guardados al día son unos 900 builds y unos 1.500 minutos al mes, la mitad del límite.

## Pasos manuales para el propietario

Hazlos en este orden. No hay que poner ninguna clave en el repositorio: los valores se escriben solo en el panel de Cloudflare.

### 1. Añadir el dominio a Cloudflare

1. Crea una cuenta en https://dash.cloudflare.com (plan gratuito).
2. Pulsa **Add a domain** (o **Onboard a domain**), escribe el dominio y elige el plan **Free**.
3. En tu registrador de dominios, cambia los *nameservers* por los dos que te indica Cloudflare. Espera a que el dominio aparezca como **Active**.

### 2. Activar Email Routing y verificar el buzón de destino

1. Ve a **Compute → Email Service → Email Routing** y activa Email Routing en el dominio. Cloudflare crea los registros DNS necesarios.
2. En **Email Routing → Destination Addresses**, añade el correo donde quieres recibir los presupuestos (por ejemplo, el del gerente).
3. Abre el email de verificación que te llega a ese buzón y confírmalo. Hasta que esté verificado no se puede enviar nada.
4. Elige el remitente de los avisos, una dirección de tu dominio que no hace falta que exista como buzón (por ejemplo, `presupuestos@tudominio.es`). Apúntala para el paso 7.

### 3. Crear el widget de Turnstile

1. Ve a **Turnstile → Add widget**.
2. Nombre: `Web vivero`. En *Hostnames* añade tu dominio y el subdominio `*.workers.dev` del Worker (lo verás en el paso 5). Modo: **Managed**.
3. Copia la **Site Key** (pública) y la **Secret Key** (secreta). Las usarás en los pasos 6 y 7.

### 4. Crear el proyecto en Keystatic Cloud

1. Entra en https://keystatic.cloud y crea una cuenta. Puedes entrar con tu cuenta de GitHub.
2. Crea un equipo (*team*). El plan gratuito permite hasta 3 usuarios por equipo.
3. Dentro del equipo, crea un proyecto y conéctalo al repositorio `robybaltaretu/viveros-baltaretu`. Si te lo pide, instala la aplicación de Keystatic en GitHub solo para ese repositorio.
4. Abre los ajustes (*settings*) del proyecto. Ahí aparece el valor `cloud.project`, con el formato `equipo/proyecto`. Apúntalo: es el valor de `PUBLIC_KEYSTATIC_CLOUD_PROJECT` del paso 6. Keystatic Cloud no necesita ninguna clave en Cloudflare.

### 5. Crear el Worker conectado a GitHub

1. Ve a **Compute → Workers & Pages → Create application → Import a repository**.
2. Conecta GitHub y elige `robybaltaretu/viveros-baltaretu`.
3. Nombre del proyecto: `viveros-baltaretu`. Debe coincidir con `name` en `wrangler.jsonc`.
4. **Build command:** `npm run build`
5. **Deploy command:** `npx wrangler versions upload`. Con este comando el build sube una versión pero no la publica.
6. Guarda. El primer build fallará porque falta `SITE_URL`; se arregla en el paso siguiente.

### 6. Ajustes de build

En **Workers & Pages → viveros-baltaretu → Settings → Build**:

1. **Variables and secrets** (variables de build):

   | Nombre | Valor |
   | --- | --- |
   | `SITE_URL` | `https://tudominio.es` sin barra final. Hasta tener dominio, la URL `https://viveros-baltaretu.<tu-subdominio>.workers.dev` |
   | `PUBLIC_TURNSTILE_SITE_KEY` | La *Site Key* del paso 3 |
   | `PUBLIC_KEYSTATIC_CLOUD_PROJECT` | El valor `equipo/proyecto` del paso 4.4 |
   | `PUBLIC_GA4_ID` | Opcional. ID de medición de Google Analytics 4 (`G-…`). Si lo pones, sale el aviso de cookies y GA4 solo se carga cuando la persona acepta. Vacío = sin analítica. |

2. **Branch control:** rama de producción `main`. Desmarca **Enable Preview Builds**.
3. **Build cache:** actívala.
4. **Build watch paths:**
   - *Include paths:* `src/*, public/*, astro.config.mjs, keystatic.config.ts, wrangler.jsonc, package.json, package-lock.json`
   - *Exclude paths:* vacío.

### 7. Variables y secretos del Worker

En **Workers & Pages → viveros-baltaretu → Settings → Variables & Secrets** (se usan cuando la web está funcionando):

| Nombre | Tipo | Valor |
| --- | --- | --- |
| `TURNSTILE_SECRET_KEY` | **Secret** | La *Secret Key* del paso 3 |
| `EMAIL_DESTINO` | Text | El correo verificado en el paso 2.3 |
| `EMAIL_REMITENTE` | Text | La dirección del paso 2.4, por ejemplo `presupuestos@tudominio.es` |

`wrangler.jsonc` tiene `keep_vars: true`, así que los despliegues no borran estos valores.

### 8. Conectar el dominio al Worker

1. En **Workers & Pages → viveros-baltaretu → Settings → Domains & Routes → Add → Custom domain**, escribe `tudominio.es`. Repite con `www.tudominio.es` si lo usas.
2. Cambia `SITE_URL` (paso 6.1) a la URL del dominio y lanza un build nuevo.

### 9. Lanzar el primer build

1. En **Workers & Pages → viveros-baltaretu → Deployments**, pulsa **Retry build** o haz cualquier cambio en `main`.
2. Comprueba que termina en verde.

### 10. Publicar una versión (aprobación manual)

1. En **Workers & Pages → viveros-baltaretu → Deployments**, verás las versiones subidas por cada build. Cada una tiene una URL de prueba para revisarla antes.
2. Elige la versión y pulsa **Deploy version** (al 100 %). Desde ese momento es la web pública.
3. Para volver atrás, despliega una versión anterior de la misma forma.

### 11. Probar el formulario

1. En la web publicada, envía una petición de presupuesto de prueba.
2. Comprueba que llega al correo de `EMAIL_DESTINO` y que, al responder, el destinatario es el email que pusiste en el formulario.
3. Si no llega, mira **Workers & Pages → viveros-baltaretu → Observability → Logs**.

### 12. Comprobar el panel

1. Abre `https://tudominio.es/keystatic` y entra con tu cuenta de Keystatic Cloud.
2. Abre una ficha, cambia algo pequeño y guarda. Comprueba que aparece el commit en `main` en GitHub y que Cloudflare lanza un build (**Deployments**).
3. Deshaz el cambio desde el panel.

### 12 bis. Rellenar los datos de la empresa

1. En `/keystatic`, abre **Empresa** y completa el teléfono, el email y la dirección (el nombre ya está). Mientras no estén, la web muestra `[PLACEHOLDER]`.
2. En **WhatsApp**, escribe el número con el prefijo del país, solo dígitos (por ejemplo `34600000000`). Con el campo vacío no aparece el botón flotante de WhatsApp.
3. Revisa también **Portada**, **Textos del catálogo** y **Condiciones de venta** (pedido mínimo, plazos y envío por unidad).
4. En las vistas previas de rama y en local verás datos de prueba (teléfono, email, condiciones…) donde falte un dato, con el aviso "Vista de prueba". En producción no aparecen: allí se ve `[PLACEHOLDER]` hasta que rellenes el dato real.

### 13. Invitar al gerente

1. En Keystatic Cloud, abre el equipo del paso 4 e invita al gerente con su correo. No necesita cuenta de GitHub.
2. Cuando acepte la invitación, puede entrar en `https://tudominio.es/keystatic` con su cuenta de Keystatic Cloud.
3. Explícale que:
   - El campo **Revisado (publicar)** controla qué fichas aparecen en la web pública.
   - El campo **También por unidad** marca las especies que se venden sueltas y se envían al destino. En la web salen con la etiqueta "También por unidad" y con un filtro propio en el catálogo.
   - Cada "Guardar" es un cambio en el repositorio y lanza un build. Conviene rellenar la ficha entera y guardar una sola vez.
   - Sus cambios se ven en la web cuando tú publicas la versión (paso 10).
   - Si los datos no cumplen las reglas (por ejemplo, un perímetro con un solo valor), el build falla y la web sigue como estaba. Lo verás en Cloudflare.
   - Cada foto necesita un texto alternativo en español y en inglés.

Si hacen falta más de 3 usuarios, el equipo de Keystatic Cloud pasa a Pro (de pago).

### 14. Protección de la rama `main` (opcional)

Si configuras en GitHub una regla que obligue a usar PR para cambiar `main`, Keystatic Cloud no podrá guardar. En ese caso, permite que la aplicación de Keystatic se salte la regla o no exijas PR en `main`.

## Pendiente de confirmar

- Dominio y datos de contacto: marcados como `[PLACEHOLDER]` (el nombre, Viveros Baltaretu, ya está en el panel).
- Condiciones de la venta por unidad (gastos y plazos de envío) y pedido mínimo al por mayor: marcados como `[PLACEHOLDER]`.
- Rutas en inglés: hay que confirmarlas con el mapa de páginas de la estrategia SEO.
