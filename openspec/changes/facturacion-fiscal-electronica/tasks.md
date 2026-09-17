# Tasks — FE Facturación fiscal electrónica (Gap 4)

Plan SDD (arquitectura acordada: capa abierta + stub, sin timbrado real). Reglas: TDD, prisma
mockeado en unitarios, review por fase, commit por fase con stage selectivo.

## FE-T1 — Modelo de datos fiscal

- [ ] **T1.1 Enumerados y modelos**: `EstadoFiscalDocumento`, `FiscalDocument`,
  `FiscalEmisionEvent` y campos fiscales mínimos en `Tenant`/`Cliente` (`regimenFiscal`,
  `taxId`, `razonSocial`, `codigoPostalFiscal`, `taxIdCliente`, `fiscalActivado`). Todo
  nullable/default — migración segura.
- [ ] **T1.2 Feature de plan**: `facturacion-fiscal` en el registry. Off por defecto.
- [ ] RED + GREEN + migración con `migrate diff` (sin aplicar todavía a la db de desarrollo
  hasta confirmar el flujo).

## FE-T2 — Emisor orquestador + interfaz del adaptador

- [ ] **T2.1 Tests puros del orquestador**: crea el documento, marca eventos, maneja rechazo
  con reintento, respeta idempotencia por factura.
- [ ] **T2.2 Implementación**: `fiscal-emision-service.ts` con cola ligera (DB-backed por
  ahora: la tabla FiscalDocument como cola, procesada por un runner programado); contrato
  `FiscalAdapter` en `fiscal-adapter.ts`; `LocalAdapter` completo.
- [ ] **T2.3 Stub CFDI documentado** (`sat-cfdi.stub.ts`): esqueleto con comentarios del flujo
  real, sin código significativo.

## FE-T3 — Acciones y eventos

- [ ] `emitirFiscalAction` (solo con feature on y tenant activo), `getDocumentoFiscalAction`
  (detalle), `reintentarFiscalAction` (si RECHAZADA). Tests de auth/gates.

## FE-T4 — UI

- [ ] Badge fiscal en lista de facturas + panel de detalle (eventos y uuid) + settings del
  emisor (tenant) + accesibilidad y español neutro.
- [ ] Si el flag está off, todo desaparece (regresión visual).

## FE-T5 — Regresión, integración y cierre

- [ ] Regresión completa sobre ventas/facturas/arqueo/devoluciones (la capa no debe afectarlas).
- [ ] Integración: factura creada en DB real → documento `TIMBRADA` tras el runner con
  `LocalAdapter`.
- [ ] Archivo del change + memoria actualizada.

## Fast-follows (documentados, no en esta fase)

1. Adaptador real (PAC/CFDI/Omnifactura/etc.) una vez confirmado el primer país de expansión.
2. XML almacenado fuera de DB si el claim llega a máximos de carga.
3. Cancelación fiscal formal (con motivo) cuando haga falta en el país de destino.
4. Descarga `CFDI` del XML al PDF estándar de la autoridad (México, Colombia…).
