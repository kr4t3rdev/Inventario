# ADR-0001: Conteo físico ciego con catálogo completo

**Estado:** Propuesto
**Fecha:** 2026-11-01
**Especificación vinculada:** Ninguna
**Decisores:** Equipo de producto e ingeniería

## Contexto

El conteo físico existente captura productos a partir de líneas de stock ya
registradas en una ubicación. Esto omite productos cuyo stock teórico es cero,
aunque puedan encontrarse físicamente durante el conteo. Además, la captura
manual permite enviar subconjuntos de productos y la interfaz no ofrece una
forma de resolver diferencias entre las dos pasadas ciegas.

## Decisión

- Al iniciar un conteo, crear una línea para cada producto del tenant.
- Usar como cantidad teórica el stock registrado en la ubicación y cero cuando
  no exista una fila de stock.
- Exigir que cada pasada incluya exactamente una cantidad para cada línea del
  conteo; rechazar productos repetidos o ajenos al conteo.
- Mantener ocultos el stock teórico y los valores de captura durante las pasadas
  ciegas. En conciliación, mostrar las dos cantidades capturadas y solicitar un
  valor final para cada diferencia.
- El modelo `Producto` no tiene un indicador de activo, por lo que el catálogo
  incluye todos los productos existentes en el tenant.

## Consecuencias

- Se pueden registrar sobrantes de productos con stock teórico cero.
- Los conteos incluyen todos los productos del tenant y pueden ser más largos
  que el inventario de una sola ubicación.
- La validación del servidor garantiza que una pasada completa no avance con
  cantidades omitidas o IDs inválidos.
- Las diferencias entre capturas tienen un paso explícito de resolución antes
  de crear ajustes de inventario.

## Alternativas consideradas

- Contar solo los productos con fila de stock en la ubicación: mantiene la
  captura más pequeña, pero no permite registrar sobrantes con stock teórico
  cero.
- Conciliar automáticamente tomando una de las dos capturas: evita un paso
  manual, pero no confirma la cantidad física cuando las pasadas difieren.
