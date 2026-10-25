Feature: Las reglas del proyecto por encima de las globales
  Quien usa evol junto con otro framework de agentes instalado en su cuenta puede
  confiar en que, dentro del proyecto, mandan las reglas de evol.

  @CA-135
  Scenario: aislar el proyecto no toca nada fuera de él
    Given un usuario con configuración global de otro framework de agentes
    When la persona ejecuta "evol agents" en un proyecto nuevo
    Then los archivos de la carpeta personal del usuario no cambian de hash
    And el proyecto gana su propia sección de reglas en "CLAUDE.md" y en ".claude/settings.json"

  @CA-135
  Scenario: solo se apagan los plugins que de verdad están activados
    Given un usuario sin ningún plugin de agentes activado globalmente
    When la persona ejecuta "evol agents" en un proyecto nuevo
    Then ".claude/settings.json" del proyecto no incluye "enabledPlugins"

  @CA-136
  Scenario: doctor detecta un hook global que no se puede anular
    Given un usuario con un hook global de otro framework instalado
    When la persona ejecuta "evol doctor"
    Then el informe de convivencia nombra ese hook como «no anulable: solo se informa»

  @CA-136
  Scenario: doctor detecta el modo de permisos sin confirmación activo
    Given un usuario con "permissions.defaultMode" en "bypassPermissions" a nivel global
    When la persona ejecuta "evol doctor"
    Then el informe de convivencia avisa de que el modo efectivo ejecuta todo sin preguntar

  @CA-136
  Scenario: doctor marca cada protección como impuesta o declarativa
    Given un proyecto con evol instalado
    When la persona ejecuta "evol doctor"
    Then cada regla de la lista de bloqueo aparece marcada como «impuesta» o «declarativa»

  @CA-149
  Scenario: doctor lista los servidores MCP activos y marca los remotos
    Given un usuario con un servidor MCP remoto activado globalmente
    When la persona ejecuta "evol doctor"
    Then el informe de convivencia lista ese servidor con su transporte
    And lo marca como una salida de datos, por ser remoto
