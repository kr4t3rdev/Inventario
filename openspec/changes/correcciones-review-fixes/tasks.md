# Tasks — Corrección de hallazgos de revisión

## F-01: facturarOfertaAction — propagación de errores de turno
- [x] RED: 2 tests de propagación NO_TURNO_ACTIVO / cross-tenant
- [x] GREEN: throw ActionError si turnoResult.success === false

## F-02: facturarOfertaWorkflow — validación tenant de servicios
- [x] RED: 3 tests de aislamiento y moneda real
- [x] GREEN: tx.servicios.findFirst({servicioId, tenantId}) antes de insert

## F-03: numeración concurrente de contratos (action + REST)
- [x] RED: test `crearContratoConConsecutivo` usado en createContratoAction
- [x] GREEN: ambos paths (action + REST) usan `crearContratoConConsecutivo` — 3 intentos ante P2002

## F-04: Usuario-tenant en mutations secundarias (firmas / aprobaciones / archivos)
- [x] RED: 6 tests de relaciones externas sin validación tenant
- [x] GREEN: assert user pertenece al tenant, versionId pertenece al contrato, clienteId/vendorId pertenecen al tenant

## F-05: deduplicación contable en ofertas mixtas
- [x] RED: cuadre-double-count.test.ts — VS con ventaId NO duplica ingreso
- [x] GREEN: VentaServicios.ventaId (SetNull) + filtro `ventaId: null` en cuadre-queries

## F-06: limpieza de import sin tracking en mermas
- [x] Eliminar `@/features/inventario/movimientos` (pendiente de OTRO change)

## F-07: índice en schema.prisma para listaPrecioId
- [x] Agregar `@@index([listaPrecioId])` al modelo Cliente

## Tests
- [x] `pnpm exec vitest run src/features/ src/app/` — 2658 tests, 471 archivos, 0 fallos
- [x] `pnpm exec eslint` — sin errores nuevos
- [x] `tsc --noEmit` — sin errores en archivos del change
