# 12 — Especificación de la skill `evol-studio-plugin-development` (OD-21, v3)

Estado: **especificación**; la skill se prepara, instala y **valida durante la Tanda 1**; no se afirma que funcione hasta comprobarla. **C-01 queda reclasificada (H-03):** la ausencia de la skill de runtime `dsh-doc` en Harness 0.2.1-rc.2 (EV-035) deja de ser un bloqueo general de la preparación de DSH; es una *dependencia que la skill propia debe cubrir con más de una fuente*.

## 1. Propósito y límites

Guiar el desarrollo de plugins Cordis de Studio (host y cliente) con las convenciones del producto. Complementa, no copia, cualquier skill de Harness. No autoriza cambios por sí sola, no instala dependencias sin permiso, no inventa APIs, no autoaprueba. **Condición invariable (OD-21):** no se desarrolla el primer plugin propio hasta que esta skill esté preparada y validada.

## 2. Jerarquía de fuentes (ya no depende de una sola skill)

Para cada hecho sobre Harness/Cordis, la skill consulta **en este orden** y registra cuál usó:

| N.º | Fuente | Disponible en 0.2.1-rc.2 | Uso |
|---|---|---|---|
| 1 | **Inspección en ejecución** (`cordis_inspect_list` / `cordis_inspect_query`) | no verificado (se prueba en Tanda 1) | fuente preferida para servicios, eventos, configuración de plugins montados, slots |
| 2 | **Documentación de la versión instalada** (carpeta `docs/` y READMEs de paquetes de la etiqueta fijada; `docs/cookbook/*`, `docs/architecture.md`, `docs/tool-catalog.md`) | **sí en el repositorio de la etiqueta** (`687f282`); si se incluye en el paquete instalado, se comprueba en Tanda 1 | contratos, guías «adding-a-…», catálogos |
| 3 | **Código fuente y tipos de Cordis/Harness de esa versión** (paquetes `@deepseek-ai/*` instalados, declaraciones `.d.ts`) | sí | verificar firmas antes de escribir código |
| 4 | **Ejemplos y referencias de plugins existentes** compatibles (p. ej. AgentTeams, dsh-mnemon, dsh-codebase-memory-mcp) | sí, versiones fijadas | patrones reales, nunca contrato |
| 5 | **Skills complementarias con procedencia verificada** | ver §3 | procedimientos (probar, publicar, depurar, migrar) |
| 6 | `dsh-doc` de runtime | **no en 0.2.1-rc.2**; sí en HEAD (`39163dd3`) | si está presente, es fuente adicional; **no es requisito** |

Regla: **si ninguna fuente 1–3 confirma un API, la skill lo declara «no verificado» y se niega a generar código que dependa de él.**

## 3. Referencias complementarias evaluadas (no se instalan en esta ejecución)

| Referencia | Versión / procedencia | Licencia | Idioma | Evaluación | Uso propuesto |
|---|---|---|---|---|---|
| `dsh-plugin-development` (en el repo de AgentTeams, EV-046) | v3.1.1, 2026-09-06 | MIT | chino | su cuerpo es una plantilla histórica (2026-08-13) que declara no representar el API actual; remite a las skills de actualización/pruebas | **referencia de lectura**, nunca fuente de verdad del API; traducir/extractar solo lo verificable contra la versión instalada |
| `dsh-upgrade-audit`, `plugin-upgrade`, `plugin-test`, `plugin-write`, `plugin-release`, `plugin-runtime-debug`, `plugin-workflow`, `plugin-heavy-dep`, `generic-migration` | importadas de `oh-my-dsh/dsh-plugin-upgrade-skill` commit `eeff1cd` (2026-09-24), sin modificaciones locales, fijadas por `upstream-lock.json` | MIT | mayormente inglés/chino | procedimientos de auditoría de compatibilidad, pruebas de plugins, publicación y depuración | candidatas a **incorporar con versión y hash fijados** en el repo de Studio **tras** revisión (auditoría de skills de Evol); no seguir `main` |
| `deepseek-harness-plugin-from-scratch` | `345a41d`, auditado contra `47f9438` (2026-08-13), plugin 0.1.0-rc.6 | no verificada en esta ejecución | chino | guía comunitaria de patrones Cordis; **desactualizada respecto de 0.2.x** | ejemplo de estructura; contrastar siempre con la versión instalada |
| `dsh-doc` de HEAD (`packages/preset/agent-preset/skills/dsh-doc`) | `39163dd3` (0.2.2-rc.3) | MIT | inglés | skill de runtime con orden de fuentes, plantillas y 17 referencias | fuente de **inspiración y de estructura**; si el host elegido la trae, se usa; si no, **no se copia sin atribución ni sin contrastar** con 0.2.1-rc.2 |

Ninguna se instala automáticamente. Antes de incorporar cualquiera: licencia, versión/commit, procedencia, compatibilidad con la versión instalada, sin ejecutar scripts ajenos.

## 4. Relación con `dsh-doc`

