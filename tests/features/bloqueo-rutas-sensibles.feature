Feature: Rutas sensibles bloqueadas por defecto
  Quien instala evol en un proyecto tiene, sin configurar nada, las credenciales del
  sistema fuera del alcance del agente.

  @CA-134
  Scenario: el agente no puede leer la clave privada del usuario
    Given un proyecto con evol instalado por "evol agents"
    When el agente intenta leer "~/.ssh/id_ed25519"
    Then el IDE deniega la lectura por la regla de permisos que evol instaló

  @CA-134
  Scenario: el agente no puede editar el estado del gate
    Given un proyecto con evol instalado por "evol agents"
    When el agente intenta editar ".evol/gate-log.jsonl"
    Then el IDE deniega la edición

  @CA-134
  Scenario: el agente no puede leer la clave del gate
    Given un proyecto con evol instalado por "evol agents"
    When el agente intenta leer "~/.config/evol/keys/<projectId>"
    Then el IDE deniega la lectura, porque quien lee esa clave puede falsificar aprobaciones

  @CA-134
  Scenario: alterar el estado del pipeline por fuera se detecta
    Given un proyecto con una aprobación válida de la fase "briefing"
    When alguien edita ".evol/state.json" a mano para simular una fase ya aprobada
    When la persona ejecuta "evol doctor"
    Then el aviso dice que la fase del estado no concuerda con el registro firmado de aprobaciones
