# Lecciones

### Una prueba de aceptación que invoca el CLI puede no probar lo que dice probar — 2026-10-25

Dos criterios de la ola 1 (CA-142/CA-144 sobre evol release, y CA-148 sobre evol agents) se escribieron en el briefing invocando el CLI compilado con cli([...]) y asumiendo que el comando operaría sobre el proyecto de prueba (cwd). En los dos casos la opción por defecto hacía que la prueba, aun en verde o en rojo por el motivo equivocado, no ejerciera el camino que decía ejercer: evol release siempre publica el origen real del framework (packageRoot(), que ignora cwd), y evol agents sin --ide solo escribe los archivos de Claude Code, nunca AGENTS.md. Las dos se detectaron al construir el módulo, no en el briefing. Cuando una prueba de aceptación invoca el CLI real en vez de llamar a la función directamente, conviene comprobar una vez, a mano, qué toca el comando exactamente con esos argumentos — sobre todo si el comando tiene un alcance especial (solo el origen, solo un IDE por defecto) que no es obvio desde la especificación.

### El binario estable de evol puede no ver una mejora que la propia ola le hizo — 2026-10-25

evol coverage/evol verify, cuando se invocan como evol a secas, usan la copia estable instalada, nunca evol-dev (el checkout en curso), para que el framework que verifica cada fase no cambie bajo los pies de quien lo edita. Eso funciona bien mientras el defecto que se corrige vive fuera de la propia lógica de verificación. Pero el M1 de esta ola corrigió la expresión regular con la que evol coverage reconoce los títulos de prueba (it.skipIf(cond)("CA-n: …", …)); como esa corrección vive en el propio evol, la copia estable —anterior a esta ola— nunca pudo verla, y bloqueó qa con un falso CA-146 sin prueba que la copia evol-dev ya daba por cubierto. No hay una solución general en esta ola (publicar antes de tiempo rompería el orden del pipeline), pero vale la pena recordarlo: cuando el cambio que se construye es a la propia lógica de verificación, conviene comprobar con evol-dev coverage/evol-dev verify antes de dar por bloqueante lo que reporte la copia estable, y documentar la excepción si hace falta aprobar con evol-dev.

### Citar el valor de un secreto de ejemplo en su propio motivo de ignorado genera un hallazgo nuevo — 2026-10-25

Al ignorar en .evol/security-ignore.json un hallazgo de gitleaks sobre una clave AWS de ejemplo («la clave de ejemplo de AWS», usada a propósito en dos pruebas), el primer intento citó el valor exacto de la clave dentro del campo motivo, para explicar por qué era inofensiva. El siguiente escaneo detectó esa misma clave dentro del propio archivo de ignorados (y, encadenado, dentro del reporte de qa que guarda ese motivo), como un hallazgo nuevo sin ignorar. La explicación de un secreto de ejemplo no debe repetir el valor exacto: alcanza con decir qué es y por qué no es real.

### Un comprobador que lee documentos ajenos necesita pruebas con entradas hostiles desde el primer día — 2026-10-26

Los comprobadores de `evol docs` pasaron sus pruebas de aceptación y unitarias, y aun así tenían defectos que solo aparecieron al probar entradas adversas: una línea de corchetes volvía cuadrático y agotaba la memoria a `enlaces()`, una tabla con decenas de miles de columnas lo colgaba, y un enlace simbólico en una carpeta del camino (no en el archivo) se seguía fuera de la raíz. La revisión independiente añadió el tope total de lectura que el SPEC exigía y el código no tenía. Para el próximo comprobador que lea contenido de la persona: escribir primero las pruebas de límites (tamaño, líneas, tablas, enlaces simbólicos en cualquier componente) y comprobar cada regla del SPEC contra una prueba antes de dar el módulo por terminado.

### Un límite de tiempo absoluto en una prueba falla de forma intermitente bajo carga — 2026-10-26

CA-145 pedía que `evol doctor` sin red terminara en menos de 6 s. A solas tarda unos 2 s, pero dentro de `npm run ci` (la suite en paralelo) llegó a 6,2 s y bloqueó la aprobación de build. Lo que el criterio limita es el retraso que añade el aviso: la prueba ahora lo mide contra el mismo `doctor` con el aviso apagado. Regla: una prueba de rendimiento compara contra una línea base medida en la misma ejecución, no contra un número fijo.

### Comprobadores de documentos: pruebas hostiles primero — 2026-10-26

Los comprobadores de evol docs pasaron aceptación y unitarias pero tenían defectos reales (enlaces() cuadrático, tablas anchas sin tope, enlaces simbólicos en carpetas del camino, tope total de 5 MiB ausente). Escribir antes las pruebas de límites y de enlaces simbólicos en cualquier componente de la ruta.

### Pruebas de rendimiento contra una base medida — 2026-10-26

CA-145 (doctor sin red < 6 s) fallaba de forma intermitente bajo la carga de npm run ci; se mide el retraso del aviso contra doctor con el aviso apagado, no un tiempo absoluto.
