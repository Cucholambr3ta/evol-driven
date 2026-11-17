# 23 — EVOL-STUDIO-UI-UX-SYSTEM (documento normativo de diseño)

Estado: **normativo de diseño por directiva del propietario (v3.1 §8); no se ha creado ninguna interfaz.** Referencia inicial: los mockups existentes de `docs/design/mockups/` (Tablero, Proyecto, Documentación, Grafos, Skills) y sus fuentes en `docs/design/mockups-src/`. Se conserva su dirección **minimalista**: fondo liso, tipografía legible, color con significado, sin decoración.

## 1. Principios

1. **Facilidad de revisión primero.** Cada pantalla debe permitir a una persona decidir con evidencia a la vista: qué cambió, quién lo hizo, qué se verificó y qué falta.
2. **Navegación contextual.** Desde cualquier elemento se llega a su origen y a lo relacionado (fase → artefacto → criterio → prueba → evidencia → commit → tarea), con «volver» predecible.
3. **Accesibilidad como requisito, no como mejora.** Teclado completo, foco visible, lector de pantalla, contraste suficiente, sin información solo por color, respeto de `prefers-reduced-motion`. Objetivo de diseño: **WCAG 2.2 nivel AA**; el cumplimiento **no está comprobado** hasta ejecutar las pruebas de la §7.
4. **Estados operativos verificables.** Un indicador solo dice «operativo», «verificado» o «aprobado» si hay una comprobación reciente y enlazada a su evidencia; si no, dice «desconocido» con la fecha de la última comprobación.
5. **Nada simulado presentado como real.** Los datos de muestra solo existen en maquetas y llevan una marca visible «DATOS DE MUESTRA»; ninguna vista funcional los usa (regla ya vigente en el doc 09).
6. **La lista es el modo principal** para localizar documentos y elementos; el **grafo y la constelación** son herramientas complementarias de exploración y siempre tienen un equivalente de lista (ver §4).
7. **Sin animaciones decorativas ni métricas sin utilidad.** Toda cifra responde una pregunta, indica su fuente y su frescura, y enlaza a su detalle. Movimiento solo si informa un cambio de estado y se desactiva con `prefers-reduced-motion`.
8. **Efectos visibles antes de actuar.** Toda acción muestra qué hará, qué permiso exige, si es reversible y qué registro dejará (doc 09 §3).

## 2. Tokens de diseño (heredados de los mockups, a confirmar)

| Grupo | Tokens (tema claro / oscuro en los mockups) | Uso |
|---|---|---|
| Superficies | `--page`, `--surface`, `--wash`, `--grid`, `--axis`, `--border` | fondos lisos, separadores |
| Texto | `--ink`, `--ink-2`, `--muted` | jerarquía de lectura |
| Series | `--s1` azul, `--s2` naranja, `--s3` verde, escala `--seq-100…600` | distinguir categorías y densidad, **siempre con etiqueta o patrón**, nunca solo color |
| Estados | `--good`, `--warning`, `--serious`, `--critical`, `--info` | PASS / WARN / BLOCK / error, siempre con **icono y texto** |
| Foco | `--focus` | contorno visible en todo elemento interactivo |

Los dos temas (claro y oscuro) se mantienen. **Pendiente de confirmar** (D-15): tipografía de la interfaz y comprobación de contrastes reales de cada par de tokens.

## 3. Mapa de navegación

| Zona | Vistas |
|---|---|
| Inicio | Tablero de proyectos |
| Proyectos | Resumen · **Pipeline Explorer** · Documentos · **Repositorio** (OD-27) · Memoria del proyecto |
| Revisión | **Centro de revisión** · **Inspector de evidencias** · Historial de aprobaciones |
| Ejecución | **Agent Runs** · tareas (Work Manager) |
| Inteligencia | **Code Intelligence** · **Memory Center** · **Model Routing** |
| Plataforma | **Plugin Studio** · Skills · **Diagnósticos** · **Recovery Center** |

## 4. Vistas requeridas

Cada vista usa los **estados obligatorios** de la §5. Las acciones muestran su permiso y su efecto (doc 10). Ninguna lee archivos protegidos ni bases de terceros: solo contratos JSON de `core` y servicios autorizados (OD-17).

