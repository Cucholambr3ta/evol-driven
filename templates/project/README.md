# {{name}}

Proyecto TypeScript creado con [evol-driven](https://github.com/Cucholambr3ta/evol-driven).

## Pipeline

```
evol status      # fase actual, disciplinas y artefactos pendientes
evol approve <fase>   # aprobación humana (pide una terminal interactiva)
evol next        # avanza si la fase está verificada y aprobada
```

Las fases son: briefing → spec → plan → build → qa → retro. Los archivos de las plantillas marcan
con `[[COMPLETAR]]` lo que falta por escribir; mientras quede un marcador, la fase no se puede aprobar.

## Memoria y código

```
evol memory add --tipo decision --texto "..."
evol memory search "consulta"
evol index && evol impact <símbolo>
```

## Desarrollo

```
npm install
npm test && npm run typecheck
```
