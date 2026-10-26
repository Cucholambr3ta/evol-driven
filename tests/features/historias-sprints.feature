Feature: Historias y sprints con su propia evidencia
  Quien parte el desarrollo en sprints tiene por cada historia su propuesta, sus escenarios, su
  escenario técnico y su checklist, y por cada sprint su memoria y sus lecciones, escritas mientras
  se trabaja. Un sprint está cerrado cuando todas las tareas de sus checklists están marcadas.

  @CA-167
  Scenario: un sprint que apunta a una historia que no existe se rechaza
    Given un índice de sprints que incluye la historia "HU-9"
    And no existe la carpeta "docs/historias/HU-9"
    When la persona ejecuta "evol sprint check"
    Then el comando falla
    And el informe nombra "HU-9"

  @CA-168
  Scenario: el estado de un sprint cuenta las tareas marcadas
    Given un sprint "01" cuyo checklist tiene 5 tareas y 3 marcadas
    When la persona ejecuta "evol sprint estado"
    Then el sprint "01" aparece con 3 de 5 tareas marcadas

  @CA-169
  Scenario: un sprint terminado sin memoria ni lecciones está incompleto
    Given un sprint "01" con todas sus tareas marcadas
    And sin "docs/sprints/01/lecciones.md" ni "docs/sprints/01/memoria.md"
    When la persona ejecuta "evol sprint check"
    Then el sprint "01" se reporta como incompleto
    And el informe nombra los dos archivos que faltan

  @CA-169
  Scenario: un sprint todavía abierto no exige memoria ni lecciones
    Given un sprint "02" con 3 de 5 tareas marcadas y sin memoria ni lecciones
    When la persona ejecuta "evol sprint check"
    Then el comando termina bien

  @CA-170
  Scenario: la disciplina de historias y sprints la aplica el analista en plan
    When la persona consulta las disciplinas con "evol disciplines list --json"
    Then "SPRINTDD" figura con el rol "analista" y la fase "plan"
