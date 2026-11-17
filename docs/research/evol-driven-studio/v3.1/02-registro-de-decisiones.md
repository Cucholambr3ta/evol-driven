# 02 — Registro consolidado de decisiones OD-01 a OD-27 (v3.1)

**Reglas de estado.** *CONFIRMADA* = expresada por el propietario (OD-04, 19, 20, 21, 24, 25 en EVOL-STUDIO-ARCH-UPDATE-002; **OD-26 y OD-27 en la directiva v3.1**). *RATIFICADA* = baseline propuesta que el propietario ratificó en la directiva v3.1 (**OD-03 y OD-09**). *BASELINE PROPUESTA* / *BASELINE OPERATIVA PROPUESTA* = recomendación técnica sin ratificación (OD-01, 02, 05, 06, 07, 08, 22, 23). *PROPUESTA* = lineamiento enunciado sin marca de ratificación (OD-10 a OD-18). **Ninguna decisión está aprobada más allá de lo marcado**, y **ninguna autoriza implementar**: las ratificaciones fijan la baseline de la Tanda 1 y la arquitectura objetivo, no su construcción.

**Cambios v3.1 (directiva de cierre):** (1) **OD-09 y OD-03 ratificadas** con condiciones; (2) **OD-04 concretada**: WebAuthn con verificación de usuario + Ed25519 en un broker protegido (la sub-decisión de firma queda resuelta; el factor de presencia queda elegido; el mecanismo queda *pendiente de validación*, doc 11); (3) **nuevas OD-26 (Approval Checklist) y OD-27 (Repository Explorer)**; (4) notas en OD-17, 18, 19, 20 y 25 sobre enmiendas y sistema visual. Las confirmadas anteriores conservan su contenido.

**Cambios v3 (EVOL-STUDIO-DOC-CORRECTION-003):** se corrigieron OD-04, 09, 11, 16, 17, 18, 19, 21, 22, 24 y 25 sin crear decisiones nuevas.

**Equivalencia con el registro anterior** (`../16-open-decisions.md`): OD-01…03, 05, 07, 08, 09, 10, 11, 12 mantienen tema; el anterior OD-04 (firma, «solo TTY») queda **sustituido** por el OD-04 actual; el anterior OD-06 (Desktop Linux) se absorbe en OD-06; OD-13 y OD-14 anteriores equivalen a OD-13 y OD-14 actuales. La numeración normativa es la de este documento.

---

## OD-01 — Arquitectura base · BASELINE PROPUESTA
- **Resolución:** A → C. Adaptador independiente primero; distribución compuesta de Harness después. Evol-Driven no se reconstruye como plugins Cordis; el plugin usa interfaces versionadas hacia el núcleo.
- **Justificación:** matriz anterior (A 77,6; C 75,0; B 45,0; cualitativa) y SAFETY de Harness (EV-015).
- **Dependencias:** OD-15, OD-16. **Riesgos:** acoplarse a una API pre-stable. **Evidencia:** EV-015, doc 12 anterior. **Verificación pendiente:** prototipo H1 (carga/descarga limpia, aislamiento del log).

## OD-02 — Repositorios · BASELINE PROPUESTA
- **Resolución:** conservar `evol-driven`; crear después `evol-driven-studio` (integraciones, módulos visuales, skills propias, configuración, distribución). Sin copiar el núcleo.
- **Justificación:** el núcleo no debe depender de un host pre-release. **Dependencias:** OD-08. **Riesgos:** deriva de contratos entre repos → mitigar con paquete `core` versionado. **Evidencia:** doc 08 anterior. **Pendiente:** fijar el mecanismo de dependencia (paquete npm privado, `file:`, submódulo).

