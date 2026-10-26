Feature: Decisiones de arquitectura con sus referencias
  Quien activa la disciplina de decisiones ve avisados los registros que no enlazan la decisión con
  su evidencia ni dicen qué opciones se descartaron.

  @CA-165
  Scenario: un ADR sin la sección de referencias se avisa
    Given un proyecto con la disciplina ADD activa
    And un ADR sin la sección "Referencias"
    When la persona ejecuta "evol verify"
    Then el informe avisa del ADR
    And pide enlazarlo a su implementación y a sus pruebas

  @CA-166
  Scenario: un ADR sin opciones o sin consecuencias se avisa
    Given un proyecto con la disciplina ADD activa
    And un ADR sin la sección "Opciones", otro sin "Consecuencias" y otro completo
    When la persona ejecuta "evol verify"
    Then el informe avisa del primero solo por "Opciones" y del segundo solo por "Consecuencias"
    And no nombra el ADR completo
