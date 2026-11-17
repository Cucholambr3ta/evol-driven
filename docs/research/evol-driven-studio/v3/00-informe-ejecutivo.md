# 00 — Informe ejecutivo v3: Evol-Driven Studio — Arquitectura v3 corregida

Ejecución EVOL-STUDIO-DOC-CORRECTION-003 · 2026-11-17 · rama `feat/evol-driven-studio` · HEAD `47a93c8` (sin cambios desde v2) · **solo documental: sin commits, sin implementación, sin modificar código, `.evol/`, memoria ni perfiles.** La entrega v2 se conserva intacta en `../v2/`; esta v3 la corrige y la completa.

## Qué cambió de v2 a v3

| Hallazgo | Resultado | Cambio principal |
|---|---|---|
| H-01 Rollback inseguro | **PASS** (documental) | Se elimina «volver a `evol approve` por terminal». Política de **fallo cerrado**: si el broker falla, lo protegido queda bloqueado; procedimiento de recuperación de 9 pasos; sin bypass genérico |
| H-02 Permisos CLI→UI | **PASS** (documental) | Clasificación por **efectos reales**; `verify` (fin) ejecuta comandos de shell de la configuración → Operator; `doctor`, `lessons`, `impact/trace` ya no son Reader; tabla única de permisos para CLI, MCP y UI |
| H-03 `dsh-doc` | **PASS** (documental) | C-01 deja de ser bloqueo general: la skill propia usa una **jerarquía de fuentes** y no depende de una sola referencia; prerequisitos separados en tres niveles |
| H-04 Conciliación normativa | **FAIL parcial** | Matriz de 24 filas; 4 contradicciones abiertas con corrección definida; `ESPECIFICACION.md` sin leer íntegra → D-07 **parcialmente cerrada** |
| H-05 UX de autorización | **PASS** (documental) | Flujo unificado «Autorizar avance»; aprobación y transición separadas internamente y en el registro |
| H-06 `dsh-evidence` | **PASS** (documental) | El proyecto **existe**; queda como plugin opcional candidato, no baseline; EV-041 se conserva y se añade EV-047 |

**Corrección adicional propia:** la investigación v1 (EV-006) decía que el estado no se concilia con el registro; `evol doctor` sí lo hace (CA-134), pero `verify`, `approve` y `next` no lo exigen (EV-045).

## Hechos nuevos que condicionan el diseño

- `evol verify` en modo «fin», `evol handoff` y la herramienta MCP `evol_verify` **ejecutan los comandos definidos en `evol.config.json`** con un shell (EV-048). El MCP no es «de solo lectura» como dicen su ayuda y el criterio 22 de la especificación (EV-051).
- La protección actual de la aprobación es **declarativa por IDE** (`permissions.deny`, terminal interactiva); la clave del gate la puede leer un agente con permiso amplio (T-1) y las amenazas lo aceptan como riesgo (EV-052). El broker debe ir más allá, no heredar esa garantía.
- La normativa vigente (Ola 1 y Ciclo 2) no cubre Studio y **no existe `docs/adr/`** (EV-050). El borrador `evol ui` (Ampliación 3) solapa con el Control Center y queda absorbido (EV-053).
- La spec dice que Evol tiene **un solo agente propio** (`/evol`) y que añadir uno exige decisión y entrada explícita (EV-054): hace falta enmendarla al ratificar OD-20/25.

## Invariantes que se conservan (sin regresión)

Evol-Driven como autoridad del pipeline y de las aprobaciones; Harness como plataforma; AgentTeams como coordinador (sin segundo scheduler ni segunda base de tareas); plugins comunitarios primero; dos máquinas de estados; Control Center visual-first con la misma lógica que la CLI; subagentes y workers bajo demanda; Model Routing opcional; memoria local; skill fundacional previa al primer plugin propio; dos tandas; Plugin Edition antes que Desktop.

## Dictamen

| Categoría | Veredicto |
|---|---|
| **DOCUMENTACIÓN CONSISTENTE** | **No se otorga todavía** (D-07 parcialmente cerrada) |
| **DOCUMENTACIÓN CON PENDIENTES** | **Sí**: 5 de 6 hallazgos corregidos; H-04 parcial; N-01, N-06, N-07 y N-10 abiertas con corrección definida |
| **IMPLEMENTACIÓN NO VALIDADA** | **Sí, sin excepciones**: ninguna prueba, compatibilidad ni benchmark se ejecutó |
| **BLOQUEO REAL DE INTEGRACIÓN** | **Sí, acotado**: ratificación de OD-09/OD-03 y prueba de AgentTeams (Tanda 1); cierre de H0 y decisión del factor de presencia humana (Tanda 2); combinaciones probadas y P-01…P-17 (publicación). **Ya no hay bloqueo general por `dsh-doc`.** |

**No se emite PASS de implementación.**

## Decisiones que necesita el propietario

1. Ratificar o ajustar OD-09 (versión candidata) y OD-03 (memoria de instalaciones nuevas).
2. Elegir el factor de presencia humana del broker y la sub-decisión de firma (asimétrica o verificación solo vía broker).
3. Autorizar las enmiendas de normativa (doc 19 §5) en el ciclo que corresponda.
4. Decidir si se completa la lectura íntegra de `ESPECIFICACION.md` para cerrar D-07.
5. Autorizar el commit de esta documentación (OD-13) y el inicio de la Tanda 1.

## Índice v3

`evidence-v3.md` · `01-auditoria-de-consistencia` · `02-registro-de-decisiones` · `03-arquitectura-objetivo` · `04-flujo-multiagente-del-pipeline` · `05-matriz-de-subagentes` · `06-model-routing` · `07-contratos-agentteams` · `08-contratos-de-memoria-y-workers` · `09-control-center-modulos` · `10-inventario-cli-ui` · `11-modelo-de-seguridad-approval-broker` · `12-skill-evol-studio-plugin-development` · `13-plan-tanda-1` · `14-plan-tanda-2` · `15-roadmap` · `16-matriz-de-compatibilidad` · `17-deuda-y-pendientes` · `18-archivos-modificados` · **`19-matriz-de-conciliacion-normativa` (nuevo)** · **`20-informe-de-resolucion-de-hallazgos` (nuevo)**.

## Límites

Análisis estático de código y documentación; sin ejecución de comandos de Evol ni de componentes de terceros (un intento de recorrer `--help` fue denegado y no se reintentó); los clones de terceros se hicieron en un directorio temporal aislado; `ESPECIFICACION.md` no se leyó íntegra; puntuaciones y clasificaciones *provisional* son juicios o análisis estático. El hook de MemPalace auto-mina la sesión: **no fue estrictamente de solo lectura**; Engram no se escribió.
