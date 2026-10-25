Feature: Seguir trabajando en un segundo ciclo
  Quien terminó un ciclo completo del pipeline puede abrir el siguiente sin perder el
  historial de aprobaciones del anterior.

  @CA-146
  Scenario: las aprobaciones de un ciclo anterior no cuentan en el nuevo
    Given un proyecto que terminó un ciclo (fase "done") y abrió uno nuevo con "evol ciclo nuevo"
    When la persona consulta el estado de la fase "briefing" del ciclo nuevo
    Then no aparece como aprobada, aunque el ciclo anterior sí la tenía aprobada

  @CA-146
  Scenario: la cadena de aprobaciones del ciclo anterior sigue siendo válida
    Given un proyecto que abrió un segundo ciclo con "evol ciclo nuevo"
    When la persona ejecuta "evol verify --cadena"
    Then el registro firmado completo, del primer ciclo y del segundo, verifica sin errores

  @CA-147
  Scenario: el agente no puede abrir un ciclo nuevo
    Given un proyecto en la fase "done"
    When el agente intenta ejecutar "evol ciclo nuevo" sin que la persona esté en la terminal
    Then el comando se rechaza

  @CA-147
  Scenario: el MCP no ofrece abrir un ciclo nuevo
    Given un proyecto en la fase "done"
    When la persona revisa las herramientas que ofrece el MCP "evol"
    Then ninguna herramienta permite abrir un ciclo nuevo
