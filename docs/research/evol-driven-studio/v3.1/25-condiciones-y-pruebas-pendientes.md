# 25 — Informe de condiciones y pruebas pendientes (v3.1)

Fecha de corte: 2026-11-17. **Ninguna prueba de esta lista se ha ejecutado.** Ratificar o decidir no es validar. Este informe reúne, en un solo lugar, lo que debe cumplirse o comprobarse antes de dar por válida cada decisión.

## 1. Condiciones ligadas a las decisiones ratificadas

| Decisión | Condición | Cómo se comprueba | Cuándo |
|---|---|---|---|
| **OD-09** | Versiones exactas fijadas en un manifiesto reproducible; sin `latest`; sin actualización automática | `studio.lock.json` (doc 27 §2); prueba C-T1-10 | inicio Tanda 1 |
| OD-09 | Compatibilidad real de AgentTeams, dsh-mnemon, CBM, deja-vu y demás | C-T1-01…08 | Tanda 1 |
| OD-09 | Incompatibilidad bloqueante → propuesta de cambio documentada antes de tocar la baseline | doc 27 §5 | si ocurre |
| **OD-03** | Almacenamiento, indexación y recuperación **locales** | red cero en arranque, captura y recuperación (C-T1-03; P-13) | Tanda 1 |
| OD-03 | **Funcionamiento sin conexión verificable** | prueba con red cortada | Tanda 1 |
| OD-03 | **Aislamiento por proyecto** | dos proyectos, 0 fugas | Tanda 1 |
| OD-03 | **Procedencia** de recuerdos | cada recuerdo con fuente, fecha, proyecto | Tanda 1 |
| OD-03 | **Captura automática controlada**; sin dos proveedores de escritura automática sobre las mismas sesiones sin política | C-T1-06 | Tanda 1 |
| OD-03 | **Autoevolución de skills desactivada** | configuración verificada | Tanda 1 |
| OD-03 | Sin dependencia cloud obligatoria; sin migración destructiva | red; inventario de datos antes/después | Tanda 1 |
| **OD-04** | **Aislamiento efectivo de procesos y credenciales** del broker | **P-18** | antes de H7 |
| OD-04 | Autenticador utilizable en el equipo de destino (llave FIDO2, `udev`, navegador del host, rpId dedicado en `*.localhost`) | EV-070 → prueba manual en CachyOS | antes de H7 |
| OD-04 | Si el aislamiento no puede demostrarse: **mecanismo pendiente de validación y aprobaciones protegidas bloqueadas** | política (doc 11 §7) | siempre |
| **OD-26** | Checklist derivado de datos reales; agentes no marcan; invalidación por versión | AC-CL-01…16 | H7 |
| **OD-27** | Solo lectura; sin tokens al alcance de agentes | RE-01…12 | H8b |
| **AMD-01…08** | Incorporadas al texto normativo con notas, con aprobación humana | revisión de `ESPECIFICACION.md` y specs | ciclo de spec de Studio |

## 2. Pruebas pendientes por familia

| Familia | IDs | Dónde | Etapa |
|---|---|---|---|
| Permisos y equivalencia CLI/MCP/UI | P-01, P-02, P-10…P-14 | doc 11 §11 | H0, H8 |
| Aprobación, replay, estado y concurrencia | P-03…P-09, P-15, P-16, P-17 | doc 11 | H7 |
| **WebAuthn y Ed25519** | P-18…P-33 | doc 11 | H7 |
| Subagentes anidados (AMD-02) | **P-34**, C-T1-09 | docs 11, 27 | Tanda 1 |
| Checklist | AC-CL-01…16 | doc 21 §8 | H7 |
| Repository Explorer | RE-01…12 | doc 22 §6 | H8b |
| Interfaz y accesibilidad | UX-01…12 | doc 23 §7 | H2 en adelante |
| Compatibilidad de la Tanda 1 | C-T1-01…10 | doc 27 §6 | Tanda 1 |
| Instaladores en entorno desechable | informe PASS/WARN/BLOCK por plugin | doc 27 §4 | Tanda 1 |
| Benchmark de memoria y de Code Intelligence (motor nativo frente a CBM) | umbrales aprobados **antes** de ejecutar (H4) | docs 08, 15 | H4 |
| Red por componente | captura de tráfico | doc 08 | Tanda 1 / H4 |
| Skill fundacional | activación, no activación, sin `dsh-doc` | doc 12 §9 | Tanda 1 |
| Reproducir cifras de CBM (C-11) | benchmark propio | doc 01 | Tanda 1 / H4 |
| Inventario de licencias transitivas (D-08) | herramienta de inventario | doc 17 | antes de publicar |

