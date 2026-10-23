# Piloto R0 del conocimiento propio

Mide qué motor de búsqueda de documentación acierta más con **preguntas reales en español sobre documentación en inglés**.

## Qué hay

- `preguntas.json`: 30 preguntas fijas. Cada una dice en qué documento y en qué sección está la respuesta, comprobado contra las capturas de `fuentes`.
- Las fuentes se capturan con `evol knowledge source add` y se revisan con `evol knowledge review`; el piloto solo indexa `~/.config/evol/knowledge/ready/<fuente>/`.

## Cómo se mide

Para cada pregunta se mira si el documento esperado está entre los **5 primeros resultados** (recall@5) y en qué puesto aparece (MRR). Como segunda lectura, si además aparece la sección esperada. Los resultados se separan por tipo de pregunta (`literal`, `parafraseada`, `conceptual`): los vectores deberían ayudar sobre todo en las dos últimas.

## Los montajes que se comparan

1. **docs-mcp-server con texto completo** (sin servidor de embeddings): la línea base.
2. **docs-mcp-server con vectores** a través de Ollama (`bge-m3-cpu` y `qwen3-embedding-cpu`; siempre los `-cpu`, que no tocan la GPU).
3. **mcp-local-rag** con un modelo multilingüe en el propio proceso.

Los motores están en `~/.local/share/evol/knowledge-engines/` con versión fija (docs-mcp-server 3.3.0, mcp-local-rag 0.23.1) y los scripts de instalación solo de los módulos nativos. Telemetría de docs-mcp-server siempre apagada: `DOCS_MCP_TELEMETRY=false`.

**Regla:** los vectores solo entran si mejoran al menos 15 puntos de recall@5 al texto completo (criterio 113).

## Resultados (2026-10-23)

30 preguntas, cada una buscada dentro de la fuente que corresponde. El detalle por pregunta está en `resultados.json`; los scripts que lo producen,
en `medicion/` (rutas de esta máquina; hay que adaptarlas).

| Montaje                                                 | recall@5           | MRR  | sección en top 5 | mediana por consulta                    |
| ------------------------------------------------------- | ------------------ | ---- | ---------------- | --------------------------------------- |
| docs-mcp-server, solo texto completo                    | 33,3 % (10/30)     | 0,27 | 23,3 %           | 0,9 s                                   |
| mcp-local-rag + `paraphrase-multilingual-MiniLM-L12-v2` | 66,7 % (20/30)     | 0,53 | 36,7 %           | 3,2 s (carga el modelo en cada llamada) |
| docs-mcp-server + `bge-m3-cpu` (Ollama)                 | **76,7 % (23/30)** | 0,51 | **60,0 %**       | 1,0 s                                   |

Por tipo de pregunta (recall@5): literal 54,5 % / 54,5 % / 81,8 %; parafraseada 16,7 % / 66,7 % / 66,7 %; conceptual 28,6 % / 85,7 % / 85,7 %
(en el orden de la tabla).

**Cómo leerlo, con sus límites**

- Los dos montajes con vectores superan por mucho el umbral de 15 puntos sobre el texto completo (criterio 113): +33 y +43 puntos.
- **30 preguntas son pocas**: entre los dos montajes con vectores hay 3 aciertos de diferencia, que no basta para elegir. La sección exacta sí
  separa más (60 % frente a 37 %), pero depende de cómo trocea cada motor.
- El texto completo parte en desventaja: busca palabras españolas en documentos ingleses.
- **El índice de `bge-m3` está incompleto**: tiene 4 065 fragmentos de los 4 236 del de texto completo (faltan 50 de OWASP y 121 de React: 2 y 4
  documentos enteros). Los fragmentos cuya petición de embeddings se agotó, en una máquina con la CPU compartida con otro indexado, se descartaron
  sin repetirse. Una de las 30 preguntas (P26) tiene su documento fuera de ese índice, así que su resultado real podría ser algo mejor.
- Los tiempos se midieron con la CPU compartida; sirven de orden de magnitud. Indexar con `bge-m3` en CPU tardó unas 2 horas (OWASP 44 min, TypeScript
  30 min, React 59 min) frente a unos 27 minutos de mcp-local-rag con su modelo pequeño y unos segundos del texto completo.
- Falta el montaje con `qwen3-embedding-cpu` y repetir la medición sin que un indexado compita por la CPU.
