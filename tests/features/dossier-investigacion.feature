Feature: Dossier de investigación con índice de evidencia
  Quien pide investigar algo obtiene una carpeta por tema donde cada afirmación se puede rastrear
  hasta una fuente con fecha y con su grado de certeza.

  @CA-157
  Scenario: un dossier consistente pasa la comprobación
    Given un tema "hermes" con un índice de evidencia de fuentes con fecha y clasificación
    And una auditoría que cita solo fuentes del índice
    When la persona ejecuta "evol docs evidencia"
    Then el comando termina bien

  @CA-158
  Scenario: una fuente sin fecha o con una clasificación inválida se nombra
    Given una fuente "E-2" sin fecha de consulta
    And una fuente "E-3" clasificada como "quizás"
    When la persona ejecuta "evol docs evidencia"
    Then el comando falla
    And el informe nombra "E-2" y "E-3" y no nombra la fuente válida "E-1"

  @CA-159
  Scenario: una cita a una fuente que no existe se rechaza
    Given una auditoría que cita "[E-9]" y un índice que solo llega a "E-3"
    When la persona ejecuta "evol docs evidencia"
    Then el comando falla
    And el informe nombra la cita "E-9"

  @CA-160
  Scenario: sin índice de evidencia, la investigación no pasa el briefing
    Given la disciplina "INVESTIGACION" activa y un tema con auditoría pero sin índice de evidencia
    When la persona ejecuta "evol verify"
    Then el veredicto es BLOCK
    And el informe habla del índice de evidencia

  @CA-160
  Scenario: con índice y auditoría consistentes, la investigación sí pasa
    Given la disciplina "INVESTIGACION" activa y un tema con índice de evidencia y auditoría consistentes
    When la persona ejecuta "evol verify"
    Then el veredicto es PASS

  @CA-160
  Scenario: la disciplina de investigación la aplica el analista
    When la persona consulta las disciplinas con "evol disciplines list --json"
    Then "INVESTIGACION" figura con el rol "analista"
