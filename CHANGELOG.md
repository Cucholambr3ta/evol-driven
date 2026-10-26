# Cambios

## 0.5.0 — 2026-10-26

- chore: aprobación de retro — ciclo 2 del pipeline terminado (done)
- chore: checkpoint de retro
- retro: lecciones del ciclo 2 y Ampliación 8 (CA-150 a CA-170)
- chore: checkpoint
- fix(qa): el índice de evidencia se llama <tema>-evidence-index.md y --estricto de evidencia queda declarado y probado
- chore: checkpoint de QA
- chore: informe de QA
- fix(qa): lectura acotada y dentro de la raíz (tope total, enlaces en el camino, líneas, tablas y hallazgos), checklist según el SPEC y pruebas más estrictas
- chore(qa): quita la clave de ejemplo de lecciones.md, un texto no parecido a una clave en la prueba de rutas y ajusta la línea del ignorado de verify.ts
- chore: checkpoint
- test: CA-145 mide el retraso del aviso contra doctor sin aviso, no el tiempo total bajo carga
- chore: checkpoint al cerrar el build del ciclo 2
- docs: README con evol docs y evol sprint
- build(M4): skills granular, investigacion, reqdd y sprintdd; add con Referencias; tercera ola de enrutadores
- chore: checkpoint tras M3 del ciclo 2
- build(M3): cifras de 35 disciplinas en README y especificación; prueba de aprobación fija
- build(M3): disciplinas GRANULAR, INVESTIGACION, REQDD y SPRINTDD, ADD en el perfil base y plantillas de documentación
- build(M2d): pruebas de seguridad de los comprobadores y enlaces() lineal y acotado
- chore: checkpoint tras M2c del ciclo 2
- build(M2c): evol sprint — historias y sprints con su evidencia
- chore: checkpoint tras M2b del ciclo 2
- build(M2b): evol docs evidencia — dossiers de investigación con índice de evidencia
- test: la prueba de nombres hostiles no usa una expresión con caracteres de control
- build(M2a): evol docs check — documentos de dominio y requisitos
- chore: checkpoint tras M1 del ciclo 2
- build(M1): verificación por secciones, analizador de Markdown y lectura acotada
- build(M0): estado «pendiente» al abrir un ciclo y campo rol en el listado
- test: las pruebas de versión no dependen de la versión instalada
- plan del ciclo 2: interrogación registrada
- chore: aprobación de spec del ciclo 2 y avance a plan
- spec y plan del ciclo 2, con la revisión de seguridad incorporada
- chore: aprobación del briefing del ciclo 2 y avance a spec
- chore: checkpoint del briefing del ciclo 2
- briefing: corrige el ciclo 2 tras la revisión independiente
- fix: prettier no revisa release/, que genera evol release
- chore: abre el ciclo 2 (ampliación: documentación granular y evidencia)

Skills:

- nueva: granular
- nueva: investigacion
- nueva: reqdd
- nueva: sprintdd
- cambiada (vuelve a «sin auditar»): add
- cambiada (vuelve a «sin auditar»): analista
- cambiada (vuelve a «sin auditar»): arquitecto

## 0.4.0 — 2026-10-26

- chore: aprobación de retro — ciclo del pipeline terminado (done)
- retro: lecciones y Ampliación 7 (criterios CA-128 a CA-149)
- chore: aprobación de qa (con evol-dev) y avance a retro
- chore: aprobación de build y avance a qa
- perf: paraleliza MemPalace y el sondeo de seguridad en doctor (CA-145)
- fix: evita que las pruebas del marcador [[COMPLETAR]] se autobloqueen
- chore: ignora los hallazgos CRITICAL/HIGH de qa, decididos por la persona
- chore: checkpoint y resultados de qa (security scan, coverage)
- docs: reserva CA-145 (presupuesto de 3 s de doctor es ajustado) y m-003
- build(M10): instrucciones según el repositorio (CA-148)
- build(M9): «evol ciclo nuevo» para seguir en un segundo ciclo (CA-146, CA-147)
- build(M8): acorta a 1,5 s el presupuesto de red del aviso de versión
- build(M8): aviso de versión nueva en doctor (CA-145)
- build(M7): SBOM y sumas firmadas en cada versión (CA-142, CA-143, CA-144)
- build(M6): identidad «Evol» en Claude Code (CA-140, CA-141)
- build(M5): agente «evol» en OpenCode (CA-137, CA-138, CA-139)
- build(M4): aislar el proyecto y diagnosticar la convivencia (CA-135, CA-136, CA-149)
- build(M3): lista de bloqueo de rutas sensibles (CA-134)
- build(M2): copia antes de escribir, ensayo y vuelta atrás (CA-132, CA-133)
- spec: confirma el Paso 0 en Claude Code; OpenCode queda con un matiz hasta M5
- docs: ensayo del Paso 0 en Claude Code (deny de proyecto se aplica; bypassPermissions global queda pendiente)
- chore: checkpoint tras M1
- build(M1): proyectos que no son TypeScript (CA-128 a CA-131)
- plan: orden de construcción de la ola 1, interrogado dos veces
- chore: aprobación de spec y avance a plan
- spec: corrige los hallazgos de la revisión de seguridad en THREATS.md
- spec: especificación, dominio y amenazas de la ola 1 (CA-128 a CA-148)
- briefing: ancla el umbral de CA-136 a las 9 rutas bloqueadas de CA-134
- briefing: corrige los hallazgos del verificador en las pruebas de aceptación
- briefing: features, escenarios y pruebas de aceptación de la ola 1 (CA-128 a CA-148)
- chore: nota de aislamiento en CLAUDE.md y excepciones del escáner de seguridad
- chore: evol se desarrolla con evol
- fix: la segunda lectura da la línea real de la cita y avisa si la frase está junto a una prohibición

