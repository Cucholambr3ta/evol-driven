Feature: Instrucciones correctas según el repositorio
  Quien trabaja en el propio repositorio de evol ve una instrucción que tiene sentido
  ahí, en vez de la instrucción genérica para proyectos que usan evol desde fuera.

  @CA-148
  Scenario: en el repositorio de evol, la instrucción invita a mejorarlo
    Given el propio repositorio de evol-driven
    When la persona ejecuta "evol agents"
    Then "AGENTS.md" dice que este repositorio es el origen del framework y se puede editar

  @CA-148
  Scenario: en un proyecto cualquiera, la instrucción sigue prohibiendo tocar el framework
    Given un proyecto distinto de evol-driven
    When la persona ejecuta "evol agents"
    Then "AGENTS.md" dice que no se debe modificar el framework evol desde ese proyecto
