Feature: Saber cuándo hay una versión nueva
  Quien usa evol se entera, sin pedirlo, de que hay una versión nueva firmada, sin que
  eso le retrase el trabajo ni le envíe nada a ningún servidor.

  @CA-145
  Scenario: doctor avisa de una versión nueva firmada
    Given una versión 0.4.0 publicada y firmada, más nueva que la instalada
    When la persona ejecuta "evol doctor"
    Then el aviso nombra la versión nueva y el comando "evol update"
    And nombra las skills que perderían la aprobación al actualizar

  @CA-145
  Scenario: el aviso no se repite más de una vez al día
    Given que "evol doctor" ya avisó de la versión nueva hace una hora
    When la persona ejecuta "evol doctor" otra vez
    Then no se hace una consulta de red nueva
    And se usa el aviso guardado en caché

  @CA-145
  Scenario: sin red, evol doctor no falla ni se retrasa
    Given que no hay conexión de red
    When la persona ejecuta "evol doctor"
    Then el comando termina en menos de 6 segundos
    And el resto del informe de doctor se muestra igual

  @CA-145
  Scenario: la persona puede apagar el aviso
    Given la configuración de usuario con "actualizaciones.aviso" en "false"
    When la persona ejecuta "evol doctor"
    Then no aparece ningún aviso de versión nueva
