---
name: revisar-secretos
description: >-
  Busca secretos (claves, tokens, contraseñas) en el código antes de dar por cerrada una tarea. Úsala al terminar cada tarea de código en build y en qa, o cuando alguien pregunte si se coló una clave. No muestra nunca el valor encontrado.
license: UNLICENSED
origin: evol-driven
---

# Revisar secretos

Una clave que llega al repositorio hay que darla por comprometida, aunque se borre después: queda en el historial.

## Cuándo

- Al cerrar cada tarea de código de la fase build.
- En qa, antes de dar el visto bueno.
- Cuando se añade un archivo de configuración, un ejemplo o un script.

## Cómo

1. Ejecuta `evol security scan --solo secretos`.
   - Si ese comando todavía no existe en esta instalación, usa `gitleaks dir . --redact --no-banner --report-format json --report-path <archivo temporal fuera del proyecto>`. Sin `gitleaks` instalado, dilo y no des la revisión por hecha.
2. Lee solo la regla, el archivo y la línea de cada hallazgo. **No abras ni copies el valor**: ni en el chat, ni en un commit, ni en la memoria.
3. Por cada hallazgo real:
   - Pide a la persona que **rote la clave** en el servicio de origen. Es lo primero y no es opcional.
   - Quita el valor del código y léelo de una variable de entorno o de un gestor de secretos.
   - Si ya se subió, avisa de que hay que reescribir el historial y que eso lo decide la persona.
   - Anota la lección en la retro.
4. Un falso positivo no se ignora a mano: se registra en `.evol/security-ignore.json` con motivo, responsable y fecha de caducidad.

## Qué no hacer

- No pegues el secreto «para que se vea el problema».
- No des por buena una revisión que no se ejecutó.
- No desactives la regla para que pase.
