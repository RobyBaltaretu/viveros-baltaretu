# 01. Auditoría del Repositorio Actual

**Fecha:** 15 de octubre de 2026
**Autor:** Arquitecto de Software Senior (Evaluación Independiente)
**Proyecto:** Viveros Baltaretu → Plataforma SaaS Multicliente

---

## 1. Hallazgos de Acoplamiento (Vivero y Sector Agrícola)

El sistema actual fue diseñado expresamente como una solución a medida para un único cliente del sector agrícola (**Viveros Baltaretu**). Aunque la arquitectura interna está bien estructurada mediante la capa de repositorios (`src/server/data/`), el modelo de datos, la validación de esquemas, las herramientas de IA, los textos de interfaz y las colecciones de contenido están profundamente acoplados al vivero.

### 1.1 Hallazgos Críticos y Altos de Acoplamiento

| ID | Nivel | Componente / Archivo | Líneas | Descripción del Acoplamiento |
|---|---|---|---|---|
| **A-01** | **CRÍTICO** | `src/lib/catalogo/constantes.ts` | L1-12 | Definición rígida del dominio agrícola: `ALTURA_MAXIMA = 4`, `FAMILIAS = ['palmeras', 'olivos', 'higueras', 'otras-ornamentales']`, `FORMATOS = ['maceta', 'contenedor', 'cepellon', 'raiz-desnuda']`, `SILUETAS = ['palmera', 'olivo', 'higuera', 'cica']`. |
| **A-02** | **CRÍTICO** | `src/server/data/d1/migraciones.ts` | L23, L231 | La base de datos tiene `CHECK (coleccion IN ('catalogo', 'ajustes', 'paginas', 'proyectos', 'guias'))` en la tabla `entradas` y la columna `planta TEXT NOT NULL` en `inventario_movimientos`. |
| **A-03** | **ALTO** | `src/content.config.ts` | L9-44 | Colecciones fijas en Astro (`catalogo`, `empresa`, `condiciones`, `portada`, `textosCatalogo`, `paginas`, `proyectos`, `guias`) acopladas al esquema de vivero. |
| **A-04** | **ALTO** | `src/lib/catalogo/schema.ts` | L41-80 | Esquema de validación Zod rígido para plantas (`alturaMin`, `alturaMax`, `perimetroTroncoCm`, `ventaUnitaria`, `precioUnidad`, `silueta`). Impide usar el catálogo para otros sectores (carpintería, distribuidoras). |
| **A-05** | **ALTO** | `src/i18n/ui.ts` | L27-31, L68, L431-436 | Textos de interfaz y slugs con nombres hardcoded del vivero (`palmeras`, `olivos`, `lemaEmpresa`, `especies`, `plantas`). |
| **A-06** | **ALTO** | `src/server/asistente/herramientas.ts` | L90, L383, L554, L1163 | Herramientas del asistente de IA acopladas a la entidad "planta" y regex de intenciones hardcoded (`palabras: /plant\|imagen\|palmer\|olivo\|higuer\|cica.../`). |
| **A-07** | **ALTO** | `src/server/panel/plantas.ts` & `alta-planta.ts` | L8-35 | Lógica de negocio del panel con flujo rígido de alta guiada de 7 pasos centrado exclusivamente en botánica/plantas. |
| **A-08** | **MEDIO** | `src/components/ilustraciones/` & `Silueta.astro` | L1-50 | Componentes visuales de renderizado técnico basados únicamente en siluetas botánicas. |
| **A-09** | **MEDIO** | `src/styles/global.css` | L1-30 | Tokens CSS de marca hardcoded en el CSS global (`#3a4632` oliva, `#a17b58` cobre, `#d6c9b4` arena, `crema`, `verdor`). |
| **A-10** | **MEDIO** | `wrangler.jsonc` | L4, L24 | Nombre de Worker y binding de base de datos D1 fijados a `viveros-baltaretu` y base única sin identificador de cliente (`tenant_id`). |

---

## 2. Auditoría por Áreas de Arquitectura

