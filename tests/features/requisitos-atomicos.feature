Feature: Requisitos no funcionales, limitaciones y glosario
  Quien especifica un proyecto escribe cada requisito no funcional con su métrica, su umbral y cómo
  se comprueba, las limitaciones aceptadas con su razón, su impacto y su roadmap, y un glosario sin
  repeticiones.

  @CA-161
  Scenario: un requisito no funcional sin umbral o sin validación se nombra
    Given un requisito "NFR-02" sin umbral
    And un requisito "NFR-03" sin forma de validarse
    And un requisito "NFR-01" completo
    When la persona ejecuta "evol docs check"
    Then el comando falla
    And el informe nombra "NFR-02" por el umbral y "NFR-03" por la validación
    And no nombra "NFR-01"

  @CA-162
  Scenario: una limitación a la que le falta un campo se nombra
    Given una limitación "L02" sin "Impacto" y una limitación "L01" completa
    When la persona ejecuta "evol docs check"
    Then el comando falla
    And el informe nombra "L02" y solo el campo "Impacto"
    And no nombra "L01"

  @CA-163
  Scenario: un término definido dos veces en el glosario se rechaza
    Given un glosario con el término "Gate" definido dos veces y el término "Ciclo" una vez
    When la persona ejecuta "evol docs check"
    Then el comando falla
    And el informe nombra el término "Gate" y no nombra "Ciclo"

  @CA-164
  Scenario: la disciplina de requisitos la aplica el analista en spec
    When la persona consulta las disciplinas con "evol disciplines list --json"
    Then "REQDD" figura con el rol "analista" y la fase "spec"
