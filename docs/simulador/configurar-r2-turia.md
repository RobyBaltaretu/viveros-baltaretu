# Configuración de R2 privado para Creaciones Turia

Este documento aplica únicamente a Creaciones Turia y a la rama de prueba `feature/turia-studio-boceto-multimodal`. No modificar el bucket de Baltaretu.

## 1. Crear bucket en Cloudflare
En Cloudflare Dashboard, entrar en **R2 Object Storage** > **Create bucket**.
Nombre exacto: `creacionesturia`.
Seleccionar región automática o la jurisdicción de datos exigida por el proyecto. Confirmar creación.
**No habilitar acceso público, dominio personalizado ni r2.dev público.**

## 2. Vincular al Worker
El archivo `wrangler.creacionesturia.jsonc` de esta rama declara:
```json
"r2_buckets": [
  {"binding": "IMAGENES_PRIVADAS", "bucket_name": "creacionesturia"}
]
```
Al desplegar desde esta rama, el binding se aplicará al Worker `creacionesturia` si el despliegue utiliza este fichero.
Si se despliega desde el Dashboard o un pipeline diferente, revisar **Workers & Pages > creacionesturia > Settings > Bindings** y confirmar que existe un binding R2 llamado exactamente `IMAGENES_PRIVADAS` que apunta a `creacionesturia`.
No crear tokens de API R2 ni exponer credenciales en el navegador: el Worker accede mediante el binding.

## 3. Separar entornos
El entorno local ya usa `creacionesturia-local`. Para preview remoto, crear un bucket independiente, por ejemplo `creacionesturia-preview`, y configurar el binding del Worker preview con ese bucket. No usar el bucket de producción para pruebas.
La configuración de la rama declara el bucket de producción en la raíz: no desplegar preview con ese fichero sin sobrescribir el binding con el bucket de preview.

## 4. Comprobación
- Confirmar que el Worker realmente desplegado contiene el binding `IMAGENES_PRIVADAS`.
- Iniciar sesión como usuario autorizado de Turia; abrir `/panel/studio-bocetos`.
- Crear un borrador y subir JPEG/PNG/WebP (máximo 6 MB por archivo).
- Verificar que aparecen objetos bajo `privado/studio/turia/` y que el acceso sin sesión devuelve 403.
- Confirmar que Baltaretu no puede consultar esas imágenes.
- Probar que una imagen >6 MB se rechaza y que los datos persisten tras cerrar Safari.
- Verificar D1 migración 18 y revisar consumo de almacenamiento/operaciones.

## Advertencias
El bucket es privado, pero los originales pueden contener datos del domicilio del cliente. Definir política de conservación y borrado, y no compartir URLs públicas.
La subida de Studio aún es experimental: no desplegar a producción ni usar datos personales reales hasta superar CI, seguridad, privacidad y pruebas E2E.
