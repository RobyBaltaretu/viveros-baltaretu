# Clientes de la plataforma

Cada carpeta es un cliente con su `cliente.config.json` (esquema en `src/plataforma/configuracion.ts`). El build elige el cliente con la variable `CLIENTE_ID`; **sin ella, es `baltaretu`** y la web es exactamente la de siempre (lo comprueba `tests/baseline/`).

- `baltaretu/`: Viveros Baltaretu, en producción. Recoge los valores que hoy están fijos en el código (idiomas, IVA del 10 %, módulos, Worker y D1 de `wrangler.jsonc`, colores de `global.css`). Un test comprueba que coinciden. `wrangler.jsonc` no cambia.
- `turia/`: Creaciones Turia (carpintería). Solo en español, con IVA del 21 % sin elegir. Worker y D1 `creacionesturia` (decidido, P-05), aún sin dominio propio: la URL será la de `*.workers.dev`. Los recursos los crea el propietario en Cloudflare; desde el repositorio no se crea nada. Mientras las fases siguientes no lean la configuración, `CLIENTE_ID=turia` construye la misma web que Baltaretu.

Nada de secretos aquí: las claves van como variables de entorno de cada Worker. Los datos que falten van como `[PLACEHOLDER]` o `null`.
