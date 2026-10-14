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
