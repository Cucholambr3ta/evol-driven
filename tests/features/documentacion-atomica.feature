Feature: Documentación atómica por dominio
  Quien termina el spec de un proyecto puede partirlo en una carpeta por dominio técnico, con un
  documento por subdominio y un índice que los une, y evol comprueba que todo cuadra.

  @CA-150
  Scenario: un árbol consistente pasa la comprobación
    Given un proyecto con "docs/proyecto/db/esquemas.md" y "docs/proyecto/INDEX.md" que lo enlaza
    And el documento declara su origen en un archivo que existe
    When la persona ejecuta "evol docs check"
    Then el comando termina bien

  @CA-151
  Scenario: un documento fuera del índice y un enlace roto se nombran los dos
    Given un documento "docs/proyecto/api/errores.md" que el índice no enlaza
    And un enlace del índice a "db/relaciones.md" que no existe
    When la persona ejecuta "evol docs check"
    Then el comando falla
    And el informe nombra "api/errores.md" y "db/relaciones.md"

  @CA-152
  Scenario: un documento que no dice de dónde sale se rechaza
    Given un documento de dominio sin la línea "Origen:"
    When la persona ejecuta "evol docs check"
    Then el comando falla
    And el informe nombra el documento

  @CA-152
  Scenario: un origen que apunta a un archivo que no existe se rechaza
    Given un documento de dominio con "Origen: docs/specs/NO-EXISTE.md"
    When la persona ejecuta "evol docs check"
    Then el comando falla
    And el informe nombra el documento y el origen "NO-EXISTE.md"

  @CA-153
  Scenario: la disciplina de documentación atómica la aplica el arquitecto en spec
    When la persona consulta las disciplinas con "evol disciplines list --json"
    Then "GRANULAR" figura con el rol "arquitecto" y la fase "spec"
