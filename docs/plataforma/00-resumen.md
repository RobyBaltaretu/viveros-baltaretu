# 00. Resumen Ejecutivo: Plan de Transformación a Plataforma SaaS Multicliente

**Fecha:** 15 de octubre de 2026
**Autor:** Arquitecto de Software Senior (Evaluación Independiente)
**Proyecto:** Viveros Baltaretu → Plataforma SaaS Multi-tenant

---

## 1. Recomendación Final de Arquitectura

Tras auditar exhaustivamente el repositorio actual, la recomendación técnica es **mantener el stack principal de Astro + Cloudflare Workers + D1 + Tailwind CSS**, pero evolucionando su arquitectura hacia un **Monorepo Multi-tenant con Aislamiento de Base de Datos Híbrido**:

1. **Stack sin cambios drásticos:** No conviene rehacer la aplicación en otra tecnología (ej. Next.js, Laravel o Supabase). El rendimiento de Astro (renderizado estático + Edge Workers) y el coste de infraestructura de Cloudflare (cero coste fijo base) son la combinación idónea para mantener un margen bruto superior al **96%**.
2. **Modelo Multicliente Híbrido:** Un único Worker y repositorio de código que enruta dinámicamente según el nombre de dominio (`Host: cliente.com`) a una **base de datos D1 aislada por cliente** y un bucket de almacenamiento **Cloudflare R2** para archivos y fotos.
3. **Catálogo e Inventario Genéricos:** Abstraer el esquema de botánica/vivero hacia un modelo dinámico de ítems configurable por sector (viveros, distribuidoras, carpinterías).

---

## 2. Los 5 Pasos Más Urgentes (Acción Inmediata)

1. **Abstraer el Catálogo y Esquemas (`src/lib/catalogo/`):** Reemplazar las constantes botánicas rígidas por esquemas Zod dinámicos y metadata parametrizable.
2. **Migrar Fotos y Tickets de D1 a Cloudflare R2:** Extraer los archivos `BLOB` de SQLite D1 hacia R2 para evitar la saturación de la base de datos a medida que entren clientes.
3. **Añadir Discriminación por Inquilino (`tenant_id`) en la Capa de Repositorio:** Asegurar que todas las consultas de `src/server/data/` requieran y filtren obligatoriamente por el ID del cliente.
4. **Construir el Autenticador Nativo por Magic Link / Passkeys (`/panel/login`):** Reemplazar Cloudflare Access por un sistema de login propio multicliente amigable para usuarios no técnicos.
5. **Integrar la API de VeriFactu de Terceros:** Delegar la certificación legal de facturación (R.D. 1007/2023) en un servicio externo homologado para eliminar el riesgo jurídico del propietario.

---

## 3. Las 5 Decisiones Clave para el Propietario

| # | Decisión | Propuesta del Arquitecto | Motivo |
|---|---|---|---|
| **1** | **Modelo de Alojamiento** | Cloudflare Workers + D1 aislada por cliente. | Aislamiento de datos 100% seguro sin incrementar costes (5 $/mes total para 10 clientes). |
| **2** | **Certificación VeriFactu** | Integrar API VeriFactu de terceros (0,05 €/factura). | Evita asumir responsabilidad penal/administrativa como desarrollador de software. |
| **3** | **Modelo de Precios** | 29 € (Self-Service Básico), 49 € (Profesional) y 89 € (Premium IA). | Garantiza margen y protege de clientes deficitarios que requieran mucho soporte. |
| **4** | **Soporte y Operaciones** | Soporte por ticket/email en plan básico; cero soporte telefónico. | Permite que 1 sola persona gestione entre 10 y 50 clientes sin colapsar. |
| **5** | **Estrategia de MVP** | Lanzar MVP en subdominios `.plataforma.com` en 3 semanas. | Empezar a cobrar y validar con los 3 interesados reales antes de construir automatizaciones complejas. |

---

## 4. Estructura de Entregables Generados

Todos los análisis detallados se han estructurado en la carpeta `docs/plataforma/`:
- `00-resumen.md`: El presente resumen ejecutivo.
- `01-auditoria.md`: Auditoría de acoplamiento por archivo y línea, arquitectura y deuda técnica.
- `02-opciones-y-recomendaciones.md`: Análisis comparativo de alternativas con diagramas Mermaid y modelo de costes.
- `03-hoja-de-ruta.md`: Planificación por tareas/PRs con estimación en horas, DoD y MVP.
- `04-verificacion-externa.md`: Precios y límites oficiales verificados a fecha octubre de 2026.
- `05-riesgos.md`: Los 10 mayores riesgos técnicos/legales y crítica de rentabilidad económica.
