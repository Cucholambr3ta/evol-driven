# 05: Plan de migración y decisiones pendientes

Ordena el trabajo que ya estaba diseñado (Tandas 1 y 2 de v3.1, hitos H0 a H10) a la luz de tres hechos nuevos:
- ya existe un prototipo (EV-086);
- upstream se ha movido (EV-079 a EV-084);
- la integración se hace en el equipo nuevo.

**Nada de esto está autorizado todavía:** cada bloque empieza cuando lo autoriza la persona.

## 1. Cómo se gobierna la migración con el propio evol

| Repositorio | Proyecto evol | Qué lleva |
|---|---|---|
| `evol-driven` | Este repositorio. **Ciclo 3** (abierto en briefing) | **H0**: los cambios del núcleo que Studio necesita (doc 01 §11). Es lo que debería contar el briefing del ciclo 3 |
| `evol-driven-studio` | **Proyecto nuevo**, con `evol init --perfil web --name evol-driven-studio` (adopta el prototipo sin tocar sus archivos). Lo inicializa el agente **solo tras el «sí» de la persona** | H1 a H10: plugins, paneles, adaptadores, broker y distribución |

Esto encaja con OD-02 (dos repositorios). El perfil `web` añade UXDD, A11yDD, UDD y PDD, que cubren lo que el prototipo dejó abierto: la verificación visual, la accesibilidad (WCAG 2.2 AA, S-23-1) y el rendimiento.

## 2. Secuencia

| Bloque | Contenido | Entrada | Salida verificable |
|---|---|---|---|
| **B0: traspaso** | Paso 0 del doc 04 (push, prototipo versionado, D2, D3) | autorización | rama en el remoto; prototipo con su primer commit; escaneo de secretos limpio |
| **B1: Tanda 1 en el equipo nuevo** | Pasos 1 a 4 del doc 04; C-T1-01 a C-T1-10 (v3.1 doc 27 §6) | B0 | `studio.lock.json` + informe de handoff (v3.1 doc 13 §5) |
| **B2: skill fundacional** | `evol-studio-plugin-development` (v3.1 doc 12), apoyada en las skills `cordis-*` del preset (EV-085). Pasa por `incorporar-skill` y `evaluar-skill` | B1 | skill auditada y aprobada **por la persona** |
| **B3: cerrar la Etapa 1** | Protocolo visual del prototipo (16 comprobaciones) en el perfil aislado; decisión sobre la credencial | B1 | cierre GO o lista de fallos |
| **B4: H0 en el núcleo** (ciclo 3 de `evol-driven`) | Por prioridad: **(a) bloqueo de `approve`/`next`/`ciclo` para agentes DSH (E3)**; (b) conciliación estado↔log; (c) MCP anotado por efecto y `evol_verify` dividido; (d) `MemoryProvider`; (e) lock de `.evol/`, `verifier_version`, trailer `CA:`; (f) firma asimétrica | B1 (puede ir en paralelo a B3) | pipeline completo del ciclo 3; **versión 0.6.0** publicada y firmada; Studio fija esa versión |
| **B5: H1 a H3** | Adaptador mínimo (hecho en parte), lectura (Pipeline Explorer, Dashboard), equipos (AgentTeams y `TaskRef`) | B2 + B3 + B4(a–c) | pruebas de contrato Host↔Core con fixtures; sin escrituras |
| **B6: H4 a H6** | Memoria (mnemon), modelos, calidad y evidencia | B5 | C-T1-03 a C-T1-07 re-ejecutadas en integración |
| **B7: H7** | Approval Broker + Checklist | B6 + validación del aislamiento y la llave FIDO2 en el equipo nuevo | P-01 a P-34, AC-CL-01 a AC-CL-16; **mientras no pasen, la aprobación sigue en la terminal** |
| **B8: H8, H8b, H9** | Resto de la CLI→UI, Repository Explorer, Plugin Edition reproducible | B7 | criterios del v3.1 doc 14 §5 |

**Orden recomendado para empezar:** B0 → B1 → (B2 ∥ B3 ∥ B4a) → B4 completo → B5. Motivo: B4(a) es el único hueco que permitiría a un agente aprobar fases en cuanto tenga shell dentro de DSH, así que va antes de cualquier uso real.

## 3. Decisiones que tiene que tomar la persona

| ID | Pregunta | Opciones | Recomendación |
|---|---|---|---|
| **D1** | ¿Se mantiene la baseline OD-09 (0.2.1-rc.2 + AgentTeams 0.1.30) aunque upstream recomiende 0.2.2-rc.5 + 0.1.31? | mantener / propuesta de cambio ahora / cambiar | **Mantener** y redactar la propuesta en paralelo (doc 02 §4) |
| **D2** | ¿Qué hacer con el prototipo sin versionar? | versionarlo tal cual / versionarlo y reescribir la historia de su evidencia / empezar de cero reutilizando piezas | **Versionarlo** tras escanear secretos. Es trabajo útil y bien acotado en lectura |
| **D3** | ¿Clave del gate en el equipo nuevo? | copiarla a mano (se conserva el historial firmado) / empezar un registro nuevo (las aprobaciones antiguas quedan como históricas no verificables allí) | **Copiarla a mano**, fuera de cualquier agente. Con H0(f), el tramo HMAC se cierra con `epoch-start` |
| **D4** | ¿Credencial de lanzamiento potencialmente expuesta (EV-088)? | invalidarla y reiniciar la instancia / dejarla expirar / revisar y revocar cookies | **Invalidarla** antes de cualquier commit del prototipo |
| **D5** | ¿Proveedor de modelos para el perfil aislado? | reutilizar los plugins del perfil personal (`dsh-chatgpt-sub`, `dsh-claude`) / uno nuevo con versión fija / sin modelo (solo pruebas sin LLM) | Uno con **versión exacta e instalador probado** (Paso 4). Sin él, C-T1-01 y C-T1-09 quedan «no verificadas» |
| **D6** | ¿El briefing del ciclo 3 de `evol-driven` es H0 (núcleo para Studio)? | sí / otro alcance / añadir también la investigación de memoria de código (OD-14) | **Sí, H0**, con OD-14 solo en lo que afecte a `MemoryProvider` |
| **D7** | ¿Inicializar `evol-driven-studio` como proyecto evol con perfil `web`? | `web` / `base` / no gobernarlo con evol | **`web`** |
| **D8** | ¿Qué hacer con `~/.dsh/profiles/evol-studio` del equipo de desarrollo? | dejarlo / retirar el plugin con el procedimiento soportado / borrar el perfil | Lo decides tú: **no** lo toca ningún agente. Retirar el plugin con el procedimiento del doc 03 si ya no se usa |

Siguen abiertas las sub-decisiones de v3.1: S-26-1, S-04-1, S-04-2, S-27-1, S-12, S-23-1, D-10 y la incorporación de AMD-01 a AMD-08 (v3.1 doc 02, paquete de ratificación).
