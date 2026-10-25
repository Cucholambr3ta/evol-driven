Feature: Escribir con copia, ensayo y vuelta atrás
  Quien ejecuta "evol agents" puede ver antes qué se va a escribir, y deshacerlo
  después sin perder lo que había editado a mano.

  @CA-132
  Scenario: --dry-run no escribe nada
    Given un proyecto adoptado con evol, sin archivos de agentes todavía
    When la persona ejecuta "evol agents --dry-run"
    Then la salida lista los archivos que se crearían o cambiarían
    And ningún archivo del proyecto cambia de fecha ni de contenido

  @CA-133
  Scenario: deshacer devuelve exactamente lo que había
    Given un proyecto donde "evol agents" ya escribió "CLAUDE.md" y ".claude/settings.json"
    When la persona ejecuta "evol agents --deshacer"
    Then "CLAUDE.md" y ".claude/settings.json" vuelven a su contenido anterior
    And queda una copia de lo que había antes de deshacer, por si hace falta

  @CA-133
  Scenario: deshacer no pisa un archivo que la persona editó después
    Given un proyecto donde "evol agents" escribió "CLAUDE.md"
    And la persona editó "CLAUDE.md" a mano después de esa escritura
    When la persona ejecuta "evol agents --deshacer"
    Then "CLAUDE.md" conserva la edición de la persona
    And la salida avisa de que ese archivo no se tocó porque cambió desde que evol lo escribió
