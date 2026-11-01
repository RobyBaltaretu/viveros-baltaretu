# Auditoría UX/UI y Propuesta de Refactorización (Mobile-First & Business Intelligence)

**Fecha:** Marzo 2025
**Objetivo:** Elevar la experiencia de usuario (UX/UI) del panel de gestión interna bajo estándares B2B modernos, priorizando la ergonomía móvil (Mobile-First), la accesibilidad (WCAG 2.1 AA) y la toma de decisiones basada en Business Intelligence accionable.

---

## 1. Hallazgos Actuales

Tras auditar tanto la interfaz base (`src/layouts/PanelLayout.astro`, `src/pages/panel/`) como la variante multicliente / diseño nuevo (`src/panel-nuevo/`), se han detectado los siguientes puntos críticos de fricción y áreas de mejora:

### 1.1. Ergonomía Móvil y Zonas del Pulgar (*Thumb Zones*)
* **Touch Targets subestándar (< 44px):**
  * Pestañas de estado y filtros de catálogo (como `.nv-filtro-catalogo .nv-toque` o chips de navegación) tienen alturas de `2rem` (32px) o padding vertical insuficiente para dedos gruesos o uso en campo/taller con guantes.
  * Los botones de cierre de diálogos (`.nv-dialogo-cabeza button`), enlaces de paginación o flechas de periodo en `informes.astro` carecen de padding de interacción perimetral garantizado de 44×44px.
  * En tablas móviles (`.nv-tabla-lineas td:nth-child(6)` / botón quitar línea), el target de eliminación suele ser menor a 36px, propiciando toques accidentales con la fila inferior.
* **Acciones principales fuera del alcance del pulgar:**
  * En varias vistas de gestión (ej. Facturas, Gastos, Catálogo), el botón principal "Nueva factura" o "Añadir gasto" se ubica en la parte superior izquierda/derecha de la pantalla (`header` o tras el título `h1`), obligando al usuario en móvil a cambiar de mano o forzar el pulgar a la zona inaccesible (*hard-to-reach zone*).
  * Aunque existe una barra de navegación inferior (`.inferior-panel` y `.nv-inferior`), carece de consistencia en el tratamiento del botón flotante de acción rápida (FAB / Menú contextual Crear) en todas las resoluciones intermedias (ej. tablets pequeñas).

### 1.2. Carga Cognitiva, Jerarquía Visual y Espaciado (Tailwind)
* **Jerarquía cromática difusa:**
  * No existe una separación tajante en Tailwind entre acciones primarias (`bg-primary` / terracota), secundarias (bordes neutros / ghost) y destructivas (`bg-red-600` / `.text-rojo`). En formularios de borrado o archivado, el botón de eliminar a veces comparte estilos con botones secundarios o carece de confirmación previa ergonómica.
* **Espaciado y márgenes al borde de pantalla:**
  * En resoluciones móviles (< 375px), ciertos contenedores y tablas reducen el padding lateral a menos de 12px, pegando texto y números al borde del cristal, provocando fatiga de lectura y problemas con fundas protectoras de smartphones.
* **Tablas que comprometen el viewport horizontal:**
  * Aunque en `src/panel-nuevo/estilos.css` se hizo un esfuerzo de transformación a tarjetas CSS (`grid-template-areas`), en varias páginas del panel clásico (`src/pages/panel/facturas/index.astro`, `proveedores/index.astro`, `pedidos/index.astro`, `catalogo/articulos/`) las tablas de escritorio dependen de `overflow-x: auto`. Esto oculta columnas esenciales (como importe o estado) más allá del scroll horizontal sin pistas visuales de desbordamiento (*scroll shadow* o indicador de desplazamiento).

### 1.3. Gestión de Estados (State Management)
* **Empty States (Estados vacíos) impersonales y pasivos:**
  * Vistas clave como Facturas (`<p>No hay facturas aquí.</p>`), Gastos, Proveedores o Pedidos muestran un simple párrafo de texto gris cuando no hay registros filtrados o la cuenta es nueva.
  * Falta un patrón unificado de estado vacío con ilustración contextual, titular comprensivo, explicación del beneficio y un *Call to Action* (CTA) principal (ej. *"Crea tu primera factura para empezar a controlar tus cobros"*).
