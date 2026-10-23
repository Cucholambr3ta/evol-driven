# Investigación: BlackArch y las herramientas de seguridad del proyecto

> **Estado:** investigación, **nada se instaló**. Fecha: 2026-10-22. Las decisiones que salen de aquí están en la
> especificación (ampliación 5) y cada instalación espera tu aprobación.

## Qué se revisó y cómo

- **El catálogo real de BlackArch:** se descargó `blackarch.db` de su espejo oficial (2 MB) y se leyó el archivo `desc` de cada paquete
  (nombre, versión, licencia, grupos, fecha de construcción). No se activó el repositorio ni se tocó `pacman.conf`.
- **El repositorio `BlackArch/blackarch` en GitHub:** README y forma de instalación.
- **Cada herramienta candidata en su repositorio de origen** (API de GitHub): licencia, última versión y último movimiento. BlackArch
  dice una cosa y el origen otra con más frecuencia de la que parece (ver «Hallazgos»).
- **Tu máquina:** `pacman -Si` (repositorios oficiales), `yay -Si` (AUR) y qué está ya instalado.

## Qué es BlackArch y cómo se instala

Es un repositorio de Arch Linux con herramientas de pruebas de intrusión (3 540 estrellas, BSD-3-Clause, activo). Su instalación oficial
sobre un Arch existente es `curl -s https://blackarch.org/strap.sh | sudo bash`; la web ofrece también descargar el script y comprobar
su suma **SHA-1** antes de ejecutarlo como root. Eso añade el repositorio y **su clave de firma como de confianza para todo el sistema**:
cualquier paquete que publique ese repositorio puede ejecutarse como root en cada actualización. Es exactamente el patrón («descarga y
ejecuta como administrador») que `evol skills audit` marca como `BLOCK`.

## Los números

| Dato                                                                  | Valor                                      |
| --------------------------------------------------------------------- | ------------------------------------------ |
| Paquetes en el catálogo                                               | 5 054 (2 855 en el grupo base `blackarch`) |
| Grupos                                                                | 53                                         |
| En grupos ofensivos (escáneres, reconocimiento, explotación, claves…) | 2 113 (41 %)                               |
| En grupos defensivos o de auditoría                                   | 203 (4 %)                                  |
| Sin reconstruir en los últimos 12 meses                               | 2 695 (53 %)                               |
| Con licencia desconocida o a medida                                   | 916 (18 %)                                 |

Los grupos útiles para este proyecto son pequeños: `blackarch-code-audit` (44), `blackarch-defensive` (87), `blackarch-ai` (7),
`blackarch-malware` (55), `blackarch-ids` (4), `blackarch-threat-model` (1) y `blackarch-config` (17).

## Hallazgos

1. **Casi todo lo que el proyecto necesita ya está fuera de BlackArch.** De las herramientas buscadas (unas 70), gitleaks, bandit, shellcheck,
   yara, clamav, trivy, syft, osv-scanner, bubblewrap, strace, firejail, lynis, reuse, cosign, zaproxy, nmap, nikto, sqlmap y testssl.sh
   están en los repositorios **oficiales** de Arch; otras vienen del AUR o de su proyecto (`uv`, `npm`, `go`).
2. **Los metadatos de BlackArch no son fiables como fuente única.** `trufflehog` figura con licencia GPL2 y en origen es **AGPL-3.0**;
   `semgrep` va en 1.164.0 (mayo) frente a la 1.182.0 de origen (octubre); `capa` en 7.4.0 frente a 10.0.0; `threatspec` se sigue
   construyendo en 2026 aunque su repositorio **no se toca desde 2020**.
3. **Es un catálogo ofensivo.** El 41 % son herramientas de ataque. Hay paquetes que un proyecto como este nunca debería instalar, por
   ejemplo `evil-opencode` (su descripción dice «fork de OpenCode con las protecciones del modelo quitadas…», en el grupo `blackarch-ai`): tú usas OpenCode a
   diario, y un nombre así es una trampa.
4. **Lo exclusivo de BlackArch que sí sirve es poco:** `procscope` (observación de procesos con eBPF, exige privilegios) e `inetsim`
   (servicios de internet falsos, también en el AUR). Ninguno es imprescindible.
5. **`trufflehog` verifica por defecto los secretos que encuentra llamando a los servicios afectados**, es decir, envía a terceros lo que
   encuentra. Contradice la regla de que la auditoría no manda nada fuera; si algún día entra, solo con la verificación desactivada (comprobar el indicador exacto con la versión instalada).
6. **Algunas herramientas de BlackArch dependen de servicios o licencias restrictivas:** `codeql` (licencia a medida), `snyk` (servicio),
   `sonar-scanner` (necesita un servidor), `nzyme` (SSPL).

## Recomendación

- **No añadir el repositorio BlackArch a `pacman.conf`.** Usarlo como **catálogo de descubrimiento**. Razones: entrega a root la confianza
  en un tercero, el 53 % está desactualizado, el 18 % no declara licencia y casi nada de lo necesario es exclusivo suyo.
