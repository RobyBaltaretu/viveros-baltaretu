# Web del vivero

Web corporativa y catálogo de un vivero mayorista de plantas ornamentales. Está hecha con Astro y Tailwind CSS y se publica en Cloudflare Workers (plan gratuito).

Las normas del proyecto están en [CLAUDE.md](CLAUDE.md). Los comandos de desarrollo, en su sección "Comandos".

## Cómo funciona

- Las páginas son estáticas: se generan en cada build a partir de `src/content/`. Cloudflare las sirve como *Static Assets*, gratis y sin límite de peticiones.
- Solo `/api/presupuesto` ejecuta código en el Worker. El plan gratuito cubre 100.000 peticiones al día.
- El esquema de cada ficha del catálogo está en `src/lib/catalogo/schema.ts`. Si una ficha no lo cumple, el build falla y la web sigue con la versión anterior.
- Las fichas con `revisado: false` no salen en producción. Sí se ven en local y en los builds de ramas que no son `main`.
- **Producción requiere aprobación manual.** Cada build de `main` sube una *versión* del Worker con `wrangler versions upload`, pero no la publica. La publicas tú desde el panel de Cloudflare (paso 9).

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

## Cómo gastar pocos builds

En Workers el límite no es de 500 builds al mes (ese es el de Cloudflare Pages), sino de **3.000 minutos de build al mes**. Un build de esta web tarda 1 o 2 minutos. Aun así, cada guardado en el panel genera un build, así que conviene no gastarlos sin necesidad:

1. **Rutas que disparan build (*Build watch paths*).** Configura que solo construyan los cambios que afectan a la web. Así, cambiar el README, CLAUDE.md, los tests o la CI no gasta build (paso 5.4).
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
4. Elige el remitente de los avisos, una dirección de tu dominio que no hace falta que exista como buzón (por ejemplo, `presupuestos@tudominio.es`). Apúntala para el paso 6.

### 3. Crear el widget de Turnstile

1. Ve a **Turnstile → Add widget**.
2. Nombre: `Web vivero`. En *Hostnames* añade tu dominio y el subdominio `*.workers.dev` del Worker (lo verás en el paso 4). Modo: **Managed**.
3. Copia la **Site Key** (pública) y la **Secret Key** (secreta). Las usarás en los pasos 5 y 6.

### 4. Crear el Worker conectado a GitHub

1. Ve a **Compute → Workers & Pages → Create application → Import a repository**.
2. Conecta GitHub y elige `robybaltaretu/viveros-baltaretu`.
3. Nombre del proyecto: `viveros-baltaretu`. Debe coincidir con `name` en `wrangler.jsonc`.
4. **Build command:** `npm run build`
5. **Deploy command:** `npx wrangler versions upload`. Con este comando el build sube una versión pero no la publica.
6. Guarda. El primer build fallará porque falta `SITE_URL`; se arregla en el paso siguiente.

### 5. Ajustes de build

En **Workers & Pages → viveros-baltaretu → Settings → Build**:

1. **Variables and secrets** (variables de build):

   | Nombre | Valor |
   | --- | --- |
   | `SITE_URL` | `https://tudominio.es` sin barra final. Hasta tener dominio, la URL `https://viveros-baltaretu.<tu-subdominio>.workers.dev` |
   | `PUBLIC_TURNSTILE_SITE_KEY` | La *Site Key* del paso 3 |

2. **Branch control:** rama de producción `main`. Desmarca **Enable Preview Builds**.
3. **Build cache:** actívala.
4. **Build watch paths:**
   - *Include paths:* `src/*, public/*, astro.config.mjs, wrangler.jsonc, package.json, package-lock.json`
   - *Exclude paths:* vacío.

### 6. Variables y secretos del Worker

En **Workers & Pages → viveros-baltaretu → Settings → Variables & Secrets** (se usan cuando la web está funcionando):

| Nombre | Tipo | Valor |
| --- | --- | --- |
| `TURNSTILE_SECRET_KEY` | **Secret** | La *Secret Key* del paso 3 |
| `EMAIL_DESTINO` | Text | El correo verificado en el paso 2.3 |
| `EMAIL_REMITENTE` | Text | La dirección del paso 2.4, por ejemplo `presupuestos@tudominio.es` |

`wrangler.jsonc` tiene `keep_vars: true`, así que los despliegues no borran estos valores.

### 7. Conectar el dominio al Worker

1. En **Workers & Pages → viveros-baltaretu → Settings → Domains & Routes → Add → Custom domain**, escribe `tudominio.es`. Repite con `www.tudominio.es` si lo usas.
2. Cambia `SITE_URL` (paso 5.1) a la URL del dominio y lanza un build nuevo.

### 8. Lanzar el primer build

1. En **Workers & Pages → viveros-baltaretu → Deployments**, pulsa **Retry build** o haz cualquier cambio en `main`.
2. Comprueba que termina en verde.

### 9. Publicar una versión (aprobación manual)

1. En **Workers & Pages → viveros-baltaretu → Deployments**, verás las versiones subidas por cada build. Cada una tiene una URL de prueba para revisarla antes.
2. Elige la versión y pulsa **Deploy version** (al 100 %). Desde ese momento es la web pública.
3. Para volver atrás, despliega una versión anterior de la misma forma.

### 10. Probar el formulario

1. En la web publicada, envía una petición de presupuesto de prueba.
2. Comprueba que llega al correo de `EMAIL_DESTINO` y que, al responder, el destinatario es el email que pusiste en el formulario.
3. Si no llega, mira **Workers & Pages → viveros-baltaretu → Observability → Logs**.

## Pendiente de confirmar

- Nombre de la empresa, dominio y datos de contacto: marcados como `[PLACEHOLDER]`.
- Rutas en inglés: hay que confirmarlas con el mapa de páginas de la estrategia SEO.
