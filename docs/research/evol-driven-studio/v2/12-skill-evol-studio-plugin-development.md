# 12 — Especificación de la skill `evol-studio-plugin-development` (OD-21)

Estado: **especificación**; la skill se prepara e instala en Tanda 1, antes del primer plugin propio. **Bloqueada por la contradicción C-01**: la skill `dsh-doc` de runtime sobre la que se apoya existe en Harness 0.2.2-rc.3 pero **no** en 0.2.1-rc.2 (EV-034/035).

## 1. Propósito y límites

Guiar el desarrollo de plugins Cordis de Studio (host y cliente) con las convenciones del producto, **complementando** `dsh-doc`, no copiándola. No autoriza cambios por sí sola («cargar la skill no autoriza» — regla de `dsh-doc`), no instala dependencias sin permiso, no inventa APIs, no autoaprueba.

## 2. Relación con `dsh-doc`

| Aspecto | `dsh-doc` (Harness) | `evol-studio-plugin-development` |
|---|---|---|
| Alcance | hechos de DSH de la versión instalada; crear/depurar plugins y bundles; presets | convenciones de Studio: contratos con Evol, seguridad, aprobación, Model Routing, memoria, pruebas, distribución |
| Fuente de verdad | inspección en ejecución (`cordis_inspect_*`) → documentación instalada → declarar lo no verificado | la misma jerarquía + los contratos de Studio |
| Mecanismos que reutiliza | `references/plugin-development`, `host-plugin`, `ui-plugin`, `user-actions`, `verification`, `tool-design`, `compositions`, `upgrading`, plantillas | los enlaza por nombre, no los duplica |

**Regla de dependencia:** si `dsh-doc` de runtime no está en el host, la skill **se niega a generar código que dependa de APIs no comprobables** y pide la inspección en ejecución o la documentación de la versión instalada. Alternativa para 0.2.1-rc.2 (a decidir): incorporar al repo de Studio una copia atribuida (MIT) de las referencias estrictamente necesarias, sin tratarla como verificada hasta contrastarla con el host.

## 3. Estructura propuesta

```
evol-studio-plugin-development/
  SKILL.md                         # corto: cuándo cargar, orden de consulta, límites
  references/
    principios-del-producto.md     # autoridades, invariantes (doc 03)
    cordis-y-ciclo-de-vida.md      # apuntadores a dsh-doc; reglas de efectos reversibles
    servicios-host-y-rpc.md        # studioBridge, @Remote, errores, versionado
    cliente-ui-y-slots.md          # slots, estados, accesibilidad, componentes
    acciones-visuales.md           # misma operación para UI, CLI y herramienta (user-actions)
    contratos-evol.md              # Project, Pipeline, Approval, Evidence, TaskRef, MemoryItem, Symbol
    agentteams.md                  # TaskRef, estados reales, recuperación
    memoria-local-y-workers.md     # contratos, aislamiento, política de escritura
    permisos-y-seguridad.md        # roles, broker, qué no hacer
    pruebas-y-validacion.md        # pirámide, fixtures, evidencia ejecutada
    diagnostico.md                 # salud, logs sin secretos
    versionado-empaquetado-rollback.md
    documentacion-y-evidencia.md
  templates/
    plugin-host/  plugin-cliente/  panel-solo-lectura/  accion-con-permiso/
  evals/                           # casos de activación y de no activación (promptfoo/evaluar-skill)
```
Principio de carga: `SKILL.md` es breve; cada referencia se carga **solo** cuando la tarea la requiere (no se vuelca todo en cada conversación).

## 4. Contenido obligatorio (§16) y dónde se cubre

| Requisito | Referencia |
|---|---|
| Principios del producto | `principios-del-producto` |
| Arquitectura Cordis, lifecycle | `cordis-y-ciclo-de-vida` (+ `dsh-doc`) |
| Servicios host, integraciones cliente, acciones visuales | `servicios-host-y-rpc`, `cliente-ui-y-slots`, `acciones-visuales` |
| Contratos de Evol, AgentTeams, memoria local | `contratos-evol`, `agentteams`, `memoria-local-y-workers` |
| Permisos y seguridad | `permisos-y-seguridad` |
| Pruebas, validaciones, diagnósticos | `pruebas-y-validacion`, `diagnostico` |
| Versionado, empaquetado, distribución, rollback | `versionado-empaquetado-rollback` |
| Documentación y evidencias | `documentacion-y-evidencia` |

## 5. Reglas de ejecución de la skill

1. Verificar la versión de Harness instalada y la de cada plugin antes de proponer código.
2. Consultar primero la inspección en ejecución; si no existe, la documentación de **la versión instalada**; si tampoco, declarar «no verificado».
3. No incluir dependencias nuevas sin autorización (usa el procedimiento de `incorporar-dependencia`).
4. Toda operación visual debe tener su operación de `core`; nunca lógica solo en el panel.
5. Toda escritura pasa por permiso en el backend; la skill rechaza plantillas que dejen una operación de aprobación accesible a herramientas del agente.
6. Cada plugin entrega: contrato, pruebas con fixture identificable, diagnóstico, guía de rollback.
7. No autoaprobar implementaciones: la salida es una propuesta para revisión.

## 6. Gestión de evolución

Las modificaciones automáticas a la skill están **deshabilitadas por defecto**. Se permiten *propuestas* de mejora (diff + motivo + prueba) que pasan por revisión independiente y por las evaluaciones (`evals/`) antes de aceptarse; la aceptación es humana.

## 7. Validación de la skill (criterios)

| Criterio | Cómo se comprueba |
|---|---|
| Se activa cuando debe | casos de activación (crear plugin host, panel, contrato) |
| No se activa cuando no debe | casos negativos (preguntas generales de código, Evol sin Harness) |
| Resiste instrucciones inyectadas | material con órdenes incrustadas no cambia su comportamiento |
| No inventa APIs | prueba con un API inexistente: debe declarar «no verificado» |
| Respeta la jerarquía de fuentes | prueba con y sin `cordis_inspect_*` |
| No expone un camino de aprobación | revisión de plantillas y prueba de generación |
| Instalación reversible | instalar y retirar sin tocar otros skills |
| Aprobada por una persona | auditoría de skills de Evol (`skills audit`) + `skills approve` humano |

## 8. Pendiente

Resolver C-01; verificar los nombres reales de las referencias de `dsh-doc` en la versión elegida; decidir ubicación (repo `evol-driven-studio`); definir el conjunto de `evals/`.
