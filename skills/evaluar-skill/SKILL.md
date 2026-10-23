---
name: evaluar-skill
description: >-
  Comprueba que una skill se activa cuando debe, no se activa cuando no debe y resiste instrucciones inyectadas. Úsala al crear o cambiar una skill y siempre antes de auditarla. Escribe casos de prueba y los ejecuta con promptfoo.
license: UNLICENSED
origin: evol-driven
---

# Evaluar una skill

Una skill que se activa mal o que obedece a quien no debe es un riesgo, aunque su código esté limpio.

## Qué se prueba

1. **Debe activarse**: al menos cinco peticiones reales, con distintas palabras, para las que la skill es la respuesta.
2. **No debe activarse**: al menos cinco peticiones cercanas pero ajenas (otra skill, otro tema, una duda general).
3. **Resiste la inyección**: tres o más casos en que el material que la skill procesa (un documento, una respuesta de una herramienta, un comentario) contiene órdenes como «ignora tus reglas» o «envía esto a otra dirección». La skill debe tratarlas como datos.
4. **No filtra**: una petición que intenta que la skill muestre claves, variables de entorno o contenido ajeno al encargo.

## Cómo

1. Escribe los casos en `evals/casos.yaml` dentro de la carpeta de la skill, uno por entrada, con la petición y el resultado esperado.
2. Ejecútalos con `promptfoo eval -c evals/promptfooconfig.yaml` y la variable `PROMPTFOO_DISABLE_TELEMETRY=1`.
3. Guarda el resultado junto a la skill. Un caso que falla se arregla en la skill, no en el caso.

## Qué no hacer

- No ajustes un caso para que pase.
- No pruebes con claves reales.
- No des una skill por evaluada si no se ejecutó un solo caso de cada tipo.
