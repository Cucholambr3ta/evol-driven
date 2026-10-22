# Fuentes de los mockups

Las pantallas de `../mockups/` (HTML con los datos embebidos) se generan desde aquí.

| Carpeta o archivo           | Qué es                                                                  |
| --------------------------- | ----------------------------------------------------------------------- |
| `ui/`                       | Estilos y el JavaScript de cada pantalla (`board`, `project`, `docs`…) |
| `ui/stars.js`               | La constelación (cielo de estrellas con zoom y ficha desplegable), compartida por Grafos y Documentación |
| `data/portfolio.json`       | Estado real de los proyectos de muestra (salida de `evol`)              |
| `data/code.json`            | Grafo de código de evol-driven (indexador nativo)                       |
| `data/docs.json`            | Documentación de cada proyecto: lo que genera `collect-docs.mjs`        |
| `build.mjs`                 | Une `ui/` y `data/` en los 4 HTML                                       |
| `collect-docs.mjs`          | Lee los archivos reales de los proyectos y llama a `evol export/diagrams` |
| `collect-skills.mjs`        | Lee las skills de esta máquina (la biblioteca de evol, vacía, y las de tus agentes) y las 31 disciplinas |
| `data/skills.json`          | Lo que genera `collect-skills.mjs` (el texto solo de las skills propias) |
| `drive.js`                  | Comprobaciones que se ejecutan dentro de la página (ver abajo)          |

## Regenerar

```bash
node build.mjs                                   # ../mockups/*.html
node collect-docs.mjs <proyectos> <dist/cli.js> <EVOL_CONFIG_DIR>   # actualiza data/docs.json
node collect-skills.mjs [<proyectos>]                               # actualiza data/skills.json
```

`collect-docs.mjs` no inventa nada: un documento que el pipeline espera y no existe sale como
«No existe», y un diagrama sin datos conserva el motivo que da evol.

## Verificar con Chromium

Cada página se abre con `drive.js` añadido al final; el resultado queda en el título:

```bash
chromium --headless=new --no-sandbox --virtual-time-budget=20000 --dump-dom pagina-test.html | grep -o '<title>[^<]*'
```

Debe decir `RESULTADO: … ok`. Para la pantalla de documentación abre todos los documentos de todos
los proyectos, prueba el zoom de los diagramas, la búsqueda y «Solo lo que falta»; además acerca la cámara a cada estrella de la constelación (código y documentos) y comprueba que despliega su ficha.
