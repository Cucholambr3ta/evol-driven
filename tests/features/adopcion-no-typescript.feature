Feature: Adoptar un proyecto que no es TypeScript
  Quien tiene un proyecto en Python o en shell puede adoptarlo con evol y que las
  disciplinas de pruebas reconozcan sus propias pruebas, sin remapear nada a mano.

  @CA-128
  Scenario: evol init detecta un proyecto Python y remapea sus rutas de pruebas
    Given una carpeta con un "pyproject.toml" y pruebas en "tests/unit/test_*.py"
    When la persona ejecuta "evol init --perfil base --name mi-proyecto"
    Then "evol.config.json" tiene el comando de TDD en Python
    And la ruta de TDD apunta a "tests/unit/test_*.py"

  @CA-128
  Scenario: --lenguaje manda sobre la detección automática
    Given una carpeta con un "pyproject.toml" y también un archivo "*.sh"
    When la persona ejecuta "evol init --perfil base --name mi-proyecto --lenguaje shell"
    Then "evol.config.json" usa los comandos y las rutas de shell, no las de Python

  @CA-129
  Scenario: la fase build ejecuta pytest en un proyecto Python
    Given un proyecto adoptado con "evol init --lenguaje python"
    And una prueba "tests/unit/test_ca_200.py" que falla a propósito
    When la persona ejecuta "evol verify build"
    Then el veredicto es "BLOCK"
    And el informe nombra la prueba que falló

  @CA-130
  Scenario: la cobertura reconoce un criterio citado en una prueba de pytest
    Given una prueba "tests/unit/test_ca_200.py" con el nombre "def test_ca_200_rechaza_vacio"
    When la persona ejecuta "evol coverage"
    Then el criterio "CA-200" aparece cubierto

  @CA-130
  Scenario: la cobertura reconoce un criterio citado en una prueba de bats
    Given una prueba "tests/unit/rechaza.bats" con un "@test" que cita "CA-201"
    When la persona ejecuta "evol coverage"
    Then el criterio "CA-201" aparece cubierto

  @CA-131
  Scenario: el perfil script solo exige un escenario de BDD en el briefing
    Given un proyecto adoptado con "evol init --perfil script"
    When la persona consulta "evol disciplines active" en la fase briefing
    Then la única disciplina activa es "BDD"
    And ni "FDD" ni "ATDD" aparecen activas
