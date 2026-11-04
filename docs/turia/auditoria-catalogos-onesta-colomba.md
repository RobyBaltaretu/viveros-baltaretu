# Auditoría documental: Onesta y Maderas Colomba

Fecha de comprobación: 4 de noviembre de 2026. Se utilizaron las copias adjuntas a la tarea. No se consultó ni modificó D1 de producción.

## Documentos leídos

### Onesta 2024-2025

La copia contiene 71 páginas PDF. La numeración impresa comienza en la página 8, por lo que la página PDF 13 corresponde a la impresa 19. Se inspeccionaron visualmente las páginas impresas 13-15 (PDF 7-9) y las páginas PDF 13-15 (impresas 19-21), incluida la matriz de melamina de diseño.

La auditoría reproducible (`npm run catalogo:auditar -- <pdf>`) detectó 1.022 combinaciones de tablero mediante celdas reales, no mediante producto cartesiano. Desglose relevante:

- PDF 7-9 / impresas 13-15: 5, 19 y 6 variantes.
- PDF 13-15 / impresas 19-21: 34, 33 y 579 variantes.
- El total supera 800 y la prueba de importación procesa 805 candidatos en lotes sin truncarlos.

Estas cifras son cobertura de extracción determinista pendiente de revisión humana; no equivalen a registros confirmados en D1. Las matrices conservan formato, espesor y unidades por paquete por celda. Una celda vacía no crea variante.

### Maderas Colomba 2026

La copia contiene siete páginas. Se revisaron texto y render de todas ellas. El detector local identifica:

- 15 cajoneras en la página 6.
- 3 zapateros y 9 muebles bajo proyecto en la página 7.
- Total: 27 productos configurables o a medida.

Los 23 nombres de melamina y las siete especies de chapa de la página 3 pueden representarse como decorativos reutilizables. La página 4 aporta ocho tarimas con referencia, familia, clase, dimensiones, capa de uso, instalación y suelo radiante. La página 5 contiene cinco especies de tablón con propiedades y medidas.

La extracción de tableros, acabados, tarimas y tablones usa la salida estructurada de Groq cuando no hay una matriz de celdas apta para el parser determinista. No se ejecutó Groq en esta auditoría porque no se usaron credenciales ni cuota externa; por tanto no se afirma cobertura real de esos registros.

## Cobertura

| Métrica | Onesta | Colomba |
| --- | ---: | ---: |
| Cobertura estructural | Familias, variantes, dimensiones, decorativos, propiedades y evidencia representables | Seis apartados representables; configurables y bajo proyecto incluidos |
| Extracción determinista comprobada | 1.022 variantes propuestas | 27 configurables; 10 sugerencias locales genéricas |
| Extracción Groq comprobada en esta tarea | No ejecutada | No ejecutada |
| Cobertura real en D1 de producción | No comprobada | No comprobada |

## Discrepancias y pendientes

- Las variantes detectadas no se importaron en producción. Deben revisarse en la interfaz y confirmarse en D1 aislada.
- No se asignaron colores oficiales, texturas ni disponibilidad cuando el PDF no los declara.
- Las muestras visuales solo se recortan en navegador y se guardan de forma privada después de confirmación humana; la auditoría CLI no extrae ni licencia imágenes.
- La página 6 de Colomba marca las alturas de `Bandeja` y `Con tapa de cristal` como "consultar"; se modelan bajo proyecto, sin una lista inventada.
- Los muebles a medida no reciben mínimos, máximos ni fórmulas no publicados.
- No se probó Gemini ni se afirmó reproducción fiel de texturas. El simulador conserva `varianteId` y utiliza únicamente muestras ya verificadas.

## Reproducción

```powershell
npm run catalogo:auditar -- `
  "C:\ruta\Catalogo_tablero_madera_2024_digital.pdf" `
  "C:\ruta\catalogo.pdf"
```

El comando solo lee los PDF y escribe un informe JSON en la salida estándar.

