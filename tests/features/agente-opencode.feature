Feature: Evol como agente propio en OpenCode
  Quien abre un proyecto con evol en OpenCode lo ve como un agente con nombre propio,
  con sus propios límites.

  @CA-137
  Scenario: el proyecto abre con Evol como agente por defecto
    Given un proyecto donde la persona ejecutó "evol agents"
    When la persona abre OpenCode dentro de ese proyecto
    Then el agente activo por defecto es "evol"
    And su descripción es la del orquestador de evol

  @CA-138
  Scenario: ejecutar evol agents de nuevo no cambia nada
    Given un proyecto donde "evol agents" ya configuró OpenCode
    When la persona ejecuta "evol agents" otra vez, sin cambios en el proyecto
    Then "opencode.json" queda exactamente igual

  @CA-138
  Scenario: deshacer devuelve el agente por defecto anterior
    Given un proyecto donde "opencode.json" tenía otro "default_agent" antes de evol
    And la persona ejecutó "evol agents"
    When la persona ejecuta "evol agents --deshacer"
    Then "opencode.json" vuelve a tener el "default_agent" de antes

  @CA-139
  Scenario: el agente evol no puede aprobar una fase
    Given un proyecto con la fase "briefing" lista para aprobarse
    When el agente "evol" de OpenCode intenta ejecutar "evol approve briefing"
    Then OpenCode deniega el comando por el permiso que evol instaló
