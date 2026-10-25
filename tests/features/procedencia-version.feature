Feature: Procedencia verificable de cada versión
  Quien instala o actualiza evol puede comprobar qué contiene exactamente una versión
  y que nada se alteró desde que se publicó.

  @CA-142
  Scenario: el release incluye las sumas, el SBOM y la firma
    Given el repositorio de evol listo para publicar
    When la persona ejecuta "evol-dev release 0.4.0"
    Then la etiqueta incluye "release/SUMAS.txt", "release/sbom.spdx.json" y "release/SUMAS.txt.sig"

  @CA-143
  Scenario: update rechaza una suma alterada
    Given una versión publicada cuyo "release/SUMAS.txt" no coincide con los archivos reales
    When la persona ejecuta "evol update"
    Then la instalación se rechaza
    And el mensaje dice qué archivo no coincide

  @CA-143
  Scenario: update rechaza una firma inválida
    Given una versión publicada con una firma que no corresponde a la clave permitida
    When la persona ejecuta "evol update"
    Then la instalación se rechaza
    And ninguna opción de "evol update" permite saltarse esa comprobación

  @CA-144
  Scenario: --sin-sbom queda registrado
    Given el repositorio de evol sin "syft" instalado
    When la persona ejecuta "evol-dev release 0.4.0 --sin-sbom"
    Then el release se publica sin SBOM
    And el registro de la versión deja constancia de que se publicó sin SBOM