| Vista | Pregunta que responde | Elementos principales | Acciones (permiso) | No debe mostrar |
|---|---|---|---|---|
| **Centro de revisión** (antes «Approval Center») | ¿Puedo autorizar el avance de esta fase y por qué? | checklist por fase (doc 21), paquete de revisión, resultados de verificación, bloqueos, historial; botón **Autorizar avance** | marcar ítems (Approver/Reviewer, sesión humana); autorizar (broker) | claves, firmas completas, comentarios de otros proyectos |
| **Pipeline Explorer** | ¿Dónde está el proyecto y qué lo bloquea? | siete fases en lista, estado de cada una (pendiente · actual · aprobada · invalidada), artefactos por fase, ciclos; vista de grafo opcional | verificar estructura (Operator); abrir artefacto | estados sin evidencia como «verificado» |
| **Inspector de evidencias** | ¿Qué prueba respalda este ítem? | evidencia con tipo, fuente, fecha, hash, resultado y vínculo al ítem, al CA y al commit; comparación de versiones | exportar (Reader); reejecutar (Operator, distinto de «consultar») | secretos; contenido de documentos citado en mensajes |
| **Agent Runs** | ¿Qué hicieron los agentes y con qué resultado? | ejecuciones de AgentTeams: tarea, miembro, modelo, estado, duración, resultado, resúmenes de entrega, errores | pausar/reintentar (Operator); cerrar tarea (según permisos) | cadenas de razonamiento internas; aprobar fases |
| **Memory Center** | ¿Qué recuerda el sistema, de dónde y por qué? | recuerdos con procedencia, proyecto, fecha, estado; búsqueda; política de captura | corregir/retirar un recuerdo (Operator); activar captura (Administrator) | recuerdos de otro proyecto; escritura automática duplicada |
| **Code Intelligence** | ¿Qué depende de qué y qué se rompería? | búsqueda de símbolos, impacto, trazas, frescura del índice; **lista** y vista de grafo/constelación | reindexar (Operator) | resultados de otro proyecto |
| **Model Routing** | ¿Qué modelo usa cada fase y cuánto cuesta? | tabla fase→modelo→razonamiento→límite→contingencia; indicador **remoto/local** | cambiar configuración (Administrator, con vista previa) | selecciones silenciosas de modelos remotos |
| **Plugin Studio** | ¿Qué plugins hay, de qué versión y en qué estado? | manifiesto, versión exacta, hash, licencia, compatibilidad probada o no, salida de datos declarada; flujo de desarrollo asistido por la skill fundacional | instalar/desactivar en un **perfil aislado** (Administrator, vista previa) | instalaciones automáticas; `latest` |
| **Recovery Center** | ¿Cómo recupero un servicio o vuelvo a un estado válido? | estado del broker y de los servicios, procedimientos de recuperación guiados (doc 11 §8), restauraciones, incidentes | diagnosticar (Operator); acciones administrativas (Administrator) | ningún bypass de autorización |
| **Repositorio** (OD-27) | ¿Qué pasó en el repositorio y cómo se relaciona con el pipeline? | resumen, README, commits, ramas, PR, issues, Actions, releases, contribuidores, actividad (doc 22) | solo lectura | tokens; operaciones de escritura |
| **Diagnósticos** | ¿Está sano el entorno y qué sale de la máquina? | comprobaciones con fecha y resultado, versiones, **salidas de datos por componente**, discrepancia estado↔registro, MCP activos | ejecutar diagnóstico (Operator) | valores de secretos |

## 5. Estados obligatorios de toda vista

**cargando · vacío (con causa y siguiente paso) · error (con enlace a Diagnósticos) · sin permiso (con el permiso necesario) · desconectado · desactualizado (con fecha de la fuente) · bloqueado (con motivo)**. Un vacío real se muestra como vacío; un fallo no se oculta con datos anteriores sin avisar.

## 6. Documentos: lista primero, grafo después

- La vista de **Documentos** abre en **Lista** (columnas: nombre, grupo, fase/disciplina que lo exige, estado «existe · por completar · no existe», huella, fecha). Búsqueda única y filtro «Solo lo que falta» (heredados de la Ampliación 3).
- La **constelación** y el **grafo** (código y documentación) son una vista **complementaria**: botón explícito, ficha desplegable con el mismo lector que la lista, manejo por teclado y **lista equivalente** de todos los nodos. Se conserva lo ya diseñado: canvas sin dependencias, `prefers-reduced-motion`, fondo liso sin estrellas decorativas.
- **Cambio respecto de la normativa:** el criterio 62 de la Ampliación 3 («Documentación abre por defecto en Constelación») queda **sustituido** por esta directiva (enmienda AMD-05, doc 28).

## 7. Cómo se valida (todo pendiente)

| ID | Prueba |
|---|---|
| UX-01 | Recorrido completo de cada vista **solo con teclado**, con foco visible y orden lógico |
| UX-02 | Lector de pantalla: roles, etiquetas y anuncios no intrusivos de cambios de estado |
| UX-03 | Contraste de cada par de tokens (texto ≥ 4,5:1; componentes ≥ 3:1) en ambos temas |
| UX-04 | Ninguna información depende solo del color (estados con icono y texto) |
| UX-05 | `prefers-reduced-motion`: sin movimiento ni parpadeo |
| UX-06 | Ampliación al 200 % y reflujo a ancho estrecho sin pérdida de información |
| UX-07 | Cada vista implementa los siete estados obligatorios (prueba automática de estados) |
| UX-08 | Ninguna vista funcional muestra datos de muestra; las maquetas llevan la marca |
| UX-09 | Cada cifra tiene fuente, fecha y enlace al detalle |
| UX-10 | Equivalencia lista ↔ grafo (mismos nodos y mismas fichas) |
| UX-11 | Efectos, permiso y registro visibles antes de toda acción que escribe |
| UX-12 | Comprobación en navegador real, como ya hacen las maquetas con `drive.js` en Chromium |

## 8. Antipatrones prohibidos

Paneles de «salud» sin comprobación detrás; porcentajes sin denominador; gráficos de adorno; animaciones de carga que simulan progreso; confirmaciones por un clic para operaciones protegidas; mostrar un resultado anterior como actual; ocultar un bloqueo; colores como único portador de significado; modales para información que no exige decidir.

## 9. Pendientes

Confirmar tipografía y contrastes (D-15); actualizar las maquetas para las vistas nuevas **solo después** de aprobar este documento; definir la plantilla de componentes (estado, ítem de checklist, tarjeta de evidencia, insignia de permiso, insignia de frescura) en el momento de implementar el cliente.
