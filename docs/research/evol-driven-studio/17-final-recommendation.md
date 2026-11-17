# 17 — Recomendación final

Es una recomendación para revisión, no una decisión aprobada. Se basa en lectura de código y documentos; **no hay resultados de benchmarks ni de pruebas de integración** (doc 11).

## Respuestas a las 16 preguntas del encargo (§19)

1. **¿Conviene convertir Evol-Driven en Evol-Driven Studio?** Sí, **condicionado**: el valor (una consola visual sobre un runtime con sesiones, sandbox y equipos) es real, pero se apoya en un host pre-release sin auditoría (EV-015). Recomendable si se mantiene el núcleo independiente y se avanza por tajadas verticales con versión fijada.
2. **¿Independiente de Harness?** Sí. Evol conserva pipeline, aprobaciones y evidencias; Harness aporta host, UI y ejecución (ADR-001).
3. **¿Cuánto código se reutiliza?** No hay una medición por líneas. Se conservan (KEEP) pipeline, gate, verificación, disciplinas, skills y CLI; se adaptan (ADAPT) MCP, grafo y checkpoint; no se reescribe nada. Estimación cualitativa: la gran mayoría del núcleo (INFERRED).
4. **¿Qué se renueva?** Contratos de lectura, estado↔log, lock, anotaciones MCP, versión del verificador, estados de evidencia, memoria con estado (doc 10).
5. **¿Qué se delega a plugins de DSH?** Interfaz (slots), ejecución y coordinación de agentes (`team`/AgentTeams), UI de memoria (dsh-mnemon, si se elige), gestión de plugins y sandbox.
6. **Memoria conversacional:** **sin decisión final**; candidatos Mnemon Native + dsh-mnemon y Engram, con MemPalace gobernado como línea base. Se decide con el benchmark (ADR-004).
7. **Memoria de código:** **motor nativo** (gobernanza: `TESTS`, `MODIFIES`, frescura) **+ CBM como adaptador de navegación**, condicionado a sus condiciones de entrada de seguridad y a medición (ADR-005).
8. **Ambas en local:** datos, índices, embeddings y recuperación locales; sin red por defecto; privacidad de memoria garantizada, privacidad de inferencia solo con un proveedor de modelos local (doc 04).
9. **Contexto compartido entre agentes:** lectura compartida por proyecto y escritura mediante herramienta de Evol con fuente y estado; sin acceso cruzado entre proyectos.
10. **AgentTeams:** ejecuta y coordina; Evol gobierna requisitos, verificaciones y aprobaciones, con puente de evidencia y gate de cierre (ADR-003).
11. **Control Center:** plugin host `evolBridge` + paneles de cliente en slots; módulo por módulo (doc 06); primero Pipeline Explorer.
12. **Contratos a añadir:** `Project`, `Pipeline`, `Approval`, `Evidence`, `MemoryItem`, `Symbol` con `frescura`; `MemoryProvider` y `CodeIntelProvider` ya existente; API TypeScript `core` (docs 06 y 10).
13. **Distribución:** Plugin Edition primero (perfil + bundle); Desktop para macOS/Windows más adelante; **Desktop Linux sin soporte en Harness hoy**, requiere ADR propio (doc 08).
14. **Bloqueos técnicos o de seguridad:** R-01, R-02, R-03, R-05, R-06, R-13, R-20 (doc 14).
15. **Camino de menor riesgo:** CLI `--json` → paquete `core` → MCP; sin HTTP; plugin de solo lectura primero; cada paso reversible (doc 10).
16. **Primera implementación vertical:** Pipeline Explorer de solo lectura (Hito 3), mostrando fase declarada vs. verificada y la validez de la cadena de aprobaciones, precedida de las correcciones de lectura segura del Hito 1.

## Qué NO se recomienda

Reconstruir Evol como plugins Cordis (arquitectura B), crear un fork de Harness, construir un tablero de tareas propio, exponer un servicio HTTP, adoptar CBM mediante su instalador por defecto, copiar transcripciones a la memoria nueva o prometer Desktop Linux.

## Condiciones para empezar a implementar

(1) revisión y aprobación de este informe; (2) autorización del entorno aislado y ejecución del Hito 0; (3) decisión OD-01, OD-02, OD-09 y OD-12; (4) fijar la versión de Harness.