* **Ausencia de Skeleton Loaders y feedback visual asíncrono:**
  * En formularios de cálculo en vivo (como el configurador de presupuestos o calculadora de corte de piezas) y en subida de comprobantes OCR, se utilizan opacidades parciales (`opacity: 0.6`) o indicadores estáticos sin estructuras de esqueleto (*skeletons*) que preparen al cerebro para el contenido entrante.
* **Feedback y Notificaciones volátiles:**
  * Los mensajes de éxito o borrado (`?hecho=borrada`, `role="status"`) se muestran como bloques estáticos incrustados en el flujo superior del documento, desplazando repentinamente el contenido hacia abajo (layout shift) en vez de presentarse como un sistema de *Toast / Snackbar* no intrusivo y accesible.

### 1.4. Accesibilidad (WCAG 2.1 AA)
* **Contraste de color en texto auxiliar y estados deshabilitados:**
  * Ciertos textos en `var(--color-gris)` sobre fondos crema o pasteles no superan la ratio de contraste 4.5:1 exigida por WCAG AA para textos de cuerpo pequeño (menores a 18px / 14pt bold).
* **Inputs y etiquetas accesibles:**
  * Ciertos inputs en filtros rápidos y tablas editables carecen de `<label>` visible o `aria-label` descriptivo explícito (ej. campo de cantidad sin asociar al nombre de la línea).

### 1.5. Limitaciones del Módulo Actual de Informes y KPIs
* **KPIs planos y descontextualizados:**
  * En la actualidad, el panel muestra métricas estáticas tipo "Ingresos sin IVA: X €" o "Facturas emitidas: Y".
  * Falta información comparativa con el periodo homólogo inmediato (mes anterior / mismo mes del año anterior) y cálculo automático de variaciones porcentuales relativas (`+12.4%` vs `mes anterior`) con indicadores visuales claros (verde subida, rojo bajada).
* **Falta de métricas de conversión comercial:**
  * En el sector reformas/carpintería o viveros, la métrica vital es la conversión de ofertas: ¿cuántos presupuestos emitidos se aceptan y se convierten en factura emitida? La UI actual oculta o separa esta correlación.
* **Salud del flujo de caja (Cash Flow / Aging):**
  * La vista de cobros agrupa el importe total pendiente, pero no desglosa la antigüedad de la deuda (*aging*): vencidas a 30 días, 60 días, >90 días.
* **Visualizaciones rígidas:**
  * Los gráficos de barras actuales en SVG tienen anchos estáticos (`ANCHO = 400`) y ejes rígidos que en pantallas móviles pequeñas sufren compresión de etiquetas, impidiendo distinguir meses contiguos sin recurrir a la tabla colapsada.

---

## 2. Propuesta de Rediseño (Layouts y Componentes)

### 2.1. Arquitectura de Navegación y Ergonomía Móvil
1. **Navegación Inferior Flotante (Bottom Navigation Bar) con Thumb-Zone Optimization:**
   * Estandarizar la barra inferior fija en móvil (`min-h-[56px]`) con 4 accesos directos esenciales + 1 botón central elevado ("Crear" / FAB).
   * **Floating Action Button (FAB) inteligente:** Un botón central de acción rápida (`+`) situado en la base de la pantalla que despliega un *BottomSheet* nativo con las acciones más frecuentes según el rol: *Nueva Factura*, *Añadir Gasto/Ticket*, *Nuevo Presupuesto*, *Nueva Planta/Artículo*.
   * Garantizar área táctil mínima de `min-h-[48px]` y `min-w-[48px]` en todos los enlaces y botones de la barra inferior con espaciado seguro para el `env(safe-area-inset-bottom)`.
2. **Transformación Responsive de Tablas a Tarjetas (Card Lists):**
   * Sustituir las tablas con scroll horizontal en móvil (`< 768px`) por un diseño de tarjetas apiladas con datos clave en jerarquía vertical:
     * Fila superior: Referencia/Código + Badge de Estado.
     * Cuerpo: Nombre del cliente / Proveedor + Concepto destacado.
     * Pie de tarjeta: Importe destacado en negrita tabular (`tabular-nums`) + Fecha y botón de acción directa.
   * Mantener la tabla semántica accesible `<table>` en resoluciones `md` y superiores (`>= 768px`) con cabeceras fijas (`sticky top-0`) y alineación numérica a la derecha.

