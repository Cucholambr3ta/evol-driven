---
description: "Mide el alcance de un cambio antes de editar un símbolo"
argument-hint: "<símbolo>"
---

<!-- evol:generated -->

Antes de modificar `$ARGUMENTS`, ejecuta `evol impact $ARGUMENTS` (o la herramienta `evol_impact`).

Resume qué depende de él, directa y transitivamente, y qué tests lo cubren. Propón qué pruebas
ejecutar después del cambio. Si el nombre es ambiguo, usa el id completo que devuelve `evol`.
