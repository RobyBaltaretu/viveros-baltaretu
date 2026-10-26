# 04. Verificación Externa y Fuentes Oficiales

**Fecha de consulta:** 15 de octubre de 2026
**Autor:** Arquitecto de Software Senior (Evaluación Independiente)
**Proyecto:** Viveros Baltaretu → Plataforma SaaS Multicliente

---

## 1. Cloudflare Workers & Static Assets

- **Plan Gratuito:**
  - 100.000 peticiones / día.
  - 10 ms de tiempo CPU por petición.
  - Subdominios `*.workers.dev`.
- **Plan Workers Paid (5,00 $ / mes):**
  - 10.000.000 peticiones / mes incluidas (+ 0,30 $ por millón adicional).
  - Hasta 30 ms de tiempo CPU (ampliable a 5 minutos en Workers unbind).
  - Dominio personalizado y SSL gestionado incluido.
- **Fuente oficial:** [Cloudflare Workers Pricing](https://developers.cloudflare.com/workers/platform/pricing/) *(Consultado en Octubre 2026)*.

---

## 2. Cloudflare D1 (Base de Datos Distributed SQLite)

- **Plan Gratuito:**
  - 5.000.000 filas leídas / día.
  - 100.000 filas escritas / día.
  - 5 GB de almacenamiento total.
- **Plan Paid (Incluido en Workers Paid 5 $/mes):**
  - 25.000.000.000 filas leídas / mes incluidas (+ 0,001 $ por millón adicional).
  - 50.000.000 filas escritas / mes incluidas (+ 1,00 $ por millón adicional).
  - 10 GB de almacenamiento incluido (+ 0,75 $ / GB adicional al mes).
- **Fuente oficial:** [Cloudflare D1 Pricing](https://developers.cloudflare.com/d1/platform/pricing/) *(Consultado en Octubre 2026)*.

---

## 3. Cloudflare R2 (Almacenamiento de Objetos S3 Compatible)

- **Plan Gratuito:**
  - 10 GB de almacenamiento al mes.
  - 1.000.000 operaciones de escritura (Class A) / mes.
  - 10.000.000 operaciones de lectura (Class B) / mes.
  - **Egresos / Ancho de banda:** 0,00 $ (Cero costes por egreso de datos).
- **Plan de Pago:**
  - 0,015 $ / GB / mes por almacenamiento consumido.
  - 4,50 $ / millón de operaciones Class A.
  - 0,36 $ / millón de operaciones Class B.
- **Fuente oficial:** [Cloudflare R2 Pricing](https://developers.cloudflare.com/r2/pricing/) *(Consultado en Octubre 2026)*.

---

## 4. Cloudflare Workers AI

- **Plan Gratuito:**
  - 10.000 Neuronas (Tokens/Inferencias) gratuitas diarias.
- **Plan Paid:**
  - 0,011 $ / 1.000 Neuronas adicionales para modelos estándar (`glm-4`, `gemma-2`, `llama-3`).
- **Fuente oficial:** [Cloudflare Workers AI Pricing](https://developers.cloudflare.com/workers-ai/platform/pricing/) *(Consultado en Octubre 2026)*.

---

## 5. Proveedores de API VeriFactu (Normativa Española R.D. 1007/2023)

- **VeriFactu / Facturae API / Terceros Proveedores:**
  - Rango de precios del mercado en España: 0,03 € a 0,12 € por factura emitida enviada a la AEAT.
  - Planes base para desarrolladores / ISVs: desde 15,00 € / mes por tranches de hasta 500 facturas.
- **Obligaciones Legales del Creador de Software (BOE Ley 11/2021 y R.D. 1007/2023):**
  - Entrada en vigor obligatoria para empresas/autónomos: 2026-2027.
  - Exigencia de inclusión de huella digital SHA-256 encadenada, código QR con formato especificado por la AEAT, e imposición de **Declaración Responsable firmada** por el productor del software.
- **Fuente oficial:** [Agencia Tributaria - Normativa VeriFactu](https://www.agenciatributaria.es/) *(Consultado en Octubre 2026)*.

---

## 6. Stripe Billing (Cobro de Suscripciones SaaS)

- **Comisión Estándar en Europa:**
  - 1,5% + 0,25 € para tarjetas de la UE / EEE.
  - 2,9% + 0,30 € para tarjetas internacionales.
- **Stripe Billing Addon:**
  - 0,5% sobre el volumen cobrado en suscripciones recurrentes (incluye portal de cliente, gestión automática de reintentos e impagos dunning).
- **Fuente oficial:** [Stripe Pricing España](https://stripe.com/es/pricing) *(Consultado en Octubre 2026)*.

---

## 7. Email Transaccional (Resend / Cloudflare Email Routing)

- **Cloudflare Email Service / Routing:**
  - Gratuito (limitado a reenvío y envío a direcciones verificadas).
- **Resend:**
  - Plan Gratuito: 3.000 emails / mes (100 emails / día).
  - Plan Pro: 20,00 $ / mes por 50.000 emails / mes.
- **Fuente oficial:** [Resend Pricing](https://resend.com/pricing) *(Consultado en Octubre 2026)*.
