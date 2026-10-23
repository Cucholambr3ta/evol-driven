---
name: incorporar-dependencia
description: >-
  Decide si se puede añadir o actualizar una dependencia (npm, PyPI u otra) y deja la justificación escrita. Úsala en plan y en build cada vez que aparezca un paquete nuevo o una subida de versión. Revisa necesidad, versión fija, vulnerabilidades, paquetes maliciosos, licencia y mantenimiento.
license: UNLICENSED
origin: evol-driven
---

# Incorporar una dependencia

Cada dependencia es código de otra persona que se ejecuta con tus permisos. La mejor es la que no hace falta.

## Orden de preguntas

1. **¿Hace falta?** Mira si lo cubre la biblioteca estándar o algo ya instalado. Si son pocas líneas, escríbelas.
2. **¿Es el paquete que crees?** Comprueba el nombre exacto, el repositorio de origen y que no sea una copia con el nombre parecido (typosquatting).
3. **¿Está vivo?** Última versión, mantenedores, si sigue publicándose. Un paquete abandonado es una deuda.
4. **¿Qué licencia tiene?** Debe ser compatible con la del proyecto. Una licencia ausente es un no.
5. **¿Tiene vulnerabilidades conocidas?** Ejecuta `osv-scanner` sobre el archivo de bloqueo. Una vulnerabilidad alta o crítica sin arreglo bloquea la entrada.
6. **¿Es malicioso?** Para npm y PyPI ejecuta `guarddog npm scan <paquete>` o `guarddog pypi scan <paquete>` (`verify` revisa una carpeta local, no un nombre de paquete). Si el paquete ya está descargado, `guarddog pypi verify <carpeta>`. Un aviso hay que leerlo, no descartarlo.
7. **¿Quedó fijada?** Versión exacta y archivo de bloqueo en el repositorio. Sin esas dos cosas no entra.

## Resultado

Escribe en el ADR del cambio: qué paquete y versión, para qué, qué alternativas se descartaron y el resultado de cada comprobación. Si algo no se pudo comprobar (falta una herramienta, no hay red), dilo en el ADR en lugar de omitirlo.

## Qué no hacer

- No uses rangos abiertos (`^`, `latest`, `>=`) en lo que entra al proyecto.
- No ejecutes scripts de instalación de un paquete que aún no has revisado.
- No ignores un aviso sin motivo escrito.