### 2.1 Configuración y Marca
- **Estado actual:** Los logos están estáticos en `public/logo.png`, `public/logo-oscuro.png`, `public/monograma.png` y `public/favicon.png`. Los colores de marca y tipografía están hardcoded en `src/styles/global.css`.
- **Límites multicliente:** No existe sistema de temas ni inyección de CSS/variables dinámicas por cliente. Cambiar el aspecto de una marca requiere recompilar CSS y sustituir archivos estáticos en `public/`.

### 2.2 Gestión de Datos y Aislamiento
- **Estado actual:** Toda la persistencia dinámica se apoya en Cloudflare D1 mediante la capa de repositorio `src/server/data/d1/`. El esquema (Migraciones 1 a 9 en `migraciones.ts`) almacena `entradas`, `cambios`, `fotos`, `presupuestos`, `clientes`, `facturas`, `gastos`, `tickets` e `inventario_movimientos`.
- **Límites multicliente:** Ninguna tabla posee columna de discriminación por cliente (`tenant_id`). La base D1 actual (`viveros-baltaretu`) presupone que el 100% de los registros pertenecen a una sola entidad jurídica.

### 2.3 Autenticación, Usuarios y Roles
- **Estado actual:** La seguridad del panel se delega en **Cloudflare Access** (`src/middleware.ts` y `src/server/panel/acceso.ts`), el cual inyecta el correo verificado mediante la cabecera JWT `Cf-Access-Authenticated-User-Email`. Los usuarios y roles (`propietario`, `gerente`, `editor`) se verifican contra la tabla `usuarios` en D1.
- **Límites multicliente:** Cloudflare Access está configurado a nivel de zona/aplicación de Cloudflare para un único dominio. No hay mecanismo para mapear usuarios de Access a diferentes organizaciones/inquilinos en un entorno multi-tenant compartido.

### 2.4 Almacenamiento de Archivos y Fotos
- **Estado actual:** Las imágenes del catálogo y los tickets de gastos se guardan directamente como BLOBs de SQLite dentro de Cloudflare D1 (tablas `fotos` y `tickets`). Durante el build estático (`scripts/contenido/descargar.ts`), se exportan a los directorios del disco local `src/assets/` y `dist/`.
- **Límites multicliente:** Guardar imágenes como `BLOB` en D1 escala mal (límite de 10 GB por base de datos D1). Con 50 clientes y miles de imágenes de alta resolución/tickets, la base de datos alcanzará rápidamente los límites de almacenamiento y degradará el rendimiento de las lecturas SQL.

### 2.5 Asistente de IA (AgricolAI)
- **Estado actual:** Utiliza **Cloudflare Workers AI** (`@ai-sdk/groq` y `workers-ai-provider`) ejecutando herramientas en `src/server/asistente/herramientas.ts`. El contexto del asistente está restringido por instrucciones de sistema en `src/server/asistente/instrucciones.ts`.
- **Límites multicliente:** Las instrucciones del sistema y las 26 herramientas están cableadas con el vocabulario de plantas y presupuestos del vivero. No existe aislamiento semántico ni filtrado por `tenant_id` en las herramientas del asistente, por lo que una consulta de IA podría filtrar datos cross-tenant si compartieran base.

### 2.6 Facturación y Gastos (VeriFactu)
- **Estado actual:** Sistema interno propio en `src/server/facturas/` con generación de PDF cliente/servidor vía `pdf-lib`, correlatividad de series, huella encadenada SHA-256 e inventario acoplado. En gastos (`src/server/gastos/`), escaneo automático de tickets vía Workers AI Vision.
- **Límites multicliente:** El módulo de facturación **NO cumple con la normativa española VeriFactu (R.D. 1007/2023)**. No genera los registros XML con firma electrónica ni está conectado con la API de la Agencia Tributaria (AEAT), ni cuenta con la declaración responsable exigida por ley al comercializador del software.