## 0.3.2 — 2026-10-25

- fix: el CI deja de romperse por la versión en la documentación y por dos herramientas inestables
- docs: comparación de evol con gentle-ai y mejoras propuestas
- fix: la skill constructor ya no rompe evol skills list; evol update nombra lo que hay que aprobar
- docs: la lista de Claude Code cubre el arranque del proyecto además de la auditoría
- docs: preguntas para OpenCode y Claude Code en las pruebas reales de evol

## 0.3.1 — 2026-10-25

- feat: evol checkpoint y evol handoff para retomar el trabajo con otro agente
- fix: el CHANGELOG que genera evol release cumple el formato del proyecto; body-parser a 2.4.0

Skills:

- cambiada (vuelve a «sin auditar»): evol

## 0.3.0 — 2026-10-25

- fix: el fallo de semgrep sin archivo nombrado dice su tipo, su código y su salida de error
- feat: instalación estable separada del origen y paso de firmantes en evol setup
- fix: --help en todos los comandos, errores de opciones legibles y reintento del motor de semgrep
- feat: activar la consulta de documentación al crear un proyecto y notas de la especificación al día
- test: diagnóstico del fallo intermitente de semgrep y tipo de error en el escaneo de seguridad
- feat: evol security scan con contenedores, licencias, api y tls
- feat: soporte de DocBook y SGML en el conocimiento (PostgreSQL 18, manual de Plasma)
- feat: evol knowledge ingest, search y status; consulta de documentación por MCP, doctor e informe
- docs: fuentes de conocimiento de la primera ola capturadas y revisadas
- docs: descartar RAGFlow; docs-mcp-server es el único proveedor de conocimiento
- docs: ampliación 6 de la especificación (versiones, actualización y buzón de mejoras)
- feat: versiones, actualización, release y mejoras (evol version, update, release, mejora)
- feat: skills de herramientas, proceso, documentación y dominio (S4, tercera ola)
- feat: instalación del framework (install.sh y evol setup)
- fix: imagen Docker completa y evol skills uninstall
- feat: skills de las 22 disciplinas extendidas (S4, segunda ola)
- chore: aprobar las 23 skills y quitar la ruta de la clave de los evals
- feat: /evol en carpeta vacía e incorporar skills en un paso
- feat: instalar skills aprobadas en los IDE por enlace simbólico (S5)
- test: pruebas de portabilidad entre IDE (O5)
- feat: adaptadores para Codex, Antigravity, OpenCode y Hermes (O2)
- feat: PASS/WARN/BLOCK y marca de plan interrogado (O4)
- feat: los seis roles (O3): skills, reparto de las 31 disciplinas y envoltorios de subagente de solo lectura
- feat: contrato del orquestador (O1): skill evol como fuente única de /evol y consultas de solo lectura
- feat: skills de razonamiento (afinar-idea, interrogar-plan, verificar-afirmaciones) y sus evaluaciones (S4)
- feat: skills de las seis disciplinas base que faltaban (sdd, fdd, ddd, bdd, atdd, tdd) y sus evaluaciones (S4)
- feat: segundo lector de la auditoría (Claude Code), prueba de aislamiento y resultados del piloto del conocimiento
- feat: segunda pasada de la auditoría con un lector, autoprueba y `evol skills approve` (S3, primera parte)
- feat: la pasada 1 de la auditoría de skills usa shellcheck, bandit, osv-scanner y guarddog (T1)
- docs: tabla de dependencias al día con el motor de conocimiento, Ollama y los modelos
- feat: aceptación de documentos por una persona, captura de subcarpetas y preguntas del piloto R0
- feat: registro de fuentes de documentación y revisión previa (evol knowledge)
- feat: skills secdd, stdd y threat y evaluaciones de las siete skills de seguridad (T4c)
- feat: SecDD ejecuta el escaneo de seguridad y doctor informa de las herramientas (T4b)
- feat: evol security scan (T4a) con secretos, código y dependencias
- fix: incorporar-dependencia usa guarddog scan para paquetes por nombre
- feat: gitleaks verificado con el binario real, herramientas instaladas y cuatro skills de seguridad
- fix: la auditoría usa semgrep con reglas locales, sin red y sin huecos de cobertura
- docs: investigación de BlackArch y RAGFlow, y ampliación 5 de la especificación
- feat: auditor determinista evol skills audit (hito S2)
- feat: biblioteca de skills y evol skills list, check y export (hito S1)
- docs: auditoría reforzada con subproceso aislado, scripts de terceros y agentes propios decididos
- docs: roles como skills con envoltorio de subagente y clasificación de las skills del sistema anterior
- docs: respuestas de los IDE y matriz de compatibilidad confirmada
- docs: orquestador /evol y compatibilidad con cualquier IDE (ampliación 4)
- docs: constelaciones, skills sin herencia del sistema anterior y plan del agente auditor
- docs: las skills solo entran por un agente auditor y la pantalla muestra los agentes
- docs: pantalla de Skills en los mockups y su especificación
- docs: centra el grafo de memoria en los mockups
- docs: pantalla de documentación por proyecto en los mockups
- feat: evol report en DOCX, PDF y Markdown (hito 5 de la ampliación 2)
- feat: generador de los 14 diagramas UML y evol diagrams (hito 4 de la ampliación 2)
- feat: evol lessons check (hito 3 de la ampliación 2)
- feat: perfiles y evol disciplines (hito 2 de la ampliación 2)
- feat: evol export, risk y coverage (hito 1 de la ampliación 2)
- docs: borrador de la ampliación 2 (informe, UML y mejoras)
- docs: mockups de la interfaz
- docs: README y especificación de la adopción y la capa para agentes; versión 0.2.0
- test: pruebas de init, archivos para agentes, hook y MCP (criterios 19 a 24)
- feat(cli): registra init, agents, hook y mcp; evol new y doctor usan la capa de agentes
- feat(agents): comandos /evol-*, hook de inicio, bloque de CLAUDE.md, .mcp.json y servidor MCP de solo lectura
- feat(init): evol init para adoptar proyectos existentes sin tocar sus archivos
- feat(core): rutas y comandos por módulo, fases adoptadas e informe de estado
- build: Dockerfile, CI, README y dependencias
- test: pruebas de los 18 criterios de aceptación
- feat(cli): comandos de evol y plantilla del proyecto generado
- feat(codeintel): indexador nativo, interfaz CodeIntelProvider y proveedor opcional de GitNexus
- feat(memory): integración con MemPalace por MCP
- feat(core): pipeline de seis fases, gate firmado y registro de las 31 disciplinas
- docs: especificación v1 y configuración del proyecto