### 2.2. Estandarización de Componentes UI con Tailwind CSS
1. **Botones y Acciones Unificadas:**
   * **Primario:** `bg-terracota hover:bg-terracota/90 text-white font-semibold min-h-[44px] px-4 rounded-xl shadow-sm active:scale-[0.98] transition-all`
   * **Secundario / Contorno:** `bg-papel border border-linea hover:bg-hover text-tinta font-semibold min-h-[44px] px-4 rounded-xl active:scale-[0.98] transition-all`
   * **Destructivo:** `bg-red-50 text-red-700 hover:bg-red-100 border border-red-200 font-semibold min-h-[44px] px-4 rounded-xl active:scale-[0.98] transition-all` (con confirmación modal de 2 pasos).
   * **Icon-Only Buttons:** Área táctil garantizada con contenedor `min-w-[44px] min-h-[44px] grid place-items-center`.
2. **Sistema de Tarjetas de Información (`Card`):**
   * Contenedores con borde sutil `border border-linea`, esquinas redondeadas `rounded-2xl`, fondo `bg-papel`, sombra de elevación mínima `shadow-sm` y padding móvil adaptable (`p-4 sm:p-6`).
3. **Inputs y Selects Accesibles:**
   * Altura mínima táctil de 48px (`h-12`), radio de borde `rounded-xl`, tipografía `text-base` para prevenir el zoom automático en iOS Safari (`font-size >= 16px`).
   * Borde en reposo con contraste garantizado, foco con anillo visible de 3px (`focus:ring-2 focus:ring-terracota/40 focus:border-terracota`).

### 2.3. Gestión Integral de Estados
1. **Componente Reutilizable de Empty State (`EstadoVacio.astro`):**
   * Estructura:
     * Icono o ilustración SVG contextual en contenedor suave circular.
     * Título conciso (`h3` semántico).
     * Texto explicativo orientativo (1-2 líneas).
     * Botón de acción principal (`Call to Action`) que guía al usuario hacia la creación del primer elemento.
2. **Skeletons de Carga (`EsqueletoTarjeta.astro` / `EsqueletoTabla.astro`):**
   * Bloques con animación de pulso sutil (`animate-pulse bg-linea/60 rounded-lg`) que calcan la estructura exacta de los KPIs y listas mientras se recalculan datos o se ejecutan filtros.
3. **Sistema de Toasts Notificadores Accesibles (`Toast.astro`):**
   * Notificaciones flotantes en esquina inferior derecha (o superior en móvil) con `role="status"` o `role="alert"`, icono temático (éxito, advertencia, error), soporte de autocierre tras 4 segundos y botón de descarte manual de 44px.

---

## 3. Propuesta de Nuevos KPIs (Business Intelligence Accionable)

Para dotar al negocio de herramientas reales de gestión económica y operativa, la sección de **Inicio** e **Informes** se estructurará en 4 cuadrantes analíticos:

### 3.1. Cuadrante 1: Métricas de Tendencia y Crecimiento (vs. Periodo Anterior)
* **Ingresos Netos (Base Imponible) con Indicador de Tendencia:**
  * Cifra actual comparada con el mismo periodo anterior (mes anterior o mismo trimestre anterior).
  * Badge visual: `▲ +14.2% vs. mes anterior` (verde si sube, rojo si baja, neutro si no hay cambio).
* **Evolución de Gastos Operativos:**
  * Gastos confirmados del mes vs. mes anterior con advertencia si el crecimiento del gasto supera proporcionalmente al de los ingresos.
* **Margen Operativo Real:**
  * % de beneficio neto sobre ingresos: `(Ingresos - Gastos) / Ingresos * 100`.

### 3.2. Cuadrante 2: Embudo Comercial y Tasa de Conversión (Pipeline)
* **Tasa de Conversión Presupuestos → Facturas:**
  * `% de conversión = (Presupuestos convertidos a factura en el periodo / Total presupuestos presentados) * 100`.
  * Visualización: Barra de progreso lineal segmentada (Presupuestos creados -> Enviados -> Aceptados -> Facturados).
  * Ticket Medio de Presupuesto vs. Ticket Medio Facturado.

