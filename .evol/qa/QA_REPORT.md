# Reporte de QA

<!-- evol:security-scan:inicio -->
## Escaneo de seguridad

Generado por `evol security scan` el 2026-10-26T15:57:15.215Z. Esta sección se reescribe en cada escaneo; lo que escribas fuera de ella se conserva.

Abiertos: 0 CRITICAL, 0 HIGH, 3 MEDIUM, 24 LOW. Ignorados vigentes: 39.

Sin hallazgos críticos abiertos.

Otros hallazgos abiertos:

- MEDIUM: checkov CKV2_GHA_1 en .github/workflows/ci.yml
- MEDIUM: shellcheck SC2164 en docs/piloto-conocimiento/medicion/index_rag.sh:4
- MEDIUM: shellcheck SC2164 en docs/piloto-conocimiento/medicion/index_vec.sh:4
- LOW: trivy DS-0026 en Dockerfile
- LOW: bandit B404 en docs/piloto-conocimiento/medicion/harness.py:1
- LOW: bandit B603 en docs/piloto-conocimiento/medicion/harness.py:20
- LOW: bandit B603 en docs/piloto-conocimiento/medicion/harness.py:38
- LOW: shellcheck SC2086 en docs/piloto-conocimiento/medicion/index_rag.sh:4
- LOW: shellcheck SC2086 en docs/piloto-conocimiento/medicion/index_rag.sh:5
- LOW: shellcheck SC2086 en docs/piloto-conocimiento/medicion/index_rag.sh:5
- LOW: shellcheck SC2086 en docs/piloto-conocimiento/medicion/index_rag.sh:5
- LOW: shellcheck SC2086 en docs/piloto-conocimiento/medicion/index_rag.sh:8
- LOW: shellcheck SC2086 en docs/piloto-conocimiento/medicion/index_rag.sh:8
- LOW: shellcheck SC2086 en docs/piloto-conocimiento/medicion/index_rag.sh:8
- LOW: shellcheck SC2086 en docs/piloto-conocimiento/medicion/index_rag.sh:8
- LOW: shellcheck SC2086 en docs/piloto-conocimiento/medicion/index_rag.sh:8
- LOW: shellcheck SC2086 en docs/piloto-conocimiento/medicion/index_vec.sh:10
- LOW: shellcheck SC2086 en docs/piloto-conocimiento/medicion/index_vec.sh:10
- LOW: shellcheck SC2086 en docs/piloto-conocimiento/medicion/index_vec.sh:10
- LOW: shellcheck SC2086 en docs/piloto-conocimiento/medicion/index_vec.sh:10
- LOW: shellcheck SC2086 en docs/piloto-conocimiento/medicion/index_vec.sh:10
- LOW: shellcheck SC2086 en docs/piloto-conocimiento/medicion/index_vec.sh:4
- LOW: shellcheck SC2086 en docs/piloto-conocimiento/medicion/index_vec.sh:5
- LOW: shellcheck SC2086 en docs/piloto-conocimiento/medicion/index_vec.sh:6
- LOW: shellcheck SC2086 en docs/piloto-conocimiento/medicion/index_vec.sh:7
- LOW: shellcheck SC2086 en docs/piloto-conocimiento/medicion/index_vec.sh:7
- LOW: bandit B404 en docs/piloto-conocimiento/medicion/run_bge.py:1
<!-- evol:security-scan:fin -->
