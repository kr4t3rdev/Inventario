# TestSprite MCP Configuration

TestSprite MCP está configurado para proporcionar testing automatizado con IA en tu flujo de trabajo de desarrollo.

## Instalación

El paquete `@testsprite/testsprite-mcp` ya está instalado como dependencia de desarrollo.

## Configuración

La configuración de TestSprite MCP se encuentra en `.mcp.json` (ignorado por git para proteger la API key).

Para configurar tu propia API key:

1. Copia la variable desde `.env.example` a tu archivo `.env.local`
2. Reemplaza `your_testsprite_api_key_here` con tu API key real de TestSprite

## Uso

Para ejecutar TestSprite MCP manualmente:

```bash
pnpm run testsprite
```

TestSprite MCP se integra automáticamente con tu IDE (Cursor, Copilot, etc.) para:
- Generar tests automáticamente
- Ejecutar tests
- Debug de integraciones
- Análisis de cobertura de tests

## Variables de Entorno

- `TESTSPRITE_API_KEY`: Tu API key de TestSprite (requerida)

## Más Información

Documentación oficial: https://testsprite.com