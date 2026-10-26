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

---

# Dominio — Ciclo 2

> Vocabulario nuevo de este ciclo. Lo que ya existe (fase, disciplina, rol, aprobación, ciclo,
> skill, criterio, escenario) no se repite.

## Entidades

- **Dominio técnico**: una parte separable del sistema (`db`, `api`, `auth`…). Tiene una carpeta
  `docs/proyecto/<dominio>/`.
- **Subdominio**: una unidad técnica que un agente puede implementar o consultar sin leer otra. Tiene
  exactamente un documento de dominio dentro de la carpeta de su dominio.
- **Documento de dominio**: el archivo `.md` de un subdominio. Tiene un `Origen:` (la ruta del
  archivo del que sale: la especificación, una decisión, un dossier) y un contenido mínimo.
- **Índice de dominios**: `docs/proyecto/INDEX.md`. Enlaza todos los documentos de dominio; es el
  único lugar donde se ve el mapa completo.
- **Origen**: la línea `Origen: <ruta>` de un documento. Lo que evol comprueba es que la ruta exista
  dentro del proyecto, no que el documento diga lo que el origen dice.
- **Tema**: un asunto investigado, con carpeta propia `investigacion/<tema>/`.
- **Dossier**: el conjunto de documentos de un tema: auditoría, índice de evidencia y, si hacen
  falta, matriz de capacidades y modelo de amenazas.
- **Fuente**: una entrada del índice de evidencia, con identificador `E-n`, lo que se consultó, la
  fecha de consulta y una clasificación.
- **Clasificación**: el grado de certeza de lo que aporta una fuente. Vocabulario cerrado:
  **hecho** (comprobado en la fuente primaria), **supuesto** (se da por cierto sin comprobarlo) y
  **contradicción** (dos fuentes se contradicen).
- **Cita**: la marca `[E-n]` dentro de un documento del dossier. Una cita es **huérfana** si su
  fuente no está en el índice; una fuente es **sin citar** si ningún documento del tema la cita.
- **Requisito no funcional (NFR)**: una fila de `NO_FUNCIONALES.md` con identificador `NFR-n`,
  métrica, umbral y validación (cómo se comprueba).
- **Limitación conocida**: una restricción aceptada a sabiendas, `Ln`, con razón, impacto y roadmap.
  No es una amenaza de seguridad (esas viven en `THREATS.md`).
- **Término**: una entrada del glosario; su nombre se compara sin distinguir mayúsculas ni tildes.
- **Historia**: una unidad de trabajo `HU-n` con sus cuatro documentos y un checklist de tareas.
- **Checklist**: la lista de tareas atómicas de una historia; cada tarea está marcada o sin marcar.
- **Sprint**: un lote de historias con identificador, título y, al cerrarse, su memoria y sus
  lecciones.
- **Sprint cerrado**: aquel en que todas las tareas de los checklists de sus historias están
  marcadas, y hay al menos una. Un sprint sin tareas o con alguna sin marcar está **abierto**.
- **Hallazgo de documentación**: lo que un comprobador informa de un archivo, con su ruta, su mensaje
  y su nivel.
- **Nivel de un hallazgo**: **bloqueo** (hace fallar el comando y bloquea la fase) o **aviso** (se
  informa, el comando termina bien y la fase se puede aprobar; con `--estricto` hace fallar).

## Reglas

- Todo documento de dominio está enlazado en el índice, y todo enlace del índice apunta a un
  documento que existe: la trazabilidad se comprueba en las dos direcciones.
- Un identificador de fuente (`E-n`), de requisito (`NFR-n`), de limitación (`Ln`), de historia
  (`HU-n`) o de sprint no se repite dentro de su documento.
- Una cita huérfana, una fuente sin fecha, una clasificación fuera del vocabulario o una fecha de
  consulta futura bloquean; una fuente sin citar solo avisa.
- Un sprint abierto nunca exige memoria ni lecciones; uno cerrado las exige siempre.
- Un comprobador nunca lee fuera de la raíz del módulo (no del proyecto: en un monorepo la raíz es la
  de cada módulo), nunca ejecuta lo que lee y nunca cita el **contenido** de un documento.
- Un **nombre** (ruta, identificador, término) sí puede salir en un mensaje, saneado y truncado; el
  contenido (frases, celdas, valores) no.
- Un tope superado (tamaño, cantidad, profundidad) bloquea: un documento demasiado grande no se da
  por bueno.
- Fuera de la raíz, «no existe» y «no se puede resolver» dan el mismo mensaje.
- Todo archivo que lee un comprobador es artefacto de su disciplina: cambiarlo tras aprobar la fase
  invalida la aprobación.
- Un aviso nunca impide aprobar una fase; solo `--estricto` lo convierte en fallo.
- Las disciplinas nuevas no cambian los proyectos que ya existen: un perfil solo se aplica al crear
  o adoptar un proyecto.
- Una disciplina con comprobación de documentos no admite remapear sus rutas (limitación L1).
