# Turnos POS

> Controla la apertura y cierre de turnos por punto de venta, con validación estricta de arqueo antes del cierre.

## Qué hace

Este módulo ordena quién está operando una caja y en qué estado está cada punto de venta. También evita cierres inconsistentes: un turno no puede cerrarse si no existe arqueo o si el arqueo no coincide con las ventas del turno.

## Operaciones principales

- abrir turno manualmente en un POS
- listar turnos por fecha, estado o punto de venta
- consultar el turno activo
- cerrar turno con validación server-side
- crear turno automático en POS móviles o secundarios cuando una venta lo necesita

## Cuándo usarlo

- Cuando una caja empieza a operar y hace falta registrar fondo inicial.
- Cuando querés revisar qué turno está abierto en un POS.
- Cuando toca cerrar caja y validar el arqueo.
- Cuando necesitás diagnosticar por qué una venta no pudo ejecutarse por falta de turno.

## Reglas importantes

- Un mismo punto de venta no puede tener dos turnos `ABIERTO` al mismo tiempo.
- Un turno no cierra sin arqueo previo.
- El arqueo debe coincidir con las ventas dentro de una tolerancia de `0.01`.
- Los POS `PRINCIPAL` no crean turno automático.
- Los POS `MOVIL` o `SECUNDARIA` sí pueden autogenerar turno al vender.

## Qué conviene cuidar

- Si el cierre falla, primero revisá arqueo, ventas del turno y fondo inicial.
- El tipo de caja del POS cambia por completo el comportamiento de apertura automática.
- Turnos y ventas comparten contexto operativo; no conviene analizarlos por separado.

## Relación con otros módulos

- **Ventas**: consume `getOrCreateTurnoActivo` antes de registrar operaciones.
- **Arqueo de caja**: aporta el arqueo obligatorio para cerrar.
- **Puntos de venta**: define en qué caja vive el turno y de qué tipo es.
- **Cuadre diario**: usa los datos del turno para el resumen final.

## Referencias útiles

- `src/features/turnos-pos/actions.ts`
- `src/features/turnos-pos/actions-cuadre.ts`
- `src/features/turnos-pos/__tests__/actions-cuadre.test.ts`

## En una frase

Mantiene cada caja en un estado operativo controlado antes, durante y después de vender.