## OD-03 — Memoria contextual · RATIFICADA (v3.1)
- **Resolución:** `dsh-mnemon` + Mnemon Native para **nuevas** instalaciones; MemPalace y Engram quedan como alternativas o fuentes históricas; sin migraciones ni capturas duplicadas en esta fase.
- **Justificación:** reutilizar plugin DSH y motor local (EV-023, 025). **Dependencias:** OD-10, OD-13. **Riesgos:** el LLM decide qué recordar; ≈ sin API verificada fuera de DSH (doc 03). **Evidencia:** EV-023…025. **Pendiente (v3.1):** el benchmark (doc 25) ya no es condición de ratificación —que se otorgó— sino de **aceptación de la integración** en la Tanda 1 (C-05).
- **v3.1 — ratificación (directiva §2):** `dsh-mnemon` + Mnemon Native es el **sistema de memoria contextual predeterminado para instalaciones nuevas de Evol-Driven Studio**. **Condiciones:** almacenamiento, indexación y recuperación **locales**; funcionamiento **sin conexión verificable**; **aislamiento por proyecto**; **procedencia** de los recuerdos; **captura automática controlada**; **autoevolución de skills desactivada** inicialmente; **ninguna dependencia cloud obligatoria**; **sin migración destructiva** de MemPalace ni Engram. Codebase Memory y deja-vu conservan **responsabilidades distintas**; no se activan varios proveedores de escritura automática sobre las mismas sesiones sin una política explícita; el proveedor de memoria **no sustituye** la autoridad de Evol-Driven sobre requisitos, verificaciones, aprobaciones y fases. Alcance normativo: AMD-04 (`MemoryProvider`; MemPalace sigue vigente para este repositorio y los proyectos existentes; `CLAUDE.md` no cambia). Las condiciones se comprueban en la integración (doc 25); **ratificar no certifica compatibilidad**.
- **v3:** `dsh-evidence` (repo `Cooberped/dsh-evidence`, paquete `@baseland/dsh-evidence@beta`, EV-047) existe y queda como **plugin documental opcional candidato**, no como dependencia ni parte de la baseline; sin adopción automática de paquetes beta. Política contra duplicación: dsh-mnemon (*Project Documents*), `evol knowledge` y `dsh-evidence` **no** escriben automáticamente sobre la misma información sin política explícita.

## OD-04 — Autorización humana desde Control Center · CONFIRMADA (arquitectura objetivo concretada en v3.1)
- **Resolución:** botón «Autorizar avance» con revisión de fase, artefactos, hashes, pruebas, evidencias, bloqueos, solicitud e historial; **aprobación y transición de fase separadas**; autenticación humana real y backend protegido; los agentes no pueden invocar el equivalente por CLI, MCP, RPC ni herramientas; **Approval Broker** mínimo. Un botón, un TTY o una sesión web **no bastan** como prueba de presencia humana.
- **Justificación:** requisito del propietario; sustituye la propuesta anterior «solo TTY» (C-07). **Dependencias:** OD-11, OD-16. **Riesgos:** suplantación, reutilización de autorización, procesos del mismo usuario. **Evidencia:** EV-005/006 (gate actual). **v3:** flujo visual unificado «Autorizar avance» que encadena aprobación y transición **sin fusionar sus registros** (H-05); **fallo cerrado**: si el broker falla, las operaciones protegidas quedan bloqueadas y no existe rollback por `evol approve`/TTY ni bypass genérico (H-01); TTY nunca sustituto automático de la autenticación protegida; sub-decisión abierta: firma asimétrica o verificación solo vía broker (el HMAC actual permite falsificar a quien verifica). **Pendiente:** diseño del broker (doc 11) y pruebas P-03…P-09, P-15…P-17.
- **v3.1 — arquitectura objetivo (directiva §3):** **WebAuthn/passkey con verificación de usuario obligatoria + firma asimétrica Ed25519 mediante un broker protegido.** Requisitos 1–10 de la directiva trazados en doc 11 §0: autenticación vinculada a la operación (el desafío es el digest de la solicitud canónica con proyecto, fase, operación, revisión y evidencia); comprobación de desafío, origen, autenticador, identidad, permisos y vigencia; desafíos de un solo uso con expiración; clave privada fuera del alcance de los agentes; **verificación solo con clave pública**; aislamiento efectivo de procesos y credenciales; CLI, MCP, Cordis y demás interfaces no se saltan la autorización; **fallo cerrado**; amenazas con agentes que ejecutan herramientas locales y automatizan el navegador (BA-01…BA-18). **La sub-decisión de firma queda resuelta** (asimétrica). Evidencia WebAuthn y vínculo con la firma: doc 11 §4; recuperación y rotación de claves: doc 11 §6. **No se considera suficiente** una confirmación visual, un TTY ni un HMAC compartido. **Si el aislamiento requerido no puede implementarse con garantías suficientes en el entorno seleccionado, el mecanismo queda *pendiente de validación* y las aprobaciones protegidas permanecen bloqueadas.** No se implementa el broker en esta etapa. Enmienda: AMD-03.