### 3.3. Cuadrante 3: Salud Financiera y Gestión del Cobro (Cash Flow Health)
* **Riesgo y Antigüedad de Deuda (Aging de Facturas Emitidas):**
  * Desglose visual por tramos de vencimiento:
    1. *Al corriente / En plazo* (vencimiento futuro).
    2. *Vencidas 1-30 días* (urgencia media).
    3. *Vencidas >30 días* (urgencia alta / crítico).
  * Tiempo medio de cobro (DSO - Days Sales Outstanding aproximado).

### 3.4. Cuadrante 4: Distribución y Concentración del Negocio
* **Distribución de Ventas por Categoría / Producto / Servicio:**
  * Gráfico de barras horizontales ligeras en CSS puro (aprovechando flex/grid y porcentajes calculados en el servidor Astro) para evitar sobrecarga de librerías JS pesadas.
  * Análisis de concentración: % de ingresos acumulado por los 3 clientes principales (alerta de riesgo si > 50% de facturación depende de un solo cliente).

---

## 4. Hoja de Ruta de Ejecución (Checklist Incremental)

La ejecución se dividirá en fases controladas para asegurar compatibilidad total con la suite de pruebas existente (`npm test`), verificación WCAG 2.1 AA y cero regresiones en los tenants:

- [ ] **Fase 1: Fundamentos de Navegación y Ergonomía Móvil**
  - [ ] Revisar y ampliar áreas táctiles mínimas (`min-h-[44px]`, `min-w-[44px]`) en `PanelLayout.astro`, `PanelNuevo.astro` y menús superiores/inferiores.
  - [ ] Optimizar la barra inferior móvil (`inferior-panel` / `nv-inferior`) con mejor zonificación para pulgar y acceso al menú rápido de creación (FAB).
  - [ ] Asegurar padding de seguridad lateral en dispositivos pequeños (`px-4 sm:px-6`).

- [ ] **Fase 2: Estandarización de Componentes y Jerarquía Visual**
  - [ ] Refactorizar clases de botones en Tailwind: variantes primaria, secundaria, contorno y destructiva (`boton-panel-peligro`).
  - [ ] Transformar tablas críticas en listados responsive con formato tarjeta para móviles (`facturas`, `gastos`, `presupuestos`).
  - [ ] Auditar contrastes de color en textos secundarios (`--color-gris`) para cumplir estrictamente WCAG 2.1 AA (> 4.5:1).

- [ ] **Fase 3: Estados de Interfaz (Empty States, Skeletons y Feedback)**
  - [ ] Crear el componente `EstadoVacio.astro` con soporte para icono, mensaje orientativo y CTA contextual.
  - [ ] Implementar `EstadoVacio` en las listas vacías de Facturas, Presupuestos, Gastos, Pedidos y Clientes.
  - [ ] Implementar esqueletos de carga visual (*Skeleton loaders*) en componentes analíticos y vistas clave.
  - [ ] Diseñar el sistema de notificaciones no intrusivas (*Toasts*) para acciones completadas (creación, edición, borrado).

- [ ] **Fase 4: Revolución del Módulo de KPIs y Business Intelligence**
  - [ ] Ampliar el motor de cálculo de métricas en `src/server/informes/informes.ts`:
    - Cálculo de comparativa temporal con % de variación e indicador de tendencia.
    - Cálculo de embudo de conversión de presupuestos a facturas emitidas.
    - Cálculo de antigüedad de saldos pendientes de cobro (tramos de vencimiento).
  - [ ] Rediseñar la interfaz de `src/pages/panel/informes.astro` y el tablero de inicio con tarjetas analíticas de alto impacto visual (CSS puro / SVG semántico).
  - [ ] Añadir gráficos de barras y desglose de reparto optimizados para interacción móvil y accesibilidad con lectores de pantalla.

- [ ] **Fase 5: Verificación, Tests y Documentación**
  - [ ] Ejecutar la suite completa de pruebas unitarias y de integración (`npm test`).
  - [ ] Validar linting y tipos con `npm run lint`.
  - [ ] Realizar pruebas visuales y de accesibilidad automatizada (`axe-core` / e2e).
  - [ ] Actualizar la documentación del proyecto (`docs/estado.md`).
