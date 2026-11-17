# 00 — Informe ejecutivo v3.1: Evol-Driven Studio — baseline documental cerrada

Directiva de cierre v3.1 · 2026-11-17 · rama `feat/evol-driven-studio` · HEAD `47a93c8` (sin cambios) · **solo documental: sin commits, sin implementación, sin instalar DSH ni plugins, sin tocar código, `.evol/`, memorias ni perfiles.** v2 y v3 se conservan intactas en `../v2/` y `../v3/`.

## Qué cambió de v3 a v3.1

| Tema | Resultado |
|---|---|
| H-04 / D-07 | **Cerrados documentalmente.** Lectura íntegra de 2 931 líneas de normativa; matriz de 35 filas; fichas completas de N-01, N-06, N-07 y N-10; 8 enmiendas redactadas (no incorporadas) |
| OD-09 | **Ratificada:** DSH `0.2.1-rc.2` + AgentTeams `0.1.30`, en un manifiesto reproducible; sin actualización automática; no certifica compatibilidad |
| OD-03 | **Ratificada:** dsh-mnemon + Mnemon Native por defecto en instalaciones nuevas, con condiciones (local, offline, aislamiento, procedencia, captura controlada, sin autoevolución, sin cloud, sin migración destructiva) |
| OD-04 | **Arquitectura concretada:** WebAuthn con verificación de usuario + firma Ed25519 en un broker protegido; evidencia, rotación, recuperación y amenazas con navegador automatizado; **mecanismo pendiente de validación** |
| OD-26 (nueva) | **Approval Checklist:** revisión humana granular por fase; conformidades atadas a la versión; no reemplaza la firma |
| OD-27 (nueva) | **Evol Repository Explorer:** Git local + GitHub opcional, solo lectura; Proyectos → Repositorio |
| Sistema visual | **`EVOL-STUDIO-UI-UX-SYSTEM`** como documento normativo; lista primero, grafo complementario |
| MCP y agentes | Contratos por efectos reales (AMD-01); coordinador, subagentes y workers (AMD-02) |
| Tanda 1 | Manifiesto, perfiles aislados, prueba de instaladores en entorno desechable, propuesta de cambio de baseline |

## Hallazgos de la lectura íntegra que importan

- La spec **se contradice a sí misma** sobre el MCP: el criterio 22 dice «solo lectura», pero el criterio 125 hace escribir a `evol_checkpoint` y `evol_verify` ejecuta comandos (EV-058).
- El HMAC actual permite **falsificar a quien verifica** (EV-060); la firma debe salir del proceso del agente y ser asimétrica.
- WebAuthn Nivel 3 (Recomendación W3C, agosto de 2026) reconoce los **autenticadores virtuales** de la automatización del navegador (EV-068): por eso el factor humano debe ser una credencial inscrita previamente, no una confirmación visual.
- `http://localhost` comparte RP ID en todos los puertos (EV-068): el origen exacto debe comprobarse.
- `verify`, `approve` y `next` no concilian el estado con el registro (NC-01): defecto de **código**, no de la norma.

## Invariantes que se conservan

Evol-Driven como autoridad del pipeline y de las aprobaciones; Harness como plataforma; AgentTeams como coordinador sin segundo scheduler; plugins comunitarios primero; dos máquinas de estados; Control Center visual-first con la misma lógica que la CLI; subagentes y workers bajo demanda; Model Routing opcional; memoria local; skill fundacional previa al primer plugin propio; dos tandas; Plugin Edition antes que Desktop; **los subagentes no aprueban fases protegidas**.

## Dictamen v3.1

| Categoría | Veredicto |
|---|---|
| DOCUMENTACIÓN CONSISTENTE | **Sí, con alcance documental** (conjunto coherente y conciliado mediante enmiendas **redactadas**; la normativa vigente aún no las incorpora) |
| DOCUMENTACIÓN CON PENDIENTES | **Sí, no estructurales** (incorporar las enmiendas; sub-decisiones S-26-1, S-04-1/2, S-27-1, S-12; tipografía; commit y ZIP) |
| IMPLEMENTACIÓN NO VALIDADA | **Sí, sin excepciones** |
| BLOQUEO REAL DE INTEGRACIÓN | **No para iniciar la Tanda 1**; **sí, acotado** para la Tanda 2 (aislamiento del broker, autenticador, H0) y la publicación |

## Qué sigue (todo requiere decisión de la persona)

1. Aprobar el alcance del commit y del ZIP (doc 26).
2. Autorizar el inicio de la Tanda 1 (doc 13, doc 27): instalar DSH `0.2.1-rc.2` y los plugins **solo** en un perfil aislado y tras la prueba de instaladores.
3. Decidir cuándo incorporar las enmiendas al texto normativo (doc 28) y las sub-decisiones abiertas (doc 25 §3).

## Índice v3.1

`evidence-v3.md` · **`evidence-v3.1`** · `01` auditoría · `02` decisiones OD-01…27 · `03` arquitectura · `04` flujo multiagente · `05` subagentes · `06` model routing · `07` AgentTeams · `08` memoria y workers · `09` Control Center · `10` inventario CLI→UI · **`11` Approval Broker (WebAuthn + Ed25519)** · `12` skill fundacional · `13` Tanda 1 · `14` Tanda 2 · `15` roadmap · `16` compatibilidad · `17` deuda · `18` archivos · **`19` conciliación (35 filas)** · `20` cierre de hallazgos · **`21` Approval Checklist** · **`22` Repository Explorer** · **`23` EVOL-STUDIO-UI-UX-SYSTEM** · **`24` trazabilidad** · **`25` condiciones y pruebas** · **`26` commit y ZIP** · **`27` manifiesto y perfiles DSH** · **`28` enmiendas AMD-01…08**.

## Límites

Análisis estático de código y documentación; ninguna prueba ejecutada; WebAuthn comprobado en la especificación, no en un navegador ni con una llave; la viabilidad en CachyOS (llave FIDO2, `udev`, navegador del host) no está verificada (EV-070); el hook de MemPalace auto-mina la sesión (no fue estrictamente de solo lectura); Engram no se escribió.
