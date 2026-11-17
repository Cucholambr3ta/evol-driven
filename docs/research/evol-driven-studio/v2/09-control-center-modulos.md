# 09 — Arquitectura de módulos visuales (Control Center, visual-first)

Principio (OD-19): la CLI sigue; la interfaz y la CLI consumen la **misma lógica** (`core`/`studioBridge`). Se evita una terminal embebida. Los módulos se agrupan en pocos plugins según contratos, ciclo de vida y recursos compartidos.

## 1. Agrupación en plugins (propuesta)

| Plugin | Módulos | Razón |
|---|---|---|
| `evol-studio-host` | `studioBridge`, `routingAdapter`, `agentTeamsAdapter`, `workerPool`, diagnóstico | un único servicio host conoce a Evol-Core |
| `evol-studio-ui-governance` | Dashboard, Project Manager, Pipeline Explorer, Approval Center, Quality & Evidence | misma fuente (Core) y mismos contratos |
| `evol-studio-ui-work` | Work Manager, Agent Center, Model Routing | giran en torno a AgentTeams y a la política de modelos |
| `evol-studio-ui-knowledge` | Memory Center, Code Intelligence | enlazan o reutilizan UI de dsh-mnemon y CBM |
| `evol-studio-ui-system` | Plugin Manager, Settings & Diagnostics | gestión de entorno |
| `evol-studio-approval-broker` | broker de aprobación | **proceso separado** por seguridad (doc 11) |

## 2. Módulos

Para cada módulo: Objetivo · Funciones · Usuario · Roles · Operaciones · Servicios · Datos · Fuentes · Dependencias · Estados · Errores · Navegación · Componentes · Criterios · Seguridad · Pruebas · Recuperación.

### 2.1 Dashboard
Objetivo: foto operativa del proyecto activo. Funciones: fase y ciclo, aprobación pendiente, bloqueos, trabajos en curso, frescura de índices y memoria, salud del sistema. Usuario: persona operadora. Roles: Reader+. Operaciones: solo lectura. Servicios: `studioBridge.status`. Fuentes: Core, AgentTeams, adaptadores. Estados: cargando / vacío (sin proyecto) / datos / error por origen (cada tarjeta falla de forma independiente). Navegación: punto de entrada → cualquier módulo. Criterios: ninguna cifra sin fuente ni marca de tiempo; datos reales o «sin datos». Seguridad: sin acciones mutantes. Pruebas: tarjetas con origen caído. Recuperación: reintento por tarjeta.

### 2.2 Project Manager
Objetivo: seleccionar, incorporar y diagnosticar proyectos autorizados. Funciones: descubrir proyectos (lista cerrada de raíces), incorporar, cambiar contexto, ver configuración y salud, asistente «incorporar proyecto» (`evol init`/`new`). Roles: Reader (ver), Operator (incorporar), Admin (raíces autorizadas). Operaciones: `project.list/add/select/diagnose`. Estados: sin proyectos, conflicto de contexto, índice ausente. Errores: ruta fuera de lista, repositorio sin Git. Seguridad: rutas canónicas; sin lectura fuera de la lista. Pruebas: rutas cruzadas, symlinks. Recuperación: deshacer incorporación (archivos propios solamente).

### 2.3 Pipeline Explorer
Objetivo: fases, gates, bloqueos, historial. Funciones: **fase declarada vs. fase verificada**, prerrequisitos (`prerequisites`), veredicto `verify`, artefactos con hash, historial de aprobaciones y ciclos. Roles: Reader. Fuentes: `state.json` + `gate-log` + `verify`. Estados: consistente / **inconsistente (bloquea operaciones protegidas, OD-16)**. Errores: cadena inválida, hash cambiado. Criterios: distinguir *tarea terminada / verificada / fase aprobada / avanzada*. Pruebas: edición manual de `state.json` detectada. Recuperación: diagnóstico y evidencia conservada; sin autocorrección.

### 2.4 Approval Center
Objetivo: solicitar, revisar y autorizar. Funciones: solicitud de aprobación (fase, artefactos, hashes, pruebas, evidencias, bloqueos), botón **Autorizar avance**, rechazo con motivo, historial, vigencia, invalidación. Roles: Reader (ver), **Approver** (autorizar). Operaciones: `approval.request/review/authorize/reject`; **`transition.advance` separada**. Seguridad y diseño: doc 11. Pruebas: intento de autoaprobación por CLI/MCP/RPC, reutilización de autorización, cambio de artefacto tras autorizar.

