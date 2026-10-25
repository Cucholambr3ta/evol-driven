# Dominio — Ola 1

> Vocabulario de esta ola, con los nombres que ya usa el resto del repositorio
> (`docs/ESPECIFICACION.md`, el código). Un concepto nuevo se añade aquí; uno ya existente (fase,
> disciplina, aprobación, skill…) no se repite.

## Entidades

- **Lenguaje de proyecto**: el `Stack` que `evol init` detecta o que la persona fija con
  `--lenguaje`. Tiene un identificador (`ts`, `python`, `shell`, `generico`), un patrón de rutas de
  prueba y el comando que las ejecuta. Cada módulo de `evol.config.json` tiene exactamente un
  lenguaje.
- **Perfil `script`**: un perfil de `evol.config.json` para un proyecto sin features de usuario
  (un script suelto). Tiene las mismas disciplinas base salvo FDD y ATDD.
- **Copia de agentes**: lo que `evol agents --dry-run` planea escribir, antes de tocar ningún
  archivo. Una copia tiene una lista de escrituras, cada una con su ruta, si el archivo existía y
  qué contenido tendría.
- **Respaldo**: lo que queda en `.evol/respaldos/<id>/` antes de que `evol agents` aplique una
  copia. Un respaldo tiene un identificador (la fecha), un manifiesto (`manifest.json`) con, por
  archivo, su ruta relativa, si existía, su suma y su modo, y los bytes de lo que existía. Se
  conservan los 10 últimos.
- **Regla de bloqueo**: una entrada de la lista de permisos que `evol agents` instala en el IDE,
  con un patrón de ruta o de comando y un efecto (`deny`). Una regla de bloqueo es **impuesta**
  cuando el IDE la hace cumplir de verdad (un permiso, un hook `PreToolUse`) o **declarativa**
  cuando es solo una instrucción de texto que un agente podría ignorar.
- **Protección de convivencia**: lo que `evol doctor` informa sobre la configuración de otro
  framework de agentes que encuentra a nivel global: un hallazgo tiene un tipo (hook, plugin,
  estilo, permiso, agente por defecto, **servidor MCP**), si es anulable desde el proyecto, y su
  clasificación (impuesta, declarativa o no anulable). Un servidor MCP, además, tiene un transporte
  (local o remoto): uno remoto se marca como una salida de datos, no solo como configuración.
- **Agente «evol»**: la entrada que `evol agents` crea en la configuración de un IDE (OpenCode,
  Claude Code) para que el orquestador de evol tenga nombre e identidad propios: un modo (primario),
  una descripción, un conjunto de permisos propios y, si el IDE lo permite, el agente por defecto
  del proyecto.
- **Procedencia de una versión**: lo que `evol release` publica además de la etiqueta firmada:
  las sumas de los archivos publicados, un listado de componentes (SBOM) y la firma de las sumas.
  Una versión tiene procedencia completa o, con `--sin-sbom`, procedencia sin listado de
  componentes (registrado como tal).
- **Aviso de versión nueva**: lo que `evol doctor` guarda en caché sobre la última versión firmada
  disponible que es más nueva que la instalada, con cuándo se consultó por última vez y qué skills
  perderían la aprobación al actualizar.
- **Ciclo del pipeline**: una vuelta completa de briefing a retro. Un proyecto tiene uno o más
  ciclos, numerados desde 0; cada ciclo tiene las fases que completó y el tramo del registro de
  aprobaciones que le pertenece.

## Reglas

- Una regla de bloqueo que protege una ruta del sistema (`~/.ssh`, `~/.aws/credentials`, la clave
  del gate) nunca se puede anular desde la configuración de un proyecto.
- Un respaldo no se borra mientras existan menos de 10 más nuevos que él.
- `evol agents --deshacer` solo borra un archivo que creó si sus bytes actuales coinciden con los
  que evol escribió; si no coinciden, lo deja y lo informa como acción manual.
- Una protección de convivencia que el IDE no deja anular desde el proyecto se informa siempre como
  «no anulable», nunca se intenta forzar.
- El agente «evol» de un IDE nunca tiene permiso para ejecutar `evol approve`, `evol next` ni
  `evol ciclo nuevo`.
- Una versión sin SBOM (`--sin-sbom`) nunca se confunde con una versión con procedencia completa:
  `release.json` deja constancia de cuál es.
- El aviso de versión nueva nunca dispara una consulta de red más de una vez al día, y nunca
  retrasa un comando que no la pidió explícitamente.
- Un ciclo nuevo solo lo abre una persona en una terminal, nunca un agente ni una herramienta
  automatizada; abrirlo no invalida ni reescribe el registro de aprobaciones de los ciclos
  anteriores.
