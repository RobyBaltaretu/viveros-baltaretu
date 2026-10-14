# Pasos manuales del propietario

El código está preparado para que el panel funcione en cuanto se hagan estos pasos. Hasta entonces, `/panel` muestra "El panel todavía no está activado" y la web sigue construyéndose con los archivos del repositorio. Todo es gratuito. Se irá completando a medida que avancen las tareas.

## 1. Base de datos D1
1. Cloudflare → *Storage & Databases → D1 → Create database*. Nombre: `viveros-baltaretu`. Copia el *Database ID*.
2. En `wrangler.jsonc`, añade al nivel superior (fuera de `env`), en un PR:
   ```jsonc
   "d1_databases": [{ "binding": "DB", "database_name": "viveros-baltaretu", "database_id": "<ID copiado>" }],
   ```
   Las tablas las crea el propio Worker la primera vez.