## 3. Decisiones y sub-decisiones abiertas

| ID | Decisión | Propone | Quién decide |
|---|---|---|---|
| S-26-1 | Checklist con ceremonia final; autenticación adicional solo en operaciones excepcionales | formalizada (doc 21 §6); **confirmación formal pendiente** | propietario |
| S-04-1 | Política de credenciales sincronizables (BE = 1): prohibidas por defecto | prohibidas | propietario |
| S-04-2 | Periodicidad de rotación de la clave de firma (propuesta: 12 meses) y de caducidad de solicitudes (5 min) | las indicadas | propietario |
| S-27-1 | Custodia del token de GitHub: servicio protegido frente a «solo repositorios públicos» | servicio protegido, con alternativa sin token | propietario |
| S-12 | Política exacta del trailer `CA:` y excepciones (OD-12) | doc 02 | propietario |
| S-23-1 | Tipografía y contrastes del sistema visual (D-15) | a elegir al construir | propietario |
| — | Incorporar o no las enmiendas AMD-01…08 al texto normativo y cuándo | en el ciclo de spec de Studio | propietario |
| — | Commit y ZIP (doc 26) | propuesta del doc 26 | propietario |

## 4. No conformidades y trabajo de código derivado de la documentación (nada hecho)

| ID | Qué | Origen | Hito |
|---|---|---|---|
| NC-01 | `verify`, `approve` y `next` no comparan `state.json` con el registro (solo `doctor`) | N-06, EV-045 | H0 |
| NC-02 | MCP sin anotaciones; `evol_verify` modo `fin` ejecuta comandos | N-01, EV-004, 048 | H0 |
| NC-03 | Firma HMAC en proceso; la clave es legible por el mismo usuario | EV-060, 061 | H7 |
| NC-04 | Sin lock de concurrencia en `.evol/` | EV-007 | H0 |
| NC-05 | Consultas del grafo escriben (`impact`, `trace`) | EV-003 | H0 |
| NC-06 | `evol memory` solo habla con MemPalace (falta `MemoryProvider`) | EV-067 | H4 |
| NC-07 | No existen checklist, `review.*` ni `repo.*` | docs 21, 22 | H7, H8b |

## 5. Evidencia declarada como no verificada

Viabilidad de llave FIDO2 y de `udev` en CachyOS (EV-070); soporte de WebAuthn y de `*.localhost` como RP ID en el navegador del host; método exacto de instalación de DSH 0.2.1-rc.2; si AgentTeams permite miembros anidados; existencia de `cordis_inspect_*` en 0.2.1-rc.2; valor por defecto de `actualizaciones.aviso` (N-12); licencias transitivas; cifras de rendimiento de CBM; todo lo declarado por los autores de los plugins.

## 6. Por etapa

| Etapa | Falta para avanzar |
|---|---|
| **Tanda 1** | redactar `studio.lock.json`; entorno desechable; C-T1-01…10; informe de instaladores; benchmark de memoria con umbrales previos; handoff verificable (doc 13 §5) |
| **Tanda 2** | cerrar H0 (NC-01, 02, 04, 05); validar el aislamiento del broker (P-18) y el autenticador; formato v2 y migración; checklist; `MemoryProvider`; incorporar AMD al texto normativo; H8b |
| **Publicación estable** | combinaciones «probadas», licencias transitivas, red cero, P-01…P-34, AC-CL, RE, UX en verde; revisión de seguridad independiente |

## 7. Riesgos residuales

Un adversario con control de la cuenta del broker o con el autenticador físico; la **verificación de «lo que se ve es lo que se firma»** no demostrada (P-33); la seguridad de Harness sin auditar; dependencia de un solo mantenedor en AgentTeams; automatizaciones de navegador del propio usuario que se parecen a las de un agente; fatiga de revisión con un checklist largo (se mide en la Tanda 2).
