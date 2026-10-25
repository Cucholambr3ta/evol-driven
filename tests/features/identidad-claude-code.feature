Feature: Identidad propia en Claude Code
  Quien abre un proyecto con evol en Claude Code ve un estilo y una línea de estado
  propios de evol.

  @CA-140
  Scenario: el proyecto abre con el estilo de evol
    Given un proyecto donde la persona ejecutó "evol agents"
    When la persona abre Claude Code dentro de ese proyecto
    Then el estilo de salida activo es "Evol"
    And la línea de estado muestra la fase actual del pipeline

  @CA-141
  Scenario: deshacer retira el estilo y la línea de estado
    Given un proyecto donde "evol agents" configuró el estilo "Evol"
    When la persona ejecuta "evol agents --deshacer"
    Then ".claude/settings.json" del proyecto ya no tiene "outputStyle" ni "statusLine" de evol
