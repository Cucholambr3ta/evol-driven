# 08 — Estrategia de distribución (R5)

Evidencia: EV-015, 016, 018, 021. Principio: **una sola implementación**; Desktop y Plugin comparten Core, plugin host/client, contratos y reglas de autorización. La diferencia entre ediciones es solo *empaquetado y perfil*.

## 1. Plugin Edition

Mecanismo verificado (EV-016): un paquete npm con `dsh.bundle.patch` que apunta a archivos `cordis.patch.yml`; los parches insertan o reemplazan filas de configuración por id; los perfiles apilan bundles y el usuario conserva su propio `cordis.patch.yml`. La instalación se hace con `dsh plugin --profile <perfil> add <paquete|tgz>` (guía comunitaria; no ejecutado).

| Aspecto | Hallazgo | Clase |
|---|---|---|
| No reemplazar configuración existente | los parches son por capas; un bundle no sobrescribe capas superiores (`architecture.md`). Insertar filas duplicadas **impide guardar ajustes** (aviso de dsh-mnemon) | VERIFIED (doc) |
| Instalación/desinstalación | `dsh plugin add/remove`; el Plugin Manager existe en `base` | DOCUMENTED |
| Reversión de instalación fallida | no documentada como transaccional; la guía comunitaria no la ofrece | UNVERIFIED |
| Dependencias | `peerDependencies` con rangos de `@deepseek-ai/*`; AgentTeams usa `*` para varios | VERIFIED |
| Compatibilidad | cada plugin comunitario fija su matriz (AgentTeams: recomendado 0.2.1-rc.2) | VERIFIED |

**Propuesta:** tres paquetes npm con versiones fijadas: `@evol/studio-core` (API y adaptador al CLI/MCP de Evol), `@evol/studio-plugin` (host + cliente + `dsh.bundle`), y un perfil `evol-studio` que apila `dsh-base` + `dsh-web-app` + los bundles de memoria/código/equipos elegidos. Nunca se añade a un perfil existente sin que la persona lo apruebe (`--dry-run` obligatorio primero).

## 2. Desktop Edition

Hechos (EV-018): el Desktop de Harness es una envoltura Electron del Web app con un Host privado, runtime incluido y firmado, actualización propia y gestión del comando `dsh`. **Sus objetivos de empaquetado son `mac-arm64`, `mac-x64` y `win-x64`; no hay objetivo Linux.** Linux se menciona solo para el entorno de arranque de GUI.

| Plataforma | Estado | Qué falta |
|---|---|---|
| Arch Linux | **no soportado en origen** | objetivo de empaquetado propio (AppImage, paquete `pacman`/PKGBUILD, o Flatpak); firma y actualización; revisión del sandbox (bwrap/Landlock) |
| Otras distros | igual | mismo trabajo; la elección de formato se deja abierta |
| Windows | soportado (`win-x64`) | firma, instalador, Evol necesita probar su CLI en Windows (hoy es Node, probado en Linux) |
| macOS | soportado (`mac-arm64/x64`) | notarización; Evol sin pruebas en macOS |

Alternativa más barata y recomendada como primer paso: **no empaquetar Electron en Linux al inicio**, sino distribuir el *Plugin Edition* sobre `dsh web` (navegador local) con un script de instalación reproducible. El Desktop Linux se aborda como hito posterior, con su propio ADR.

**Qué no se asume:** que Electron implique soporte multiplataforma de los plugins; el Desktop tiene IPC, ciclo de vida y actualizaciones propios.

## 3. Asistente de instalación

Pasos (propuestos, a implementar como un comando `evol studio setup` con modo `--solo-comprobar`): verificar Node ≥24.9, git, Harness fijado; inicializar el perfil `evol-studio`; elegir proveedor de modelos y declarar si es local (§doc 04); inicializar memoria; registrar proyectos; habilitar plugins; comprobar herramientas; ejecutar `evol doctor` y un diagnóstico de red. **El paquete no contiene claves API, bases de datos personales ni memorias del desarrollador**; una prueba de empaquetado lo comprueba (hash y escaneo de secretos).

## 4. Versionado y mantenimiento

- **Versiones fijadas** de Harness (0.2.2-rc.3 hoy), de cada plugin y de Evol; matriz en doc 15.
- Canales: `stable` (solo combinaciones probadas) y `experimental`.
- Actualizaciones: las de Harness no se aplican automáticamente; se prueba la matriz primero. Datos: migraciones con respaldo previo y reversión.
- Integridad: etiquetas firmadas (Evol ya exige etiqueta `v*` firmada con SSH para la instalación estable) y hashes en `release.json`.
- **Licencias:** Harness MIT, dsh-mnemon MIT, AgentTeams MIT, CBM MIT, Mnemon Apache-2.0, Evol-Driven **privado** (`UNLICENSED`): una distribución comercial requiere una decisión de licencia propia (OD-08). Marcas: BRAND_GUIDELINES de Harness existe; revisar uso del nombre y logo antes de usar «DeepSeek» en el nombre del producto.

## 5. Repositorios propuestos

`evol-driven` (núcleo, sin dependencia de Harness) · `evol-studio` (plugin + perfil + empaquetado) · `evol-studio-fixtures` (proyectos de prueba para los benchmarks). Dos repos evitan que el núcleo dependa de un host pre-release.

## 6. Qué decide Harness y qué decide Evol

Harness decide el formato del bundle y el ciclo de vida de plugins; Evol decide el contenido (Core, contratos) y la política de actualización. Ante una ruptura de API de Harness, Evol se queda en la versión fijada anterior.
