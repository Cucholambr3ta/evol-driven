# Dependencias

## Externas (las instala quien usa evol)

| Dependencia                                             | Versión                       | Licencia                         | Papel                                                                                                                      | ¿Obligatoria?                                            |
| ------------------------------------------------------- | ----------------------------- | -------------------------------- | -------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------- |
| Node.js                                                 | ≥ 24                          | MIT                              | Runtime; usa `node:sqlite`, `fs.globSync` y `util.parseArgs` del propio Node                                               | Sí                                                       |
| Git                                                     | cualquiera reciente           | GPL-2.0                          | `evol new` inicializa el repositorio; el indexador lee `git diff` para saber qué símbolos cambiaron                        | Sí                                                       |
| [MemPalace](https://github.com/MemPalace/mempalace)     | probado con 3.11.0            | MIT                              | Memoria persistente. Se usa por MCP (`mempalace-mcp`, stdio); no se reimplementa. Instalar con `uv tool install mempalace` | Para `evol memory` y para registrar eventos del pipeline |
| [GitNexus](https://github.com/abhigyanpatwari/GitNexus) | cualquiera con `gitnexus mcp` | **PolyForm Noncommercial 1.0.0** | Proveedor **opcional** de inteligencia de código (`"codeIntel": "gitnexus"`)                                               | **No**                                                   |

### Sobre GitNexus

- **Opcional.** El proveedor por defecto es el indexador propio (`native`).
- **No se incluye, no se copia y no se instala** desde evol-driven. Si el usuario lo tiene, evol lo
  lanza como un proceso aparte (`gitnexus mcp`) y le pide `query`, `impact` y `context` por MCP.
- Su licencia **solo permite uso no comercial**. Que su uso sea compatible con el de cada persona o
  empresa es responsabilidad de quien lo instala; evol-driven no lo comprueba.
- Se comprobó el cliente contra un servidor MCP de prueba, **no contra GitNexus real**: el formato
  exacto de su respuesta no forma parte del contrato de evol, así que devuelve su texto tal cual.

## Paquetes npm

| Paquete                     | Licencia | Para qué                                                                    |
| --------------------------- | -------- | --------------------------------------------------------------------------- |
| `@modelcontextprotocol/sdk` | MIT      | Cliente MCP (MemPalace y GitNexus)                                          |
| `ts-morph`                  | MIT      | Análisis de TypeScript/JavaScript del indexador (trae su propio TypeScript) |
| `yaml`                      | ISC      | Validar artefactos YAML de las disciplinas                                  |
| `zod`                       | MIT      | Validar la configuración y las definiciones de disciplinas                  |

Desarrollo: `typescript`, `vitest`, `eslint`, `typescript-eslint`, `prettier`, `tsx`, `@types/node`.
