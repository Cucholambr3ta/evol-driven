# 06 — Model Routing por fase, rol y subagente (OD-24, v3)

Estado: diseño. **No se desarrolla otro sistema de proveedores**: DSH gestiona proveedores, modelos y niveles de razonamiento; Studio guarda una *política* y la traduce a las llamadas que DSH/AgentTeams ya admiten.

## 1. Lo verificado en las fuentes

| Hecho | Evidencia |
|---|---|
| DSH ofrece el menú *Effort* solo para modelos que declaran niveles; los niveles se declaran en `cordis.patch.yml` del perfil (`reasoningEfforts`), con alias por proveedor | `docs/user/guide/providers.md` (EV-039) |
| `list_subagent_models` existe ya en 0.2.1-rc.2 y lista rutas autorizadas | `docs/tool-catalog.md` @rc.2 (EV-039) |
| Desde 0.2.2-alpha.2, `reasoning_effort` en delegación exige `provider` y `model` explícitos; un par explícito sin esfuerzo usa el valor por defecto del modelo | guía de actualización (EV-039) |
| AgentTeams admite por miembro `provider, model, reasoning_effort, fallback, tool_policy` | `src/profiles.ts:23` (EV-038) |
| El modo automático = heredar la configuración de DSH | prompt OD-24 |

**No verificado:** cómo se comporta la selección en 0.2.1-rc.2 cuando el miembro de AgentTeams fija modelo y esfuerzo; si el cambio de modelo en un trabajo altera el modelo global de DSH (no debe); y si existe API pública para consultar el modelo realmente usado por una ejecución. Pruebas necesarias en Tanda 1 (doc 13).

**Verificación de ejemplos (v3):** todo lo atribuido a DSH en este documento procede de documentación de la versión candidata (`list_subagent_models` en `docs/tool-catalog.md` de `0.2.1-rc.2`; niveles de razonamiento en `docs/user/guide/providers.md`) o del código de AgentTeams (`src/profiles.ts`). La regla «`reasoning_effort` exige `provider` y `model`» **no** se atribuye a 0.2.1-rc.2 (es de 0.2.2-alpha.2). Cualquier ejemplo de este documento es conceptual y se valida contra el host elegido.

## 2. Modos

| Modo | Qué configura | Quién resuelve |
|---|---|---|
| **Automático** (predeterminado) | nada; hereda el modelo de DSH | DSH |
| **Por fase** | un modelo (y esfuerzo compatible) para briefing, spec, plan, build, qa o retro | política de Studio → perfil de miembro |
| **Avanzado** | modelo por rol, por especialidad o por agente | política de Studio |

## 3. Precedencia propuesta (mayor a menor)

1. Configuración explícita **autorizada** para el trabajo.
2. Configuración del rol.
3. Configuración de la fase.
4. Configuración del proyecto.
5. Configuración general de Studio.
6. Configuración de DSH.

Validación de la precedencia: **propuesta**, se confirma con la prueba de resolución (casos de combinaciones y empates) y con la revisión del propietario. Reglas de integridad:
- La resolución se calcula **al crear el trabajo** y queda congelada; una ejecución iniciada no cambia de modelo en silencio.
- Elegir un modelo para una tarea **no modifica el modelo global de DSH**; se pasa como parámetro del miembro/llamada.
- Cualquier modelo, proveedor o esfuerzo debe figurar entre las rutas autorizadas devueltas por DSH; si no, error explícito.

## 4. Esfuerzo de razonamiento y compatibilidad

La UI **solo ofrece** los niveles que el modelo seleccionado declara; si se cambia de modelo, el nivel se revalida y, si no existe, vuelve al valor por defecto del modelo con aviso. No se asume equivalencia entre proveedores (alias propios como `max → xhigh`). Un **adaptador por versión de DSH** encapsula la diferencia 0.2.1-rc.2 / 0.2.2-alpha.2+ (C-02).

## 5. Seguridad

- El cambio de modelo no cambia permisos ni omite revisiones ni autoriza avanzar.
- **Contingencia** (`fallback`): solo hacia rutas autorizadas; **nunca silenciosa hacia un modelo remoto** si el original era local; la UI exige declarar «remoto permitido» y registra el salto.
- Los límites de consumo (tokens/ejecución/fase) se aplican en el coordinador; al superarse, el trabajo pasa a `failed` con motivo `budget` (no a «completed»).
- Se informa de forma visible si la **inferencia es remota** (privacidad de inferencia ≠ privacidad de memoria, OD-10).

## 6. Persistencia (sin secretos)

Por ejecución se registra: `run_id, task_id, phase, role, provider, model, reasoning_effort (efectivo), origen de la resolución (qué nivel de la precedencia), fallback usado, tokens aprobados/consumidos, timestamps`. Nunca claves, cabeceras ni endpoints con credencial.

## 7. Esquema de configuración propuesto (conceptual)

```yaml
studio:
  models:
    mode: auto | phase | advanced        # auto = hereda DSH
    phases:   { briefing: {provider, model, effort}, ... }
    roles:    { code-reviewer: {provider, model, effort}, ... }
    budget:   { per_task_tokens: n, per_phase_tokens: n }
    fallback: { allow_remote: false, routes: [ {provider, model} ] }
```
Las claves de proveedor siguen en el almacén de credenciales de DSH.

## 8. Pruebas necesarias

Resolución por precedencia (tabla de casos); persistencia del modelo realmente usado; no alteración del modelo global; rechazo de esfuerzo incompatible; fallback remoto bloqueado por defecto; congelación al iniciar; presupuesto agotado → `failed`.