Skills:

- nueva: a11ydd
- nueva: add
- nueva: afinar-idea
- nueva: analista
- nueva: apivdd
- nueva: arqueologia-codigo
- nueva: arquitecto
- nueva: atdd
- nueva: bdd
- nueva: ccdd
- nueva: cdcdd
- nueva: chaos
- nueva: compliance
- nueva: construir-mcp
- nueva: costes-proyecto
- nueva: ddd
- nueva: debtbudgetdd
- nueva: deprecationdd
- nueva: descubrir-necesidades
- nueva: diseno-frontend
- nueva: documentacion
- nueva: dominio-finanzas
- nueva: dominio-marketing
- nueva: dominio-ventas
- nueva: eda
- nueva: effectcraft
- nueva: esdd
- nueva: evaluar-skill
- nueva: evol
- nueva: fdd
- nueva: filmcraft
- nueva: incorporar-dependencia
- nueva: incorporar-skill
- nueva: interrogar-plan
- nueva: iodd
- nueva: mdd
- nueva: odd-api
- nueva: odd-obs
- nueva: operaciones
- nueva: pdd
- nueva: pipeline
- nueva: privacydd
- nueva: rdd
- nueva: readme
- nueva: respuestas-compactas
- nueva: revisar-secretos
- nueva: sdd
- nueva: secdd
- nueva: seguridad
- nueva: seo-tecnico
- nueva: sin-sobreingenieria
- nueva: slo
- nueva: stdd
- nueva: tdd
- nueva: threat
- nueva: udd
- nueva: uxdd
- nueva: verificador
- nueva: verificar-afirmaciones
- cambiada (vuelve a «sin auditar»): constructor
