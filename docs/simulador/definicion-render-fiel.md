# Turia Studio — simulación fiel a la realidad

Fecha: 2026-11-05. Petición del propietario tras probar Studio con un lavadero real: «No tiene del todo en cuenta la foto, el boceto ni las medidas. Queremos que sea fiel a la realidad», y el selector de materiales «solo debería dejar seleccionar el material que corresponde a cada parte».

## 1. Revisión: por qué la imagen no se parecía

Caso de prueba: lavadero con la foto del espacio (con el diseño marcado en rojo encima), el boceto en papel con cotas en **centímetros** (233 total; 80 fregadero, 62/63 columna de lavadora y secadora, 86,5 armario de dos puertas, 20 de pilar, fondo 41) y el resultado esperado (bajo con fregadero y encimera, barra de colgar encima, columna con lavadora y secadora apiladas y un altillo, armario alto de dos puertas, pilar y termo sin tocar, frentes verde mate y cuerpos blancos).

| Problema | Causa en el código |
|---|---|
| Las medidas no llegaban a la imagen | `interpretar-boceto.ts` solo aceptaba cotas en milímetros «cuando la unidad esté explícita»; los carpinteros acotan en **cm** sin escribir la unidad → todas `null`. |
| Se perdía qué lleva cada módulo | El esquema solo tenía `tipo` (armario, cajonera, hueco…), sin «lavadora y secadora apiladas», «fregadero con encimera», «barra de colgar». La IA de imagen tenía que adivinarlo. |
| Inventaba muebles y cambiaba el espacio | El prompt de `studio-generar.ts` era una frase en castellano más un **JSON interno** (ids de módulo, ids de variante `articulo:…`), sin orden de izquierda a derecha, sin proporciones, sin decir qué conservar (pilar, termo, tuberías, suelo) ni que las **líneas rojas** de la foto son la guía del carpintero y deben desaparecer. |
| Los materiales no se parecían | A Gemini solo le llegaban la referencia y el acabado en texto; ni el nombre, ni el color, ni la muestra de la textura que ya guarda el catálogo. |
| Encuadre distinto | No se pedía la misma proporción de imagen que la foto. |
| Selector de materiales | Enseñaba todo el catálogo y el servidor rechazaba después («La pieza requiere un tablero o panel»). |

## 2. Definición funcional

**Leer el boceto (paso 2).**
- La IA devuelve los módulos de **izquierda a derecha**, cada uno con: tipo, ancho/alto/fondo, **qué lleva** (electrodomésticos, fregadero, barra, baldas…) y sus piezas.
- Las cotas se leen en la unidad del dibujo; sin unidad escrita, un carpintero acota en **centímetros** (se convierten a mm). Siguen siendo «aproximadas» hasta que la persona las confirma.
- Los elementos del espacio que no se tocan (pilar, termo, ventana, tuberías, enchufes) se guardan como «a conservar».

**Revisar (paso 3).**
- Medidas en **cm** (como en el boceto), con decimales.
- Cada módulo tiene un campo «Qué lleva» editable (por ejemplo «lavadora y secadora apiladas, altillo encima»).
- Cada pieza elige material **solo entre los compatibles con ella**: puertas, costados, baldas, cajones, traseras e interiores → tableros, madera, chapas y laminados; canto → cantos; encimera → encimeras. Nunca se ofrece algo que luego se rechace.

**Generar la imagen (paso 4).**
- Se envía a Gemini: la **foto del espacio** (base que se edita), el **boceto** (distribución) y la **muestra de cada material** elegido (si el catálogo la tiene), con instrucciones claras:
  - editar la foto, no inventar otra: misma cámara, perspectiva, luz, paredes, suelo y techo;
  - conservar todo lo marcado como «a conservar» y lo que no sea la obra;
  - las líneas rojas o de rotulador de la foto son la guía de colocación: el mueble va ahí y las líneas desaparecen;
  - módulos en orden de izquierda a derecha con su ancho en cm y en % del total, alto y fondo, y lo que lleva cada uno;
  - materiales por parte (cuerpos, frentes, encimera, cantos) con su nombre, color, acabado y muestra;
  - no añadir módulos, baldas, altillos, puertas ni electrodomésticos que no estén en el diseño.
- Misma proporción de imagen que la foto.

## 3. Definición técnica

1. `src/server/simulador/boceto.ts`: `ModuloBoceto.contenido?: string` (opcional; los guardados antes siguen valiendo).
2. `src/server/simulador/interpretar-boceto.ts`: esquema con `unidad` (`cm` | `mm`), `contenido` por módulo, `conservar` (elementos del espacio); conversión cm → mm; prompt nuevo.
3. `src/server/simulador/compatibilidad-materiales.ts`: `materialCompatible(tipoPieza, articulo, variante)` sin efectos; la usan el selector y la validación.
4. `src/pages/api/panel/studio-materiales.ts`: parámetro `tipo` de pieza → solo materiales compatibles.
5. `src/server/simulador/render-boceto.ts`: `promptRender(diseño, materiales)` en inglés (lo sigue mejor el modelo de imagen) a partir del diseño validado, y `proporcionImagen(bytes)` → la proporción admitida por Gemini más cercana a la foto.
6. `src/pages/api/panel/studio-generar.ts`: usa `promptRender`, adjunta hasta 4 muestras de material del catálogo y fija `imageConfig.aspectRatio`.
7. Pantalla: medidas en cm, «Qué lleva», selector filtrado por pieza.
8. Pruebas: unitarias del prompt (orden, cm y %, conservar, líneas rojas, materiales), de la conversión de unidades y del filtro de materiales; e2e de la pantalla.

Coste: igual (una imagen por generación, mismo cupo de 250 al mes); las muestras añaden unos pocos tokens de entrada.