## OD-05 — Code Intelligence · BASELINE PROPUESTA
- **Resolución:** híbrido en transición. Codebase Memory MCP para símbolos, búsqueda, grafos, dependencias, navegación e impacto; Evol conserva lo que relaciona código, tareas, pruebas y CA; sin indexación redundante permanente; sin sustituir el motor anterior sin pruebas comparativas.
- **Dependencias:** OD-10, OD-23. **Riesgos:** instalador que modifica configuración de agentes, daemon compartido (EV-027). **Evidencia:** EV-026…029. **Pendiente:** condiciones de entrada (0 red saliente, 0 cambios en config de agentes, aislamiento) y reproducir cifras (C-11).

## OD-06 — Orden de distribución · BASELINE PROPUESTA
- **Resolución:** Plugin Edition primero (DSH Web local en Arch Linux, instalación reproducible); Desktop después con la misma integración; sin fork Desktop sin justificar.
- **Evidencia:** EV-018 (Desktop de Harness sin objetivo Linux). **Pendiente:** decisión del formato Linux cuando llegue H10.

## OD-07 — Coordinación de agentes · BASELINE PROPUESTA
- **Resolución:** AgentTeams coordina tareas, miembros, dependencias y resultados; Evol conserva pipeline y gobernanza; contingencia: equipos nativos de Harness; sin segundo scheduler general.
- **Riesgos:** AgentTeams usa costuras privadas de subagentes y no lista 0.2.2-rc.3 (EV-036). **Pendiente:** carga real en la versión fijada.

## OD-08 — Licencias · BASELINE PROPUESTA
- **Resolución:** código propio privado en desarrollo; decidir licencia pública/comercial antes de publicar; auditar licencias de dependencias, ejecutables, modelos y recursos. **No asumir MIT para todo:** Mnemon es Apache-2.0; Serena (no usada) es GPL en la aplicación; deja-vu MIT; CBM MIT; AgentTeams MIT; dsh-mnemon MIT. **Pendiente:** inventario de licencias transitivas (no hecho).

## OD-09 — Baseline de Harness · RATIFICADA como baseline inicial de la Tanda 1 (v3.1)
- **Resolución:** DSH `0.2.1-rc.2` + AgentTeams `0.1.30` (**ratificadas v3.1** como baseline inicial); versiones exactas fijadas; sin `latest`; revisar matrices oficiales antes de Tanda 1; comprobar selección de modelos, perfiles y razonamiento.
- **Evidencia:** AgentTeams recomienda 0.2.1-rc.2 (EV-036); **0.2.1-rc.2 carece de la skill `dsh-doc` de runtime (EV-035)**; la regla de razonamiento explícito es posterior (EV-039).
- **v3 (H-03):** se mantenía 0.2.1-rc.2 + AgentTeams 0.1.30 como candidata inicial (desde v3.1, **baseline ratificada**, no certificada); la falta de `dsh-doc` de runtime **no** la descarta ni bloquea la Tanda 1 (C-01 reclasificada a «dependencia cubierta por la skill propia», doc 12 §2). Antes de la Tanda 1 se revisan las matrices oficiales; se fijan versiones **exactas** de cada plugin (sin `latest`); se comprueba el comportamiento de selección de modelos, perfiles y razonamiento (EV-039). **Pendiente:** pruebas de compatibilidad de la Tanda 1 (la ratificación ya se otorgó).

- **v3.1 — ratificación (directiva §1):** **DeepSeek Harness `0.2.1-rc.2` y AgentTeams `0.1.30`** son la baseline inicial de la Tanda 1. Las versiones **se fijan expresamente y se registran en un manifiesto reproducible** (doc 27). **No certifica compatibilidad con todos los plugins:** durante la Tanda 1 se comprueba la compatibilidad real de AgentTeams, dsh-mnemon, Codebase Memory, deja-vu y las demás dependencias previstas. **No se actualiza DSH automáticamente.** Si las pruebas muestran una incompatibilidad bloqueante, se elabora una **propuesta de cambio documentada** antes de modificar la baseline (procedimiento en doc 27 §5).

