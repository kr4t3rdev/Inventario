# Arqueo de Caja

> Registra el conteo físico de caja por turno y compara lo contado contra lo esperado por ventas y fondos iniciales.

## Qué hace

Este módulo toma el turno activo y calcula cuánto debería haber en efectivo, tarjeta, transferencia y crédito. Luego guarda el conteo real, mide diferencias y deja listo el paso previo al cierre del turno.

## Qué incluye

- cálculo de esperados por turno
- conteo físico de CUP y USD por denominación
- totales físicos por medio de cobro
- diferencias contra esperados
- listado de arqueos con filtros
- advertencia por diferencia excesiva

## Cuándo usarlo

- Cuando estás por cerrar un turno y necesitás validar caja.
- Cuando querés justificar diferencias entre ventas y dinero contado.
- Cuando querés auditar arqueos previos de un punto de venta.

## Reglas importantes

- El arqueo no cierra el turno por sí solo.
- Los esperados se calculan desde ventas y fondos iniciales del turno.
- Se permiten múltiples arqueos por turno.
- Existe un umbral de diferencia para levantar advertencias relevantes.

## Qué conviene cuidar

- Si el conteo físico está mal cargado, el cierre posterior también queda sesgado.
- Revisá bien efectivo contado vs fondo inicial para no interpretar mal la diferencia.

## Referencias útiles

- `src/features/arqueo-caja/actions.ts`
- `src/features/turnos-pos/actions.ts`

## En una frase

Es el control físico de caja que valida si el turno realmente cierra con lo que debía haber.
