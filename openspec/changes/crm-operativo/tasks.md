# Tasks — CRM-OP (Gap 6)

Plan SDD/TDD; prisma mock en unitarios; review por fase; commit selectivo.

## CRM-T1 — Modelo + permiso + regla pura del tope

- [ ] Modelo: `Cliente.limiteCredito` + `CobroNota`; permiso
  `operaciones.clientes.credito.override` (manager, sensitive); `rrhh.comisiones.gestionar`
  ya existe; RED por regla para `saldoVivo` y paridad.
- [ ] `src/features/crm/services/credito-calculo.ts`: `saldoVivoCliente(...)` puro (ventas
  vivas ∓ devoluciones ∓ pagos; nunca negativo) + `permiteCredito(...)`.
- Commit: `feat(crm): modelo de límite de crédito y regla pura de saldo vivo (CRM-T1)`

## CRM-T2 — Enforcement server-side

- [ ] Guarda en `venta-mutation-service` (creación venta a crédito con clienteId): calcula
  saldo vivo, exige el límite transversal al efectivo (crédito obtiene CxC tras el hecho).
- [ ] El registro de una devolución reduce el saldo vivo (ya implementado en DNC; aquí solo se
  aprovecha).
- [ ] Tests de enforcement con prisma mockeado.
- Commit: `feat(crm): enforcement del límite de crédito en la venta (CRM-T2)`

## CRM-T3 — UI vista 360 + seguimiento

- [ ] Vista 360 del cliente: panel de consulta con compras recientes, CxC vivas, notas previas.
- [ ] Cobro/nota: chips en la ficha del cliente para registrar contacto/nota rápida.
- [ ] Badge de nivel del tope en la ficha del cliente (límite/queda).
- Commit: `feat(crm): vista 360 y notas de contacto (CRM-T3)`

## CRM-T4 — Regresión y cierre

- [ ] Regresión completa (ventas, facturas, CxC, contabilidad).
- [ ] Memoria actualizada + change archivado.
- Commit: `docs(openspec): cerrar CRM operativo (Gap 6)`

## Fast-follows

- Notificación proactiva al manager cuando el cliente pasa el 80% del tope.
- Export del historial del cliente a CSV.
- Vincular `Empleado.userId` para que un dependiente vea “mis clientes” solos.
