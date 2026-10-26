# 05. Análisis de Riesgos y Crítica de Viabilidad

**Fecha:** 15 de octubre de 2026
**Autor:** Arquitecto de Software Senior (Evaluación Independiente)
**Proyecto:** Viveros Baltaretu → Plataforma SaaS Multicliente

---

## 1. Los 10 Mayores Riesgos Técnicos, Legales y de Negocio

### R-01. Riesgo de Cuello de Botella Operativo (Capacidad Humana) - **NEGOCIO / CRÍTICO**
- **Descripción:** La plataforma completa (altas, despliegues, soporte, desarrollo, incidencias, cobros y mantenimiento) será gestionada por **una sola persona**. Con 10 a 50 clientes, si el onboarding o la resolución de incidencias requiere más de 2-3 horas por cliente al mes, el desarrollador se convertirá en un cuello de botella, bloqueando la evolución del producto.
- **Mitigación:** Automatizar al 100% el alta mediante scripts CLI y webhooks de Stripe. Mantener un panel extremadamente autodidáctico para usuarios no técnicos y limitar el soporte a canal asíncrono (email / ticket) en los planes básicos.

### R-02. Responsabilidad Legal como Desarrollador en VeriFactu - **LEGAL / ALTO**
- **Descripción:** Según la Ley 11/2021 y el R.D. 1007/2023, la comercialización de un software de facturación no certificado o que permita alterar registros conlleva sanciones económicas severas (hasta 50.000 € por ejercicio/comercialización).
- **Mitigación:** NO desarrollar un motor de firma VeriFactu propio. Delegar la comunicación y certificación en una API homologada de terceros (ej. VeriFactu API / Facturae API) y repercutir su coste al cliente final.

### R-03. Fuga de Datos Cross-Tenant (BOLA / IDOR) - **TÉCNICO / CRÍTICO**
- **Descripción:** En una arquitectura multi-tenant, un bug en la capa de datos que olvide filtrar por `tenant_id` en una consulta de presupuestos, clientes o facturas permitiría a un cliente acceder a la información confidencial de un competidor.
- **Mitigación:** Adoptar el modelo de **DB D1 aislada por cliente (Híbrido)** en la primera fase. En la capa de repositorio, exigir el parámetro `tenant_id` como primer argumento tipado y obligatorio en el constructor de las consultas SQL.

### R-04. Dependencia Extrema de Cloudflare (Vendor Lock-in) - **TÉCNICO / MEDIO**
- **Descripción:** La plataforma utiliza primitives exclusivas del ecosistema de Cloudflare (D1, R2, Workers AI, Email Routing). Si Cloudflare cambia drásticamente sus precios o elimina planes gratuitos, la plataforma podría sufrir un impacto económico no planeado.
- **Mitigación:** La capa de datos (`src/server/data/tipos.ts`) aísla la lógica de persistencia tras interfaces de TypeScript. Implementar una tarea de exportación regular que genere volcados estándar en SQLite y archivos raw en R2.

### R-05. Divergencia Temprana de Requisitos por Sector - **NEGOCIO / ALTO**
- **Descripción:** Un vivero necesita medidas y pasaportes fitosanitarios; un carpintero requiere metros cuadrados y tipos de madera; una distribuidora exige códigos EAN y lotes. Intentar meter todos los campos específicos en el mismo esquema destruirá la usabilidad del panel.
- **Mitigación:** Diseñar el catálogo con un modelo de **Atributos Personalizados Dinámicos (JSON Metadata)** en lugar de columnas fijas en la base de datos. El panel renderizará los formularios basándose en la configuración del sector del cliente.

### R-06. Insuficiencia de Márgenes en el Plan de 29 €/mes - **NEGOCIO / MEDIO**
- **Descripción:** Cobrar 29 €/mes incluye soporte, hosting, backups, impuestos y pasarela de pago. Si un cliente de 29 €/mes consume 1 hora de soporte telefónico al mes o requiere asistencia personalizada, el cliente pasa a ser **deficitario**.
- **Mitigación:** Establecer que el plan de 29 €/mes es "Self-Service Pure" (solo soporte por base de conocimientos / ticket asíncrono). Establecer el plan recomendado en 49 €/mes y el plan con asistente de IA en 89 €/mes.

### R-07. Resistencia Digital de Usuarios No Técnicos - **USABILIDAD / ALTO**
- **Descripción:** Los clientes objetivo (gerentes de viveros, carpinteros, pequeños distribuidores) no son perfiles digitales. Un panel complejo generará rechazo y altas tasas de cancelación (Churn).
- **Mitigación:** Mantener la filosofía actual del panel: **una sola tarea por pantalla**, botones táctiles de 48px, lenguaje llano sin tecnicismos y asistente de voz/chat que ejecute acciones con confirmación en 1-click.

### R-08. Agotamiento de Límites de Workers AI y Fallo del Asistente - **TÉCNICO / MEDIO**
- **Descripción:** El límite gratuito de Workers AI (10.000 neuronas/día) se agotará si 10 clientes usan intensivamente el asistente en lenguaje natural.
- **Mitigación:** Implementar un sistema de cuotas diarias por cliente y un respaldo transparente hacia el motor local de reglas (`src/server/asistente/interprete.ts`) cuando el cupo de IA se agote.

### R-09. Complejidad en la Gestión de Dominios Personalizados y SSL - **TÉCNICO / MEDIO**
- **Descripción:** Configurar registros DNS (CNAME) y certificados SSL para 50 dominios externos puede generar incidencias constantes de configuración por parte de los clientes.
- **Mitigación:** Utilizar Cloudflare for Platforms y proveer una pantalla de verificación de estado DNS en el panel del cliente que indique exactamente qué registro CNAME falta.

### R-10. Incumplimiento de RGPD en el Tratamiento de Datos Multicliente - **LEGAL / ALTO**
- **Descripción:** Al almacenar facturas, clientes finales y correos de terceros, la plataforma actúa como **Encargado del Tratamiento (Art. 28 RGPD)** para cada uno de los suscriptores.
- **Mitigación:** Incluir el Contrato de Encargo del Tratamiento (DPA) de forma automatizada en los Términos y Condiciones de la suscripción, con almacenamiento y encriptación de datos en servidores ubicados dentro de la Unión Europea (Cloudflare EU Region Flags).

---

## 2. Crítica Honesta de Viabilidad Económica

- **Hipótesis del propietario:** Cobrar entre **29 € y 89 € / mes** por cliente.
- **Veredicto:** **VIABLE Y ALTAMENTE RENTABLE**, con una condición estricta: **Cero soporte personalizado telefónico en los planes de 29 €**.

### Análisis de Márgenes Netos (Escenario 10 Clientes):
- 3 Clientes Plan Básico (29 €) = 87 €
- 5 Clientes Plan Profesional (49 €) = 245 €
- 2 Clientes Plan Premium IA (89 €) = 178 €
- **Ingresos Mensuales Brutos:** **510,00 € / mes**
- **Costes de Infraestructura (Cloudflare Paid + Resend + R2):** **~ 6,00 € / mes**
- **Comisiones Stripe (~2.5%):** **~ 12,75 € / mes**
- **Margen Bruto para el Propietario:** **491,25 € / mes (96,3% de margen sobre ingresos)**

### Conclusión Estratégica
El proyecto es viable para ser operado por una sola persona. La combinación del renderizado estático de Astro con el runtime ultrabarato de Cloudflare garantiza que el coste marginal de añadir un nuevo cliente sea cercano a **0,10 €/mes**, lo que deja un margen de beneficio excepcional para el desarrollador/propietario.