## OD-10 — Privacidad y red · PROPUESTA
- **Resolución:** memorias locales; funcionamiento sin conexión; desactivar telemetría opcional, sync cloud y descargas silenciosas; la inferencia remota solo por configuración explícita y **nunca** presentada como privacidad offline integral.
- **Evidencia:** conexiones salientes conocidas: Engram (comprobación de versión), dsh-mnemon (registro npm), deja-vu (embeddings y actualización), Harness Desktop (analítica) — EV-021, 024, 025, 031, 040. **Pendiente:** captura de red por componente.

## OD-11 — Permisos · PROPUESTA
- **Resolución:** Reader, Operator, Reviewer, Approver, Administrator, aplicados en el backend; un rol visual no es control de seguridad. **Evidencia:** no existen hoy (doc 09 anterior). **Pendiente:** mecanismo real (doc 11 §4).
- **v3 (H-02):** los permisos se asignan por **efectos reales** (doc 10): `verify` en modo «fin» ejecuta comandos de la configuración y es Operator; `doctor`, `lessons`, `memory search` e `impact/trace` (hasta H0) no son Reader; Reader solo para lectura pura con evidencia estática y prueba dinámica pendiente (P-12). Una sola tabla de permisos en `core` para CLI, MCP y UI (P-14). Las operaciones no verificadas permanecen restringidas a Operator.

## OD-12 — Trazabilidad Git · PROPUESTA
- **Resolución:** trailer `CA:` en commits propios aplicables; excepciones para merges y automatizaciones definidas explícitamente; sin reescribir historia. Excepciones propuestas: merges sin contenido propio llevan `CA: -`; commits de herramientas llevan `CA: -` más `Automation:`; commits previos a la adopción no se modifican. **Pendiente:** hook y política exacta.

## OD-13 — Gestión documental · PROPUESTA
- **Resolución:** versionar investigación, specs, planes, ADR, evidencias y decisiones; preservar historia; no alterar informes previos (C-01…14 aplican esta regla). **Pendiente:** commit autorizado por una persona.

## OD-14 — Memoria de código previa · PROPUESTA
- **Resolución:** integrar el plan anterior (`docs/code-memory-research/`) en el roadmap de Studio (H0/H4); una sola implementación. **Pendiente:** confirmar qué parte de las brechas EV-003…008 va a H0.

## OD-15 — Contratos de integración · PROPUESTA
- **Resolución:** contratos JSON versionados y adaptadores mínimos; separar lectura y escritura; API TypeScript si aporta ventajas; sin servicio HTTP adicional sin necesidad demostrada. **Evidencia:** doc 10 anterior (CLI `--json` → `core` → MCP).

## OD-16 — Autoridad del estado · PROPUESTA
- **Resolución:** el estado se concilia con los registros confiables; ante inconsistencia: bloquear operaciones protegidas, mostrar diagnóstico, conservar evidencia, no avanzar. **Evidencia:** EV-006 (hoy no ocurre). **Pendiente:** diseño de la verificación y prueba aislada.
- **v3:** EV-045 corrige la imprecisión previa: `evol doctor` ya detecta la discrepancia (CA-134), pero `verify`, `approve` y `next` no la bloquean; la spec dice «doctor y verify» (contradicción spec/código). OD-16 exige que **las operaciones protegidas** se bloqueen ante inconsistencia.

## OD-17 — Arquitectura visual modular · PROPUESTA
- **Resolución:** host y cliente separados con extensiones públicas de Harness; los paneles nunca leen bases de terceros ni archivos protegidos; las operaciones pasan por servicios autorizados. **Evidencia:** EV-017.
- **v3:** el borrador de `evol ui` (Ampliación 3 de `ESPECIFICACION.md`, solo mockups, EV-053) queda **absorbido** por el Control Center; sus mockups y su diseño de seguridad (token por sesión, comprobación de origen) se reutilizan como insumo, no como compromiso.