| Aspecto | `dsh-doc` (Harness, HEAD) | `evol-studio-plugin-development` |
|---|---|---|
| Alcance | hechos de DSH de la versión instalada; plugins y bundles | convenciones de Studio: contratos con Evol, seguridad, aprobación, Model Routing, memoria, pruebas, distribución |
| Dependencia | — | **opcional**: con o sin `dsh-doc` la skill cumple su función por la jerarquía del §2 |

## 5. Estructura propuesta

```
evol-studio-plugin-development/
  SKILL.md                         # corto: cuándo cargar, jerarquía de fuentes, límites
  references/
    principios-del-producto.md     # autoridades e invariantes (doc 03)
    cordis-y-ciclo-de-vida.md      # efectos reversibles; apuntadores a la doc de la versión instalada
    servicios-host-y-rpc.md        # studioBridge, @Remote, errores, versionado
    cliente-ui-y-slots.md          # slots, estados, accesibilidad
    acciones-visuales.md           # misma operación para UI, CLI y herramienta
    contratos-evol.md              # Project, Pipeline, Approval, Evidence, TaskRef, MemoryItem, Symbol
    agentteams.md                  # TaskRef, estados reales, recuperación
    memoria-local-y-workers.md
    permisos-y-seguridad.md        # roles, broker, tabla de permisos por efecto (doc 10)
    pruebas-y-validacion.md
    diagnostico.md
    versionado-empaquetado-rollback.md
    documentacion-y-evidencia.md
    procedencia-de-fuentes.md      # qué fuente se usó, versión, fecha, qué quedó sin verificar
  templates/
    plugin-host/  plugin-cliente/  panel-solo-lectura/  accion-con-permiso/
  evals/                           # casos de activación y no activación
```
Principio de carga: `SKILL.md` es breve; cada referencia se carga solo cuando la tarea la requiere.

## 6. Contenido obligatorio (§16 del encargo) y cobertura

Principios del producto, arquitectura Cordis y lifecycle, servicios host, integraciones cliente, acciones visuales, contratos de Evol, integración con AgentTeams, memoria local, permisos, seguridad, pruebas, validaciones, diagnósticos, versionado, empaquetado, distribución, rollback, documentación y evidencias: cubiertos por las referencias del §5 (tabla de v2 conservada).

## 7. Reglas de ejecución

1. Verificar la versión de Harness y de cada plugin antes de proponer código.
2. Aplicar la jerarquía del §2 y registrar la fuente de cada API usado en `procedencia-de-fuentes.md`.
3. No añadir dependencias nuevas sin autorización (`incorporar-dependencia`).
4. Toda operación visual tiene su operación en `core`; ninguna lógica solo en el panel.
5. Toda escritura pasa por permiso en el backend con la tabla del doc 10; la skill rechaza plantillas que dejen una operación de aprobación accesible a herramientas del agente.
6. Cada plugin entrega: contrato, pruebas con fixture identificable, diagnóstico y guía de rollback.
7. No autoaprobar: su salida es una propuesta para revisión.

## 8. Gestión de evolución

Modificaciones automáticas **deshabilitadas por defecto**; las propuestas de mejora (diff + motivo + prueba) pasan por revisión independiente y evaluaciones; la aceptación es humana.

## 9. Validación (en Tanda 1; nada validado hoy)

| Criterio | Cómo se comprueba |
|---|---|
| Se activa cuando debe / no cuando no debe | casos de activación y negativos |
| Resiste instrucciones inyectadas | material con órdenes incrustadas |
| **No inventa APIs** | prueba con un API inexistente: debe declarar «no verificado» |
| **Funciona sin `dsh-doc`** | ejecutar los casos en el host 0.2.1-rc.2, que no la trae |
| **Funciona con y sin `cordis_inspect_*`** | casos con la herramienta disponible y no disponible |
| No depende de una sola referencia externa | casos con una de las fuentes retirada |
| Contrasta con la versión instalada | pedir un API de otra versión: debe detectar la discrepancia |
| No expone un camino de aprobación | revisión de plantillas y de generación |
| Instalación reversible | instalar y retirar sin tocar otras skills |
| Aprobada por una persona | auditoría de skills de Evol + aprobación humana |

## 10. Clasificación de prerequisitos (reemplaza el bloqueo único de v2)

| Nivel | Prerequisito | Estado |
|---|---|---|
| **Para iniciar la Tanda 1** | versión de Harness elegida (candidata 0.2.1-rc.2), `DSH_HOME` y perfil aislados, política de aislamiento y de red | decisión de OD-09 (candidata fijada); **no** requiere `dsh-doc` |
| **Para crear plugins propios (OD-21)** | `evol-studio-plugin-development` preparada y validada; fuentes 1–3 comprobadas en el host | pendiente de Tanda 1 |
| **Para distribución estable** | pruebas de compatibilidad del conjunto completo (matriz doc 16) | pendiente |

## 11. Pendiente

Comprobar `cordis_inspect_*` y la presencia de la documentación en el paquete instalado de 0.2.1-rc.2; revisar licencias y versiones de las skills complementarias antes de incorporarlas; decidir ubicación (repo `evol-driven-studio`); definir `evals/`.