### 2.7 Despliegues e Infraestructura
- **Estado actual:** Despliegue estático + Worker híbrido en Cloudflare Workers (`wrangler.jsonc`). Los cambios editados en el panel desencadenan descargas de D1 a `src/content` y activan Workers Builds mediante `scripts/contenido/desplegar.ts`.
- **Límites multicliente:** El pipeline de build asume 1 repositorio = 1 sitio Web publicado. No soporta despliegues multicliente por oleadas, gestión dinámica de dominios personalizados con SSL en tiempo de ejecución, ni compilación condicional por cliente.

---

## 3. Seguridad y Aislamiento entre Clientes

1. **Aislamiento de Datos:** **INEXISTENTE (Riesgo Crítico)**. Si se introducen múltiples clientes en el código actual sin modificar el esquema, cualquier usuario autenticado en `/panel` tendría acceso completo a leer y modificar presupuestos, facturas, clientes y catálogo de todas las empresas.
2. **Gestión de Secretos:** Los secretos (`EMAIL_DESTINO`, `TURNSTILE_SECRET_KEY`, `CONTENIDO_TOKEN`) están definidos globalmente en Cloudflare Workers y `.env`. No hay soporte para llaves ni credenciales aisladas por cliente.
3. **Superficie de Ataque:**
   - La API pública `/api/presupuesto` está protegida con Turnstile y honeypot.
   - `/panel` está protegido con Cloudflare Access JWT.
   - Sin embargo, la falta de control multicliente (RBAC multitenant) expondría la plataforma a vulnerabilidades de tipo **BOLA / IDOR** (Broken Object Level Authorization) inmediatas al intentar dar de alta al segundo cliente.

---

## 4. Calidad, Pruebas y Deuda Técnica

- **Pruebas Unitarias y de Integración:** 34 archivos de test en Vitest (`vitest.config.ts`), con 214 tests en verde. Cobertura excelente en esquemas Zod, repositorio D1, cálculo de facturas, herramientas del asistente y copias de seguridad.
- **Pruebas E2E y Accesibilidad:** Playwright + `@axe-core/playwright` (`playwright.config.ts` y `tests-e2e/panel.spec.ts`) garantizando WCAG 2.1 AA en panel y web.
- **Integración Continua (CI):** `.github/workflows/ci.yml` ejecuta `lint`, `test`, `build`, `check:worker`, `test:e2e` y `contenido:equivalencia`.
- **Deuda Técnica Acumulada para Multicliente:**
  1. Base de datos SQLite D1 guardando imágenes en formato `BLOB` (`src/server/data/d1/migraciones.ts`).
  2. Acoplamiento del motor de plantillas Astro a colecciones estáticas en tiempo de compilación.
  3. PDF de facturas generado con layout fijo en `pdf-lib` sin soporte de plantillas por cliente.
  4. Falta de abstracción en el modelo de inventario y catálogo.

---

## 5. Coste y Tiempo Actual de Alta de un Cliente Nuevo

Si hoy mismo se quisiera dar de alta a un segundo cliente (ej. un carpintero o una distribuidora) con el código actual:

- **Proceso actual:**
  1. Fork / Clon manual del repositorio Git.
  2. Modificación manual de `wrangler.jsonc` (crear nuevo Worker y nueva base D1 en Cloudflare).
  3. Reescribir el CSS (`global.css`), logos en `public/`, textos YAML en `src/content/` y constantes en `src/lib/catalogo/constantes.ts`.
  4. Redefinir esquemas Zod y traducciones i18n para adaptar el sector del cliente.
  5. Configurar manualmente Cloudflare Access, Turnstile, Email Routing y DNS.
- **Tiempo estimado por cliente:** **12 a 20 horas de trabajo manual de desarrollo.**
- **Coste de infraestructura actual:** **0 €/mes** (Plan gratuito de Cloudflare).
- **Mantenibilidad:** **Inviable para 1 sola persona con más de 3 clientes.** Al tener N repositorios o ramas divergentes, cualquier actualización de código o corrección de errores requeriría hacer rebases/merges manuales en N repositorios.
