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
