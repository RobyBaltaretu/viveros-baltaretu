# Hoja de ruta: panel propio y asistente

Parte de la web que ya está en `main`. Cada tarea va en su rama con PR y la CI en verde. Responsables: **Propietario** (cuentas, decisiones, soporte, aprobación de producción), **Claude** (diseño, código, pruebas, documentación) y **Gerente** (pruebas de uso).
Tamaño: S (horas), M (1-2 días), L (varios días).

## Fase 0. Decisiones y preparación
| # | Tarea | Resp. | Tam. | Entregable |
|---|-------|-------|------|------------|
| 0.1 | Aprobar `definicion.md` y responder las decisiones abiertas (§12) | Propietario | S | Alcance cerrado |
| 0.2 | Plan técnico: verificar límites gratuitos y cómo leer D1 en el build, y medir una prueba de concepto | Claude | M | Plan aprobado |
| 0.3 | Crear en Cloudflare la base D1, el bucket R2 y la aplicación de Access para `/panel` | Propietario + Claude | S | Recursos creados |

## Fase 1. Base de datos y capa de datos
| # | Tarea | Resp. | Tam. | Entregable |
|---|-------|-------|------|------------|
| 1.1 | Esquema de D1 con migraciones versionadas | Claude | M | Migraciones |
| 1.2 | Capa de repositorios `src/server/data/` con tests | Claude | M | Capa de datos |
| 1.3 | Script de importación del contenido actual (`src/content/*` y fotos) a D1 y R2 | Claude | M | Importación verificada |
| 1.4 | Build que lee de D1 y genera las mismas páginas que hoy (equivalencia comprobada con tests y e2e) | Claude | L | Paridad con Keystatic |

## Fase 2. Panel (móvil primero)
| # | Tarea | Resp. | Tam. | Entregable |
|---|-------|-------|------|------------|
| 2.1 | Acceso con Cloudflare Access, validación del token, roles y auditoría | Claude + Propietario | M | Panel protegido |
| 2.2 | Inicio con las 5 tarjetas y estructura de navegación | Claude | M | Esqueleto |
| 2.3 | Plantas: listado, alta guiada, edición, precio, disponibilidad y archivar, con las reglas del esquema | Claude | L | Gestión del catálogo |
| 2.4 | Fotos en R2 con compresión, reencuadre y textos alternativos propuestos ES/EN | Claude | L | Subida de fotos |
| 2.5 | Empresa, condiciones de venta, portada, páginas fijas, proyectos y guías | Claude | L | Resto de contenido |
| 2.6 | Borradores, vista previa, "Publicar cambios" (Deploy Hook), historial y "Deshacer" | Claude | L | Publicación segura |
| 2.7 | Copia nocturna a R2 y prueba de restauración | Claude | M | Copias verificadas |
| 2.8 | Ayuda ilustrada y guía de una página para el gerente | Claude | M | Guía de uso |

## Fase 3. Presupuestos
| # | Tarea | Resp. | Tam. | Entregable |
|---|-------|-------|------|------------|
| 3.1 | Guardar cada petición en D1 sin perder el email, Turnstile ni el campo trampa | Claude | M | Peticiones guardadas |
| 3.2 | Bandeja con estados (nuevo, respondido, archivado) y exportación | Claude | M | Bandeja operativa |

## Fase 4. Asistente
| # | Tarea | Resp. | Tam. | Entregable |
|---|-------|-------|------|------------|
| 4.1 | Lista cerrada de acciones sobre la misma capa de validación del panel | Claude | M | Acciones |
| 4.2 | Nivel 1: asistente guiado con botones y confirmación | Claude | M | Asistente guiado |
| 4.3 | Nivel 2: lenguaje natural con Workers AI, coincidencia aproximada, confirmación Sí/No y banco de pruebas con frases reales en español | Claude + Gerente | L | Informe de precisión |
| 4.4 | Límites diarios, rechazo de otros temas, defensa contra inyección, degradación al nivel 1 y proveedor intercambiable | Claude | M | Asistente robusto |

## Fase 5. Calidad, cambio y retirada de Keystatic
| # | Tarea | Resp. | Tam. | Entregable |
|---|-------|-------|------|------------|
| 5.1 | Tests automáticos del panel, e2e y accesibilidad WCAG AA | Claude | M | CI en verde |
| 5.2 | Prueba real: el gerente usa el panel desde su móvil sin ayuda mientras se observa | Propietario + Gerente | M | Lista de mejoras |
| 5.3 | Retirar Keystatic en un PR aparte y actualizar `CLAUDE.md`, README, `estado.md` y CI | Claude | M | Keystatic eliminado |
| 5.4 | Pasos manuales finales y publicación a producción con aprobación manual | Propietario | S | Panel en producción |

## Fase 6. Después
| # | Tarea | Resp. | Tam. | Entregable |
|---|-------|-------|------|------------|
| 6.1 | Revisar consumo de límites gratuitos y precisión del asistente cada trimestre | Propietario + Claude | S | Informe |
| 6.2 | Valorar la API de Claude para el asistente si la precisión no basta | Propietario | S | Decisión |

## Dependencias
- La fase 1 precede a la 2; la 3 y la 4 dependen de la 2. Keystatic sigue operativo hasta la tarea 5.3.
- Lo pendiente de publicar de la web (catálogo real, datos de empresa, textos legales) sigue en `docs/estado.md` y no depende de esta hoja de ruta.
