# 03: El prototipo existente `evol-driven-studio` (Etapa 1)

Resumen para el integrador. La fuente autoritativa es el propio `README.md` del prototipo y sus informes en `docs/`. Este resumen **no** los sustituye y no se ha vuelto a ejecutar nada (EV-086).

## Qué es

| Dato | Valor |
|---|---|
| Ruta en el equipo de desarrollo | `~/Projects/evol-driven-studio` |
| Paquete | `@local/evol-driven-studio` 0.1.0, privado, `UNLICENSED`, ESM |
| Tipo | Plugin Host/Client de DSH 0.2.1-rc.2 (`dsh.bundle.patch` + `dsh.client` web, `immediately: true`) |
| Construcción | esbuild + TypeScript; dependencia de runtime: solo `@deepseek-ai/schemastery` 3.18.5; React lo pone el Module Loader del navegador |
| Tamaño | ~4 300 líneas en `src/` |
| Pruebas | `npm test` (`node --test`) **59/59** según el README, además de `tests/closure-audit.mjs` (11 PASS) |
| **Git** | **Sin ningún commit.** Nada está versionado ni publicado |
| Montaje | Enlazado (`link:`) en `~/.dsh/profiles/evol-studio`, el **`DSH_HOME` personal** (EV-087) |

## Estructura

```
src/host/        index.ts (servicio Host y rutas GET /studio/api/*), evolReader.ts (lectura de .evol/),
                 safeFs.ts (aperturas O_NOFOLLOW por descriptor), memoryReader.ts, memoryMcpTransport.ts, ecosystem.ts
src/client/      index.tsx, brand.tsx, ScreenPage.tsx, studioStore.ts, useStudioData.ts
src/contracts/   studio.ts, memory.ts, reserved.ts      ← contratos tipados Host↔Client
src/adapters/    studioApi.ts
src/screens/     18 destinos (Inicio, Proyectos, Pipeline, Aprobaciones, Evidencias, Tareas, Agentes, Documentación,
                 Skills, Memoria, Grafos, Code Intelligence, Repositorio, Modelos, Extensiones EVOL, Recuperación,
                 Diagnósticos, Configuración). Funcionales: Inicio/Dashboard, Proyectos (+ inspector), Configuración
src/design/      tokens.ts      src/navigation/   src/integration/capabilities.ts
scripts/         build.mjs, launch-evol-studio.sh, review-instance.sh, stop-review-instance.sh, validate-isolated.py
docs/            validación final, remediación, protocolo visual, criterio de retirada y credenciales,
                 propuesta de interfaz dedicada, JSON de auditoría
```

## Lo que está bien resuelto y conviene conservar

- **Frontera de lectura segura:**
  - solo GET (405 para cualquier otro método);
  - las raíces salen solo de la configuración del Host (`?roots=` devuelve 400);
  - cada componente de la ruta se abre por descriptor con `O_NOFOLLOW`, rechazando symlinks y hardlinks;
  - presupuestos efectivos (2 MiB por archivo, 1 000 líneas JSONL, 1 MiB de respuesta, 2 lecturas concurrentes);
  - los fallos se cierran y no se devuelve un éxito parcial.
- La autenticación es la de DSH (`connection.requestRejection`), **sin un mecanismo paralelo**.
- La navegación se integra en la barra lateral nativa (`sidebar.panellist`) sin reemplazar el root.
- Se usó la skill `cordis-plugin-development` del preset instalado.

## Lo que está abierto: cierre **NO-GO**

1. **UI real sin verificar:** 0/16 comprobaciones visuales ejecutadas. Faltan CDP autorizado y una pestaña autenticada. Que compile no significa que se vea bien.
2. **Credencial potencialmente expuesta:** el token de lanzamiento de DSH web aparecía en evidencia histórica. Se saneó, pero no se ha decidido si se invalida o si se revocan las cookies (EV-088). Hay que decidirlo **antes** de copiar el repositorio a otro equipo.
3. **Retirar en caliente** falla. El procedimiento soportado es detener → `dsh plugin --profile evol-studio remove @local/evol-driven-studio` → reiniciar.
4. **El aislamiento era insuficiente:** dos perfiles dentro del mismo `DSH_HOME` comparten credenciales, sesiones, storage y skills de usuario.
5. **No se inicia la Etapa 2** hasta cerrar los puntos 1 y 2.

## Cómo llevarlo al equipo nuevo (decisión de la persona; ver doc 05 §D2)

1. Pasar `gitleaks` (o `evol security scan`) sobre el prototipo y revisar a mano `tests/screenshots/*.json` y `docs/*.json`.
2. Añadir un `.gitignore` (`node_modules/`, `lib/`, capturas con datos de sesión), hacer el primer commit y crear su remoto privado. **El push lo hace la persona.**
3. En el equipo nuevo: clonar, `npm ci`, `npm test` y enlazarlo **solo** al perfil del `DSH_HOME` dedicado.