- **v3.1:** el sistema visual queda fijado como documento normativo de diseño **`EVOL-STUDIO-UI-UX-SYSTEM`** (doc 23); `evol ui` se absorbe (AMD-05); la lista es el modo principal de localizar documentos y el grafo es complementario.

## OD-18 — Distribución de plugins comunitarios · PROPUESTA
- **Resolución:** versiones, dependencias y hashes fijados; licencias registradas; compatibilidad verificada; desactivación y recuperación; sin sobrescribir perfiles. **Pendiente:** formato del manifiesto de bloqueo (doc 16).
- **v3:** además de AgentTeams, dsh-mnemon, CBM y deja-vu, se registran como candidatos **opcionales** `@baseland/dsh-evidence@beta` (0.6.0-beta.4) y las skills comunitarias de `dsh-agent-teams/skills` (EV-046). Ninguno se instala automáticamente; cada uno requiere versión exacta, hash, licencia, compatibilidad y prueba.

- **v3.1 (directiva §5):** los instaladores comunitarios que modifican configuraciones de agentes (Codebase Memory, deja-vu) **no alteran silenciosamente** la configuración personal: se preparan **perfiles DSH aislados**, se revisan los efectos de instalación y **se prueban en un entorno desechable** antes de un perfil persistente (doc 27; AMD-07).

## OD-19 — Visual-first CLI Integration · CONFIRMADA
- **Resolución:** la mayoría de funciones de terminal se ofrecen con botones, formularios, asistentes, paneles, tablas, menús y diálogos; la CLI sigue; **ambas consumen la misma lógica**. Mecanismo de apoyo verificado: la skill `dsh-doc` documenta «compartir operaciones entre acciones de UI y herramientas del agente» (`references/user-actions.md`, EV-034). **Pendiente:** inventario completo (doc 10).
- **v3 (H-02):** el inventario CLI→UI clasifica cada operación por efecto real, recursos tocados y permiso; la UI separa «consultar resultado registrado» de «ejecutar de nuevo» (doc 10).

## OD-20 — Ejecución especializada · CONFIRMADA
- **Resolución:** workers locales para tareas deterministas; subagentes de IA solo si hace falta razonamiento; sin cargar instrucciones y herramientas de cada especialista en el agente principal; reutilizar la coordinación de DSH. **Detalle:** docs 05 y 08.

- **v3.1:** la enmienda documental de `ESPECIFICACION.md:718-721` queda **redactada y autorizada** (AMD-02, doc 28): coordinador, subagentes bajo demanda, workers deterministas y ejecución adaptativa, **sin segunda autoridad de pipeline ni segundo scheduler** y **sin que ningún subagente apruebe fases protegidas**. No se implementa.

## OD-21 — Skill fundacional · CONFIRMADA
- **Resolución:** `evol-studio-plugin-development`, preparada e instalada en Tanda 1 antes del primer plugin propio; apoyada en `dsh-doc` **cuando exista** y en otras referencias de la versión instalada. ~~Dependencia bloqueante C-01~~ **(corregido en v3: ya no es bloqueante, ver abajo)**. **Detalle:** doc 12.
- **v3 (H-03):** la skill **no** depende de una sola referencia externa ni de que `dsh-doc` esté preinstalada: jerarquía de fuentes (inspección en ejecución → documentación de la versión instalada → código y tipos → ejemplos de plugins → skills complementarias con procedencia → `dsh-doc` si existe). Sigue siendo **requisito previo al primer plugin propio** y se valida en la Tanda 1; no se afirma que funcione hasta comprobarla (doc 12). La contradicción C-01 deja de ser «dependencia bloqueante».

## OD-22 — Handoff entre tandas · BASELINE OPERATIVA PROPUESTA
- **Resolución:** Tanda 2 depende de un informe verificable del entorno DSH de Tanda 1 (versiones, rutas, capacidades, evidencias, limitaciones). **Detalle:** docs 13 y 14.
- **v3:** el informe de handoff incluye qué fuentes de la jerarquía del doc 12 estaban disponibles y la lista de capacidades **no verificadas** (doc 13 §5).

## OD-23 — Indexación bajo demanda · BASELINE OPERATIVA PROPUESTA
- **Resolución:** sin indexación indiscriminada; incremental y por eventos relevantes; límites de concurrencia; frescura visible. **Detalle:** doc 08 §4.

