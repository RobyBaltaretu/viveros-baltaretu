# Precisión del asistente (intérprete local por reglas)

Medido el 2026-10-15 con `npm run asistente:banco`.

| Banco | Aciertos | Precisión | Frases fuera de tema que acaban en un cambio |
|---|---|---|---|
| Frases de ajuste (`tests/asistente/frases.json`) | 34/34 | 100 % | 0 |
| Frases de control, no usadas para ajustar (`frases-control.json`) | 14/18 | 78 % | 0 |

## Fallos
- «se acabaron las cicas»: esperado cambiar_disponibilidad cycas-revoluta agotado; obtenido fuera-de-tema
- «no nos quedan naranjos amargos»: esperado cambiar_disponibilidad naranjo-amargo agotado; obtenido no-entiendo
- «las datileras se sirven bajo pedido»: esperado cambiar_disponibilidad phoenix-dactylifera bajo-pedido; obtenido fuera-de-tema
- «han entrado presupuestos?»: esperado contar_presupuestos; obtenido fuera-de-tema