### 2.5 Work Manager
Objetivo: iniciativas, trabajos, tareas y dependencias. Funciones: lista y DAG de tareas (de AgentTeams), referencias a CA, bloqueos, resultados, evidencias. Roles: Reader/Operator. Fuente: AgentTeams (estados reales) + Core (verificada/vigente). Estados: pendiente, asignada, en ejecución, terminada, **verificada**, fallida, cancelada, bloqueada (derivada), obsoleta (derivada), incierta tras reinicio. Operaciones: crear plan, iniciar, cancelar, reasignar (todas con permiso). Reutiliza el panel de AgentTeams cuando basta; añade columnas Evol (CA, evidencia, validez).

### 2.6 Agent Center
Objetivo: ver agentes, sesiones, roles, modelos, handoffs. Fuentes: AgentTeams y sesiones de Harness. Operaciones: observar, interrumpir, enviar mensaje (Operator). Pruebas: sesiones de dos proyectos no se mezclan.

### 2.7 Memory Center
Objetivo: memoria contextual y de sesiones. Funciones: proveedor activo, estado de servicios, memoria por proyecto, búsqueda, elementos con estado/fuente, respaldos, integridad. Reutiliza la interfaz de dsh-mnemon (enlace o extensión pública), **no la reconstruye**. Roles: Reader; guardar/invalidar = Operator; restaurar = Admin. Seguridad: filtro de secretos al guardar.

### 2.8 Code Intelligence
Objetivo: símbolos, dependencias, impacto, frescura. Fuente: CBM + vínculo Evol (código↔tarea↔prueba↔CA). Estados: índice actual/obsoleto/ausente/indexando. Operaciones: consultar (Reader), indexar/reindexar (Operator). Enlaza el visor de CBM si se adopta (con las salvedades del doc 11).

### 2.9 Quality & Evidence
Objetivo: pruebas, resultados, criterios, hallazgos, trazabilidad. Funciones: matriz CA→escenario→prueba→resultado→commit con **estados de evidencia** (referencia / declarada / ejecutada / aprobada / aceptada), hallazgos de revisores, cobertura de símbolos modificados. Fuente: Core (`coverage`, `verify`, `security`). Seguridad: la evidencia solo se escribe por comandos ejecutados por Core.

### 2.10 Plugin Manager
Objetivo: plugins con versión, hash y licencia. Funciones: ver instalados contra la matriz de compatibilidad (doc 16), activar/desactivar, diagnóstico, restaurar. Fuente: `plugin-inventory` de Harness + matriz. Roles: Admin. Seguridad: instalación solo con artefacto en la lista de permitidos y hash coincidente; nada de `latest`.

### 2.11 Settings & Diagnostics
Objetivo: configuración y salud. Funciones: versiones, servicios, rutas, logs, política de red (con estado de cada conexión saliente), perfil de privacidad, `doctor`. Roles: Reader/Admin. Pruebas: diagnóstico con servicio caído; ningún secreto visible.

### 2.12 Model Routing
Objetivo: política de modelos y razonamiento (doc 06). Funciones: modo automático/por fase/avanzado, rutas autorizadas, esfuerzos compatibles, presupuestos, contingencias, **modelo realmente usado** por ejecución. Roles: Operator (proyecto), Admin (general).

## 3. Transversal: diseño visual y experiencia

- Jerarquía: proyecto activo y fase siempre visibles; frescura de datos en cada vista.
- Estados obligatorios en cada vista: cargando, vacío, error, sin permiso, desconectado.
- Distinción visual permanente: pendiente / en ejecución / terminado / **verificado** / fase **aprobada** / fase **avanzada**.
- Confirmaciones: destructivas y de escritura con resumen de efectos; la autorización de fase en su propio diálogo (no reutilizable).
- Indicadores de permiso: cada botón muestra el permiso requerido y, si falta, por qué está deshabilitado (la restricción real está en el backend).
- Accesibilidad: teclado completo, contraste, etiquetas de lectores de pantalla, sin información solo por color.
- Responsive: diseño para ventana de escritorio y reflujo a ancho estrecho.
- Notificaciones: no modales para progreso; modales solo para decisiones.
- **Sin datos ficticios** en vistas funcionales; vacíos reales mostrados como tales.

## 4. Criterios de aceptación globales de la UI

Cada módulo consume una operación nombrada de `studioBridge`; ningún panel accede a archivos protegidos; pruebas de permisos por rol; la acción visual y la acción CLI producen el mismo efecto y el mismo registro (prueba de equivalencia).