## OD-24 — Configuración de modelos por fase · CONFIRMADA
- **Resolución:** proveedor, modelo, nivel de razonamiento compatible, por fase/rol/subagente, límites de consumo y política de contingencia, todo opcional; el modo automático hereda DSH y es el predeterminado; sin otro sistema de proveedores. **Evidencia:** AgentTeams ya admite `provider/model/reasoning_effort/fallback` por miembro (EV-038); la semántica de razonamiento varía por versión de DSH (EV-039). **Detalle:** doc 06.
- **v3:** el diseño se limita a lo documentado para la versión candidata (`list_subagent_models`, `reasoningEfforts` por modelo, perfil de miembro de AgentTeams); la regla de «razonamiento explícito» es de 0.2.2-alpha.2 y **no** se atribuye a 0.2.1-rc.2. Adaptador por versión.

## OD-25 — Arquitectura de ejecución multiagente del pipeline · CONFIRMADA
- **Resolución:** siete fases intactas; coordinación multiagente **dentro** de cada fase con AgentTeams, workers y Model Routing; modo predeterminado **Adaptativo**; tres modos (Simple, Adaptativo, Multiagente supervisado); ningún modo reduce verificaciones, permisos ni autorizaciones. **Detalle:** doc 04.
- **v3:** las tareas de AgentTeams **no modifican directamente** los estados protegidos de Evol (fases, aprobaciones, `.evol/`); Core es quien lee evidencia y transita. La entrada `ESPECIFICACION.md:718` («solo un agente propio, el orquestador `/evol`, y añadir otro exige una decisión explícita y entrada en la especificación») queda **pendiente de enmienda** al ratificarse OD-20/25 (doc 19, N-07).
- **v3.1:** la enmienda `ESPECIFICACION.md:718` queda **redactada** como AMD-02 (N-07 resuelta documentalmente); regla adicional: los miembros no lanzan otros miembros (profundidad 1), a verificar en AgentTeams (P-34).

## OD-26 — Approval Checklist · CONFIRMADA (v3.1)
- **Resolución:** revisión humana **granular por fase**. La persona revisa individualmente los elementos obligatorios de Briefing, Spec, Plan, Build, QA y Retro; cada ítem presenta identificador, requisito, artefacto asociado, evidencia, resultado de verificación, versión o hash, estado de revisión y comentarios. Estados: **Aprobado**, **Requiere cambios**, **Pendiente de revisión**. **No se permite avanzar** con ítems obligatorios sin conformidad válida o con cambios pendientes. Las conformidades se **atan a la versión de los artefactos** y los cambios relevantes las invalidan. **El checklist no reemplaza la firma final del Approval Broker. Los agentes no pueden marcar ítems de aprobación humana.**
- **Detalle:** contratos y pruebas en doc 21 (AC-CL-01…16); ceremonia y `checklist_digest` en doc 11; vistas en docs 09 y 23. **Sub-decisión abierta S-26-1:** verificación de usuario propia para ítems críticos. **Dependencias:** OD-04, OD-11. **Riesgos:** fatiga de revisión; ítems derivados mal; marcas con sesión abierta (BA-13). **Pendiente:** implementación (Tanda 2) y pruebas.

## OD-27 — Evol Repository Explorer · CONFIRMADA (v3.1)
- **Resolución:** plugin propio (nombre provisional **Evol Repository Explorer**) para visualizar el historial Git y la actividad GitHub del proyecto, con **Git local** como fuente disponible sin conexión y **GitHub API** como complemento opcional; integrado con Pipeline, tareas, criterios y evidencias. **MVP de solo lectura**; sin motor Git nuevo; **sin `push`, `merge` ni borrado de ramas**; **sin tokens en lugares accesibles a los agentes**. Ubicación propuesta: **Proyectos → Repositorio**.
- **Detalle:** doc 22 (RE-01…12). **Dependencias:** OD-12 (trailer `CA:`), OD-15, OD-17. **Riesgos:** custodia del token (pendiente de validación junto con el broker). **Pendiente:** Tanda 2 (hito H8b); sin implementación.
