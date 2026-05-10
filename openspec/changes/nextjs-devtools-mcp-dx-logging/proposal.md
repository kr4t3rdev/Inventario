# Proposal: Next.js DevTools MCP and DX Logging Improvements

## Intent

Mejorar la experiencia de desarrollo y depuración en el proyecto Next.js 16.2.4 con dos cambios de bajo riesgo: habilitar Next.js DevTools MCP para agentes compatibles con MCP y ampliar el logging de desarrollo para hacer más visibles los requests, fetches y logs del browser en terminal.

## Scope

### In Scope
- Agregar `next-devtools-mcp` a `.mcp.json` para habilitar integración MCP con el proyecto.
- Configurar `logging.browserToTerminal` en `next.config.ts` para forwardear logs del browser a la terminal en desarrollo.
- Documentar el funcionamiento esperado del logging de Next.js y su relación con una futura observabilidad más profunda.
- Dejar encaminado el proyecto para un posible `instrumentation.ts` en una etapa posterior.

### Out of Scope
- Implementar `instrumentation.ts` en esta iteración.
- Agregar OpenTelemetry, exporters o backend de tracing.
- Cambiar comportamiento funcional de la app.

## Approach

Usar configuración declarativa de Next.js:

1. Extender `.mcp.json` con el server `next-devtools` usando `next-devtools-mcp@latest`.
2. Ajustar `next.config.ts` con `logging.browserToTerminal` para mejorar visibilidad de logs del cliente durante desarrollo.
3. Documentar que este nivel resuelve observabilidad operativa básica y que `instrumentation.ts` queda como siguiente escalón para trazas y telemetría.

Este enfoque mantiene el cambio simple, reversible y alineado con las capacidades oficiales de Next.js 16.

## Affected Areas

| Area | Impact | Description |
|------|--------|-------------|
| `.mcp.json` | Modified | Registrar `next-devtools` como servidor MCP del proyecto. |
| `next.config.ts` | Modified | Activar logging de terminal desde browser en desarrollo. |
| `openspec/changes/nextjs-devtools-mcp-dx-logging/` | New | Guardar la propuesta y tareas del cambio. |

## Risks

| Risk | Likelihood | Mitigation |
|------|------------|------------|
| Ruido excesivo en terminal por logs del browser | Medium | Empezar con forwarding general y ajustar a `warn`/`error` si hace falta. |
| MCP no disponible en todos los agentes | Low | El cambio no rompe nada; solo habilita soporte para herramientas compatibles. |
| Querer más observabilidad que la que da logging básico | Medium | Dejar documentado el camino a `instrumentation.ts` para tracing real. |

## Rollback Plan

Revertir los cambios en `.mcp.json` y `next.config.ts`. No hay migraciones ni cambios de runtime persistidos, así que el rollback es inmediato y de bajo riesgo.

## Dependencies

- Next.js 16.2.4 con soporte oficial para DevTools MCP y logging configurables.
- Agentes o IDEs que soporten MCP para aprovechar `next-devtools`.

## Success Criteria

- [ ] El proyecto expone `next-devtools` via `.mcp.json`.
- [ ] Los logs del browser aparecen en terminal durante `next dev`.
- [ ] La documentación deja claro qué cubre este nivel y cuándo pasar a `instrumentation.ts`.
- [ ] La propuesta queda lista para retomarse en una segunda fase sin reexplorar el contexto.
