# Informes de Creaciones Turia

Por defecto se muestran los últimos doce meses; también hay mes, trimestre, año y rango personalizado. El periodo seleccionado filtra la fecha de emisión de facturas, la fecha de gastos confirmados y la fecha de presupuestos. El gráfico mensual recorta también los meses parciales del rango personalizado. Los borradores y gastos por revisar no cuentan; las rectificativas restan. No se suman presupuestos a la facturación: los anticipos y finales se cuentan únicamente a través de sus facturas emitidas.

- **Facturación emitida:** base imponible sin IVA; se muestra también el total de factura con IVA y recargo.
- **Gastos confirmados:** base cuando está desglosada; si no, el total registrado. También se muestra el total con IVA.
- **Resultado registrado:** facturación sin IVA menos gastos confirmados registrados. No es beneficio neto ni coste real de obra.
- **Cobrado:** facturas cobradas cuya fecha de cobro cae dentro del rango, incluso si se emitieron antes. Incluye IVA.
- **Por cobrar y antigüedad:** foto de las facturas emitidas pendientes en el momento actual, con IVA. No se reconstruye un saldo histórico a partir de datos que no registran todas las reversiones de cobro; se etiqueta como situación actual.
- **Aceptación:** aceptados entre los presupuestos aceptados o rechazados fechados en el periodo. Los enviados vigentes y los que caducan se muestran como situación actual.
- **Repartos:** gastos por categoría, clientes y líneas de facturas del periodo; valores sin IVA. El desglose por tipo de trabajo no está clasificado de forma fiable.

La rentabilidad por obra queda sin datos suficientes: no hay costes y cantidades reales vinculados de forma completa a una obra. No se calcula un margen estimado como si fuera real. El CSV se obtiene con el mismo permiso de informes y recoge las cifras del periodo y los desgloses, incluidos los indicadores que representan la situación actual. Protege los textos frente a fórmulas de hojas de cálculo.

Para rangos largos, el gráfico mensual permite desplazamiento horizontal y conserva una tabla de datos accesible. El selector de periodo mantiene separados los valores del intervalo y los saldos actuales.

Cuando el periodo seleccionado no contiene el día actual, los saldos pendientes, la antigüedad y la cartera pendiente muestran «Sin datos suficientes»: el historial de cambios y reversiones no permite reconstruirlos de forma fiable. Las fechas de emisión, gastos y aceptación sí se filtran por el periodo.
