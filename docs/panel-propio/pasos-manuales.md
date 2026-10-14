# Pasos manuales del propietario

El código está preparado para que el panel funcione en cuanto se hagan estos pasos. Hasta entonces, `/panel` muestra "El panel todavía no está activado" y la web sigue construyéndose con los archivos del repositorio. Todo es gratuito. Se irá completando a medida que avancen las tareas.

## 1. Base de datos D1 (hecho)
La base `viveros-baltaretu` está creada y conectada en `wrangler.jsonc`. Si el despliegue de Workers Builds falla por permisos, añade *Account → D1 → Edit* al token de Workers Builds (*My Profile → API Tokens*).

## 2. Token de contenido
1. Genera un token: `node -e "console.log(crypto.randomUUID()+crypto.randomUUID())"`.
2. Guárdalo como **secreto** `CONTENIDO_TOKEN` en *Workers & Pages → viveros-baltaretu → Settings → Variables and Secrets* (runtime) y también en *Settings → Build → Variables and secrets* (build).

## 3. Importar el contenido actual (una vez, con la base y el token creados y la versión publicada)
Desde tu ordenador, con el repositorio al día:
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
