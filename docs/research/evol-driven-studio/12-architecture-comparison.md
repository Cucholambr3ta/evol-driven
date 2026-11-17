# 12 — Comparación de arquitecturas (R9)

## 1. Alternativas

- **A — Framework independiente + adaptador DSH.** Evol conserva su núcleo, CLI y MCP; un plugin de Harness (host + cliente) lo consume por CLI `--json` y, más adelante, por un paquete TypeScript `core`.
- **B — Evol reconstruido como plugins Cordis.** Pipeline, aprobaciones, memoria y verificaciones se reimplementan dentro del ecosistema de Harness.
- **C — Núcleo independiente + distribución compuesta.** Igual que A, pero se entrega como distribución preconfigurada (perfil `evol-studio` con bundles de memoria, código y equipos, y asistente de instalación). **C es A más empaquetado y configuración, no un diseño distinto del núcleo.**
- **D — Híbrido propio:** *no se propone.* No encontré una ventaja verificable sobre A/C; la única variante interesante (dividir el núcleo en un paquete `core` y un adaptador) ya está contenida en A.

## 2. Criterios y pesos (suman 100)

Pesos justificados por las prioridades del encargo (§22: integridad, reutilización, memoria local, independencia, extensibilidad, seguridad): reutilización 10, seguridad 10, acoplamiento 7, mantenibilidad 7, complejidad 6, extensibilidad 6, compatibilidad con agentes 6, dependencia de Harness 6, compatibilidad con futuras versiones 5, offline 5, costos de mantenimiento 5, riesgos de migración 5, portabilidad 4, escalabilidad de proyectos 4, calidad de memoria 4, facilidad de instalación 4, rendimiento 3, reversibilidad 3.

Puntuación 1–5 (5 = mejor; en acoplamiento, complejidad, dependencia, costos y riesgos, 5 = menor). Son **juicios cualitativos basados en la evidencia de los docs 01–10; no hay mediciones**.

| Criterio (peso) | A | B | C | Motivo principal |
|---|---|---|---|---|
| Reutilización (10) | 4 | 2 | 5 | B reescribe lo que Evol y Harness ya tienen |
| Seguridad (10) | 4 | 2 | 4 | la autoridad de aprobación queda fuera de un host pre-release sin auditar |
| Acoplamiento (7) | 4 | 1 | 4 | B ata el pipeline al host |
| Mantenibilidad (7) | 4 | 2 | 3 | C mantiene además el empaquetado |
| Complejidad (6) | 4 | 2 | 3 | |
| Extensibilidad (6) | 3 | 5 | 4 | B hereda toda la extensibilidad de Cordis |
| Compat. con agentes (6) | 5 | 2 | 5 | A/C no rompen los adaptadores a IDE ni el MCP |
| Dependencia de Harness (6) | 4 | 1 | 3 | |
| Compat. futuras versiones (5) | 4 | 2 | 3 | Harness es pre-stable |
| Offline (5) | 4 | 4 | 4 | sin diferencia por la arquitectura |
| Costo de mantenimiento (5) | 4 | 2 | 3 | |
| Riesgo de migración (5) | 4 | 1 | 3 | |
| Portabilidad (4) | 4 | 2 | 4 | el núcleo corre sin Harness |
| Escalabilidad de proyectos (4) | 3 | 3 | 3 | |
| Calidad de memoria (4) | 3 | 3 | 4 | C trae memoria integrada |
| Facilidad de instalación (4) | 3 | 3 | 4 | |
| Rendimiento (3) | 3 | 4 | 3 | B evita un salto de proceso |
| Reversibilidad (3) | 5 | 1 | 4 | |
| **Total /100** | **77.6** | **45.0** | **75.0** | |

## 3. Sensibilidad

- **A vs C:** diferencia de 2.6 puntos, dentro del ruido. No son excluyentes: C se construye sobre A.
- **B:** si se eliminan los cinco criterios en que B es peor (reutilización, acoplamiento, dependencia de Harness, riesgo de migración y reversibilidad), B queda en ≈53 frente a ≈76 de A (cálculo propio con los pesos restantes). B no supera a A salvo con pesos que ignoren casi todo lo anterior.
- **Si Harness madurase** (APIs estables y auditoría de seguridad), B ganaría atractivo; hoy es el menos defendible.

## 4. Decisión recomendada

**Camino A → C.** Empezar con A (Plugin Edition, núcleo independiente, adaptador delgado) y llegar a C cuando exista el perfil preconfigurado y el asistente de instalación. Alternativas B y D descartadas por ahora. Registrado como ADR-001. Esta recomendación **no está aprobada**; requiere decisión del propietario (OD-01).

## 5. Qué invalidaría la recomendación

- Harness retira o rompe `dsh.bundle`/slots/`@Remote` sin aviso → mantener versión fijada y revisar.
- El prototipo del Hito 3 muestra que un plugin host no puede aislar el acceso al log firmado → replantear dónde corre el núcleo (proceso separado).
- El benchmark de memoria/código (doc 11) descarta los proveedores candidatos.
