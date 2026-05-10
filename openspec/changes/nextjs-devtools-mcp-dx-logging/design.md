# Design: Next.js DevTools MCP and DX Logging Improvements

## Technical Approach

El cambio se implementa con configuración nativa de Next.js 16.2.4, sin tocar el flujo funcional de la app. La integración MCP se registra en `.mcp.json` para que agentes compatibles puedan descubrir `next-devtools` automáticamente. La mejora de logging se concentra en `next.config.ts` activando forwarding de consola del browser hacia terminal durante desarrollo, con un nivel pensado para maximizar señal sin introducir infraestructura de tracing todavía.

La spec de `developer-experience` pide tres cosas: exposición MCP, logs visibles en terminal y un camino claro hacia `instrumentation.ts`. Este diseño cubre el primer y segundo punto directamente y deja el tercero como extensión futura documentada, no como obligación de esta entrega.

## Architecture Decisions

### Decision: Mantener MCP en `.mcp.json`

**Choice**: registrar `next-devtools` en el archivo raíz `.mcp.json` usando `npx -y next-devtools-mcp@latest`.

**Alternatives considered**: agregar un script en `package.json`; instalar el server como dependencia fija del proyecto.

**Rationale**: `.mcp.json` ya existe y ya centraliza servidores MCP del repo. Mantenerlo ahí evita duplicar entrypoints, no altera el runtime de la app y sigue el patrón oficial de Next.js para agentes MCP. Un script en `package.json` agrega ruido sin aportar valor real.

### Decision: Activar browser-to-terminal logging en nivel moderado

**Choice**: habilitar `logging.browserToTerminal` en `next.config.ts` con un nivel orientado a señal útil en desarrollo.

**Alternatives considered**: dejarlo apagado; forwardear todo con máxima verbosidad; saltar directamente a `instrumentation.ts`.

**Rationale**: la necesidad actual es mejorar DX rápida y reversiblemente. Forwardear logs a terminal resuelve el dolor inmediato de cambiar entre browser y terminal. Un nivel demasiado verboso genera ruido; por eso el diseño privilegia señal/ruido antes que exhaustividad total. `instrumentation.ts` se reserva para el siguiente escalón cuando haya una necesidad real de tracing.

### Decision: Postergar `instrumentation.ts` como fase futura

**Choice**: no crear `instrumentation.ts` en esta iteración, pero documentar su rol como extensión natural para observabilidad completa.

**Alternatives considered**: implementar OpenTelemetry ahora; no documentar el camino futuro.

**Rationale**: `instrumentation.ts` es una solución más pesada y correcta cuando hace falta telemetría/tracing, pero hoy sería sobreingeniería. El problema planteado es de debugging y request visibility, y eso se resuelve primero con logging nativo. Documentar el salto a `instrumentation.ts` evita que el equipo pierda contexto más adelante.

## Data Flow

```text
MCP-capable agent
   -> reads .mcp.json
   -> launches next-devtools-mcp via npx
   -> connects to running Next.js dev server
   -> inspects app context / routes / devtools data

Browser console / dev requests
   -> Next.js dev runtime
   -> logging browserToTerminal
   -> terminal output for developer
```

El flujo MCP no modifica la app; solo expone un canal externo de inspección para agentes. El flujo de logging sí atraviesa el runtime de desarrollo, pero solo para observabilidad de terminal.

## File Changes

| File | Action | Description |
|------|--------|-------------|
| `.mcp.json` | Modify | Registrar `next-devtools` junto al server MCP existente `testsprite`. |
| `next.config.ts` | Modify | Habilitar `logging.browserToTerminal` y documentar el propósito del nivel elegido. |
| `openspec/changes/nextjs-devtools-mcp-dx-logging/design.md` | Create | Capturar las decisiones técnicas, trade-offs y el camino futuro hacia `instrumentation.ts`. |

## Interfaces / Contracts

No se introducen nuevas APIs internas de negocio. Los contratos relevantes son de configuración:

```json
{
  "mcpServers": {
    "next-devtools": {
      "command": "npx",
      "args": ["-y", "next-devtools-mcp@latest"]
    }
  }
}
```

```ts
const nextConfig: NextConfig = {
  logging: {
    browserToTerminal: true,
  },
}
```

La implementación final puede ajustar el nivel de forwarding si se decide reducir ruido, pero la intención contractual permanece: logs del browser visibles en terminal durante desarrollo.

## Testing Strategy

| Layer | What to Test | Approach |
|-------|-------------|----------|
| Unit | Sintaxis y estructura de configuración | Validar que `.mcp.json` preserve `testsprite` y agregue `next-devtools`; revisar que `next.config.ts` siga siendo un `NextConfig` válido. |
| Integration | Comportamiento de desarrollo | Verificar que `next dev` arranque con la configuración y que el browser-to-terminal logging no rompa la salida del servidor. |
| E2E | Visibilidad de logs y uso de MCP | Confirmar manualmente o con tooling compatible que logs del browser aparecen en terminal y que un cliente MCP puede descubrir `next-devtools`. |

## Migration / Rollout

No migration required. El cambio es puramente configuracional y reversible. Puede habilitarse en una sola entrega sin feature flag porque no altera datos ni contratos públicos de la aplicación.

## Open Questions

- [ ] Ninguna bloqueante. Si el equipo quiere menos ruido en terminal, el nivel exacto de `browserToTerminal` puede ajustarse sin cambiar la arquitectura.