- **Orden de preferencia para instalar:** 1) repositorio oficial de Arch; 2) el proyecto de origen con versión anclada (`uv tool install`,
  `npm`, `go install` o `mise`); 3) AUR, leyendo antes el `PKGBUILD`; 4) un paquete suelto de BlackArch solo como excepción escrita.
- **Cada herramienta entra a la especificación con su justificación antes de instalarse**, y se instala solo con tu aprobación.

## Candidatas con datos verificados en origen

La versión y la licencia son las del repositorio de origen (GitHub, 2026-10-22), no las de BlackArch. «Instalada» es lo que ya tienes.

| Herramienta   | Para qué sirve en el proyecto                                             | Dónde está                        | Versión (origen)  | Licencia                         |
| ------------- | ------------------------------------------------------------------------- | --------------------------------- | ----------------- | -------------------------------- |
| gitleaks      | Secretos en skills y proyectos                                            | **Oficial**                       | v8.30.1 (2026-03) | MIT                              |
| semgrep       | Análisis estático multi-lenguaje                                          | `uv`; BlackArch (desactualizado)  | v1.182.0          | LGPL-2.1                         |
| opengrep      | Alternativa libre a semgrep                                               | AUR                               | v1.32.0           | LGPL-2.1                         |
| osv-scanner   | Vulnerabilidades de dependencias (cualquier archivo de bloqueo)           | **Oficial**                       | v2.7.0            | Apache-2.0                       |
| shellcheck    | Análisis de scripts de shell                                              | **Oficial** (instalada)           | v0.11.0           | GPL-3.0                          |
| bandit        | Análisis estático de Python                                               | **Oficial**                       | 1.9.4             | Apache-2.0                       |
| yara          | Reglas de indicadores maliciosos                                          | **Oficial**                       | v4.5.8            | BSD-3-Clause                     |
| guarddog      | Paquetes npm y PyPI maliciosos                                            | `uv` (no está en repositorios)    | v3.2.0 (2026-08)  | Apache-2.0                       |
| promptfoo     | Evals y pruebas de ataque a LLM                                           | `npm`; AUR; BlackArch             | activo            | MIT                              |
| garak         | Escáner de vulnerabilidades de LLM (inyección de instrucciones)           | `uv`; AUR; BlackArch              | v0.17.1           | Apache-2.0                       |
| bubblewrap    | Aislamiento para el análisis dinámico                                     | **Oficial** (instalada)           | v0.13.1           | LGPL-2.0+ (GitHub no la declara) |
| strace        | Trazar llamadas al sistema de un script dentro del aislamiento            | **Oficial** (instalada)           | v7.3              | LGPL-2.1+ (GitHub no la declara) |
| inetsim       | Servicios de internet falsos para capturar intentos de salida             | AUR; BlackArch                    | 1.3.2 (BlackArch) | GPL-3.0                          |
| trivy         | Dependencias, secretos, Terraform y Docker, SBOM                          | **Oficial**                       | v0.76.1           | Apache-2.0                       |
| syft          | SBOM como evidencia de cumplimiento                                       | **Oficial**                       | v1.55.0           | Apache-2.0                       |
| zaproxy       | Prueba dinámica pasiva de una API o web propia                            | **Oficial**                       | v2.17.0           | Apache-2.0                       |
| nuclei        | Pruebas dinámicas por plantillas                                          | AUR; BlackArch                    | v3.11.1           | MIT                              |
| schemathesis  | Pruebas de una API por propiedades a partir de su OpenAPI                 | `uv` (no está en repositorios)    | v4.32.4           | MIT                              |
| testssl.sh    | Configuración TLS                                                         | **Oficial**                       | v3.2.4            | GPL-2.0                          |
| checkov       | Políticas de infraestructura como código                                  | `uv`; BlackArch                   | 3.3.30            | Apache-2.0                       |
| reuse         | Cumplimiento de licencias del propio código                               | **Oficial**                       | v6.2.0            | Apache-2.0 y GPL-3.0 (verificar) |
| cosign        | Firmas y procedencia (para skills firmadas, más adelante)                 | **Oficial**                       | v3.1.4            | Apache-2.0                       |
| Threat Dragon | Modelado de amenazas con diagramas (aplicación gráfica)                   | Descarga de origen; BlackArch     | v2.6.2            | Apache-2.0                       |
| capa          | Capacidades de ejecutables (no hace falta: las skills no llevan binarios) | BlackArch (7.4.0, desactualizado) | v10.0.0           | Apache-2.0                       |
| trufflehog    | Secretos (verifica llamando a los servicios: ver hallazgo 5)              | AUR; BlackArch                    | v3.99.4           | **AGPL-3.0**                     |

## Preguntas abiertas

- ¿Apruebas instalar ya `gitleaks` y `semgrep` para verificar el hito S2 con las herramientas reales?
- ¿Prefieres `uv` o el AUR para lo que no está en los repositorios oficiales?
- ¿Usarás dentro de tus proyectos pruebas dinámicas (`zaproxy`, `nuclei`)? Si no, quedan fuera de la primera ola.
