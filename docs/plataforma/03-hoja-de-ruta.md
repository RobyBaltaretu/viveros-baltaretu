# 03. Hoja de Ruta y Estimación

**Fecha:** 15 de octubre de 2026
**Autor:** Arquitecto de Software Senior (Evaluación Independiente)
**Proyecto:** Viveros Baltaretu → Plataforma SaaS Multicliente

---

## 1. Planificación de Tareas por Fase (Priorizado en PRs)

### Fase 0: Preparación e Inmediato (Refactorización del Núcleo)

| ID | Tarea / PR | Esfuerzo (h) | Dependencias | Riesgo | Criterio de Hecho (DoD) | Verificación |
|---|---|---|---|---|---|---|
| **T-01** | Abstraer catálogo de botánica a modelo dinámico de ítems (`src/lib/catalogo/`). | 12 h | Ninguna | Medio | Catálogo genérico que soporte tipos de producto por sector (planta, mueble, repuesto). | `npm test` verde; test de esquema genérico pasando. |
| **T-02** | Extraer fotos de D1 a Cloudflare R2 (`src/server/data/d1/`). | 8 h | T-01 | Bajo | Fotos guardadas en R2; D1 solo guarda la URL/key de R2. | `npm run test:e2e` sin regresiones en imágenes. |
| **T-03** | Separar tokens de marca e inyectar temas por CSS variables (`global.css`). | 6 h | Ninguna | Bajo | Inyección de colores dinámicos vía HTML `<style>` sin alterar el vivero actual. | `tests/tokens.test.ts` verde. |
| **T-04** | Añadir discriminación de inquilino (`tenant_id`) en D1 / Capa Repositorio. | 10 h | T-01 | Alto | Capa de repositorio consulta con `tenant_id` obligatorio en todas las llamadas. | `tests/panel/repositorios.test.ts` verde. |

---

### Fase 1: Antes del Primer Cliente Nuevo (MVP Multicliente)

| ID | Tarea / PR | Esfuerzo (h) | Dependencias | Riesgo | Criterio de Hecho (DoD) | Verificación |
|---|---|---|---|---|---|---|
| **T-05** | Enrutamiento por Hostname / Subdominio en Middleware (`middleware.ts`). | 8 h | T-04 | Medio | Identificación automática del cliente a partir de la URL entrante. | Tests unitarios de middleware probando dominios simulados. |
| **T-06** | Sistema de Autenticación nativo por Magic Link / Passkeys en D1. | 14 h | T-04 | Alto | Sustitución de Cloudflare Access por login nativo multicliente en `/panel/login`. | `tests/panel/acceso.test.ts` actualizado y en verde. |
| **T-07** | Script CLI de Provisionamiento de Clientes (`alta-cliente.ts`). | 6 h | T-04, T-05 | Bajo | Alta de un cliente en < 2 minutos ejecutando una línea de comandos. | Ejecución de prueba en entorno local D1. |
| **T-08** | Integración de API VeriFactu de terceros para facturación legal. | 16 h | T-04 | Alto | Emisión de factura enviando XML firmado a API de pruebas VeriFactu. | Test de facturación con simulación de respuesta API. |

---

### Fase 2: Escala a 5 y 10 Clientes (Automatización y Billing)

| ID | Tarea / PR | Esfuerzo (h) | Dependencias | Riesgo | Criterio de Hecho (DoD) | Verificación |
|---|---|---|---|---|---|---|
| **T-09** | Integración de Stripe Billing + Webhooks de Alta/Baja Automática. | 12 h | T-07 | Medio | Registro y cobro en la web SaaS da de alta al cliente automáticamente en Cloudflare. | Webhook test con Stripe CLI. |
| **T-10** | Cloudflare for Platforms (Custom Domains SSL automático). | 8 h | T-05 | Medio | Cliente vincula su dominio `.com` propio y recibe SSL automático en < 5 minutos. | Test de API de Cloudflare for Platforms. |
| **T-11** | Panel SuperAdmin de Plataforma (Gestión de Inquilinos y Métricas). | 10 h | T-09 | Bajo | Vista para el propietario con lista de clientes, estado de suscripción y uso. | E2E test de ruta `/admin`. |
| **T-12** | Asistente de IA Multicliente con aislamiento de cuotas y sectores. | 12 h | T-04 | Medio | Asistente responde adaptado al sector del cliente y respeta su límite diario. | `tests/asistente/agente.test.ts` verde. |

---

### Fase 3: Escala a 50 Clientes (Optimizaciones y Autonomía)

| ID | Tarea / PR | Esfuerzo (h) | Dependencias | Riesgo | Criterio de Hecho (DoD) | Verificación |
|---|---|---|---|---|---|---|
| **T-13** | Pipeline de Despliegues por Oleadas (Staging → Production Canary). | 10 h | T-10 | Bajo | Actualización de la plataforma lanzada primero a 10% de clientes y luego al 100%. | Script de despliegue progresivo. |
| **T-14** | Exportación de datos de 1-Click (Zero Lock-in) en SQLite + R2 ZIP. | 6 h | T-02, T-04 | Bajo | El cliente puede descargar todos sus datos y fotos en un archivo comprimido. | Test de descarga y descompresión. |

---

## 2. Hitos de Decisión (Gateways)

1. **Hito 1 (Tras Fase 0 - 36h desarrolladas):**
   - *Pregunta clave:* ¿Conserva el vivero actual el 100% de su velocidad, SEO y funcionalidad tras abstraer el catálogo?
   - *Métrica de éxito:* 0 regresiones en tests e2e, Lighthouse 100/100 en la web de Viveros Baltaretu.

2. **Hito 2 (Tras validar el Cliente 1 real - Distribuidora o Carpintero):**
   - *Pregunta clave:* ¿Pudo el primer cliente gestionar sus presupuestos y catálogo sin ayuda técnica?
   - *Métrica de éxito:* Menos de 2 horas de soporte solicitadas en las primeras 2 semanas de uso.

3. **Hito 3 (Al alcanzar 10 Clientes de pago):**
   - *Pregunta clave:* ¿El margen de beneficios cubre el tiempo de dedicación y soporte del propietario?
   - *Métrica de éxito:* > 400 €/mes de ingresos recurrentes (MRR) con menos de 3 horas/semana de dedicación operativa.

---

## 3. Propuesta de MVP (Versión Mínima Viable para Empezar a Vender)

Para comenzar a comercializar la plataforma en menos de 3 semanas (aproximadamente 50 horas de desarrollo enfocadas):

### Lo que INCLUYE el MVP:
- Web pública con catálogo genérico multilenguaje y solicitud de presupuesto.
- Panel de gestión multicliente enrutado por subdominio (`cliente.plataforma.com`).
- Personalización visual básica (logo, color primario y datos de empresa en D1).
- Módulo de facturación sencillo con exportación CSV para gestoría.
- Asistente de IA básico con cuota diaria.

### Lo que se DEJA FUERA del MVP (A propósito):
- Conexión VeriFactu automática (se ofrece el compromiso de integración previa a la entrada en vigor de la ley en 2027).
- Cobro automático por Stripe (el cobro inicial se realiza por transferencia o domiciliación manual).
- Dominios propios personalizados inmediatos (se entrega subdominio `.plataforma.com` inicial).
- Editor visual drag-and-drop de plantillas.
