# Pasos manuales del propietario

El código está preparado para que el panel funcione en cuanto se hagan estos pasos. Hasta entonces, `/panel` muestra "El panel todavía no está activado" y la web sigue construyéndose con los archivos del repositorio. Todo es gratuito. Se irá completando a medida que avancen las tareas.

## 1. Base de datos D1
1. Cloudflare → *Storage & Databases → D1 → Create database*. Nombre: `viveros-baltaretu`. Copia el *Database ID*.
2. En `wrangler.jsonc`, añade al nivel superior (fuera de `env`), en un PR:
   ```jsonc
   "d1_databases": [{ "binding": "DB", "database_name": "viveros-baltaretu", "database_id": "<ID copiado>" }],
   ```
   Las tablas las crea el propio Worker la primera vez.

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
1. *Zero Trust* (en el panel de Cloudflare). Si es la primera vez, elige el plan **Free** y un nombre de equipo (*team name*), por ejemplo `viveros-baltaretu`.
2. *Settings → Authentication → Login methods → Add new → One-time PIN*.
3. *Access → Applications → Add an application → Self-hosted*:
   - Nombre: `Panel del vivero`. Duración de la sesión: 1 semana (`168h`).
   - Destinos (*public hostname*): tu dominio (o `viveros-baltaretu.<cuenta>.workers.dev`) con las rutas `panel` y `api/panel`. Añade una línea por cada ruta, y también `panel/*` y `api/panel/*`.
   - Política: *Allow*, regla *Emails* con tu correo y el del gerente (y el del editor si lo hay). Método de acceso: One-time PIN.
4. Copia el **Application Audience (AUD) Tag** (*Additional settings* de la aplicación).
5. En el Worker (*Settings → Variables and Secrets*, runtime), añade como variables de texto:
   - `ACCESS_EQUIPO` = el nombre del equipo (lo que va antes de `.cloudflareaccess.com`).
   - `ACCESS_AUD` = el AUD Tag.
   - `PROPIETARIO_EMAIL` = tu correo. La primera vez que entres quedarás como propietario y podrás dar de alta al gerente.

Mientras falte alguna de estas variables o la base D1, `/panel` responde "El panel todavía no está activado" y no deja entrar a nadie.
