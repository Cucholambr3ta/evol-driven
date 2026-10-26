Feature: Adoptar la exigencia poco a poco
  Quien ya usa evol en un proyecto no ve sus fases bloqueadas de golpe por una exigencia nueva de
  documentación; los proyectos nuevos sí nacen con ella.

  @CA-154
  Scenario: un documento muy corto avisa y con --estricto falla
    Given un documento de dominio con muy pocas líneas y otro con contenido suficiente
    When la persona ejecuta "evol docs check"
    Then el informe avisa solo del documento corto y el comando termina bien
    When la persona ejecuta "evol docs check --estricto"
    Then el comando falla y nombra el documento corto

  @CA-155
  Scenario: con solo avisos pendientes la fase se puede aprobar
    Given un proyecto con la disciplina ADD activa y un ADR al que le falta la sección "Referencias"
    When la persona ejecuta "evol verify"
    Then el veredicto es WARN y no BLOCK
    And la fase se puede aprobar

  @CA-156
  Scenario: un proyecto nuevo con el perfil base trae las disciplinas nuevas
    When la persona ejecuta "evol init --perfil base" en un proyecto
    Then su configuración activa 14 disciplinas
    And entre ellas están "ADD", "GRANULAR", "INVESTIGACION", "REQDD" y "SPRINTDD"

  @CA-156
  Scenario: los perfiles lib y script y un proyecto creado antes no cambian
    Given los perfiles "lib" y "script"
    And un proyecto creado antes con las 9 disciplinas base
    Then los perfiles conservan su lista de siempre
    And el proyecto creado antes no tiene activa ninguna de las disciplinas nuevas
