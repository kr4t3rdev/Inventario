# Tasks — CRM-OP (Gap 6)

Plan SDD/TDD; prisma mock en unitarios; review por fase; commit selectivo.

## CRM-T1 — Modelo + permiso + regla pura del tope

- [x] Modelo: `Cliente.limiteCredito` + `CobroNota`; permiso
  `operaciones.clientes.credito.override` (manager, sensitive); `rrhh.comisiones.gestionar`
  ya existe; RED por regla para `saldoVivo` y paridad.
- [x] `src/features/crm/services/credito-calculo.ts`: `saldoVivoCliente(...)` puro (ventas
  vivas ∓ devoluciones ∓ pagos; nunca negativo) + `permiteCredito(...)`.
- Commit: `feat(crm): modelo de límite de crédito y regla pura de saldo vivo (CRM-T1)`

## CRM-T2 — Enforcement server-side

- [x] Guarda en `venta-mutation-service` (creación venta a crédito con clienteId): calcula
  saldo vivo, exige el límite transversal al efectivo (crédito obtiene CxC tras el hecho).
- [x] El registro de una devolución reduce el saldo vivo (ya implementado en DNC; aquí solo se
  aprovecha).
- [x] Tests de enforcement con prisma mockeado.
- Commit: `feat(crm): enforcement del límite de crédito en la venta (CRM-T2)`

## CRM-T3 — UI vista 360 + seguimiento

- [x] Vista 360 del cliente: panel de consulta con compras recientes, CxC vivas, notas previas.
- [x] Cobro/nota: chips en la ficha del cliente para registrar contacto/nota rápida.
- [x] Badge de nivel del tope en la ficha del cliente (límite/queda).
- Commit: `feat(crm): vista 360 y notas de contacto (CRM-T3)`

## CRM-T4 — Regresión y cierre

- [x] Regresión completa (ventas, facturas, CxC, contabilidad).
- [x] Memoria actualizada + change archivado.
- Commit: `docs(openspec): cerrar CRM operativo (Gap 6)`

## Fast-follows

- Notificación proactiva al manager cuando el cliente pasa el 80% del tope.
- Export del historial del cliente a CSV.
- Vincular `Empleado.userId` para que un dependiente vea “mis clientes” solos.

### Notas de procesamiento reales
- La regla pura de saldo vivo calcula el saldo de las CxC no anuladas (fuente única), nunca
  negativo; el enforcement vive en `venta-mutation-service.create` y usa `VENTA_CON_DEVOLUCIONES`
  no aplica (viene de DNC).
- El único fallo nuevo en regresión fue el mock del test mobile de esperados (faltaba
  `devolucionVenta.aggregate`); se completó y quedó verde sin tocar código productivo.
- La vista 360 vive dentro de la edición del cliente; notas con causa en CobroNota (AuditLog
  lo registra por CUENTA_POR_COBRAR por compatibilidad de entidades).
