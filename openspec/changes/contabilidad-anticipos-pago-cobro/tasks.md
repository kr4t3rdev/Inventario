# Tasks: Anticipos de Pago y Cobro en Contabilidad

## Phase 1: Base de Datos y Contratos de Dominio

- [x] 1.1 Modificar `prisma/schema.prisma` para crear `Anticipo` y `AnticipoMovimiento`, enums (`TipoAnticipo`, `EstadoAnticipo`, `ContextoAnticipo`) y relaciones con `Contrato`, `Vendor`, `Cliente`, `Factura` y `CompraProducto`.
- [x] 1.2 Agregar índices/constraints de integridad en `prisma/schema.prisma` para estado/saldo y constraint único por idempotencia (`anticipoId + idempotencyKey`) en movimientos.
- [ ] 1.3 Crear migración Prisma y validar que `pnpm prisma generate` y `pnpm prisma migrate dev` aplican sin romper modelos existentes.
- [x] 1.4 Extender `src/app/models/model.ts` con interfaces `Anticipo`, `AnticipoMovimiento`, `CreateAnticipoRequest`, `ExecuteAnticipoRequest` y `ExecuteAnticipoResponse`.
- [x] 1.5 Crear `src/lib/services/anticipos-workflow.types.ts` con errores tipados de negocio (`NO_ELEGIBLE`, `CONCURRENCIA`, `IDEMPOTENCIA_CONFLICTO`, `TASA_INVALIDA`, `REVERSO_REQUERIDO`).

## Phase 2: Motor de Anticipos y Mitigación de Riesgos Críticos

- [x] 2.1 Crear `src/lib/services/anticipos-workflow.ts` con operación `createAnticipo` validando contrato, contraparte, cuenta/tarjeta origen, monto y moneda.
- [x] 2.2 Implementar en `anticipos-workflow.ts` validación de elegibilidad (estado `RESERVADO`, saldo > 0, contraparte coincidente, compatibilidad de moneda, vigencia).
- [x] 2.3 Implementar control de concurrencia en `anticipos-workflow.ts` usando `prisma.$transaction` + update condicional por estado/saldo para permitir una sola ejecución exitosa.
- [x] 2.4 Implementar idempotencia en `anticipos-workflow.ts` reutilizando `src/lib/idempotency.ts` y persistiendo replay consistente por `idempotencyKey`.
- [x] 2.5 Implementar validación de moneda y tasa vigente en `anticipos-workflow.ts` consultando tasas de cambio y bloqueando ejecución si no hay tasa válida.
- [x] 2.6 Integrar ejecución de anticipo de pago con `src/lib/services/pago-gastos-workflow.ts` para crear una sola reconciliación de gasto y registrar movimiento financiero consistente.
- [x] 2.7 Integrar ejecución de anticipo de cobro con `src/lib/services/facturacion-ventas-workflow.ts` para reconciliación de venta y cierre de factura sin duplicidad.
- [x] 2.8 Implementar reversión explícita en `anticipos-workflow.ts` que recomponga saldo/estado, cree movimiento `REVERSO` y obligue reversión antes de anulación de documento reconciliado.
- [x] 2.9 Registrar libro de movimientos (`CREACION_RESERVA`, `EJECUCION`, `REVERSO`, `ANULACION`) en `AnticipoMovimiento` con balance antes/después y referencias cruzadas.

## Phase 3: API Contable y Endpoints de Integración

- [x] 3.1 Crear `src/app/api/contabilidad/anticipos/route.ts` con GET (filtros por tipo/estado/contraparte/moneda) y POST (creación de anticipos) usando validación Zod.
- [x] 3.2 Crear `src/app/api/contabilidad/anticipos/disponibles/route.ts` para exponer anticipos elegibles por contexto (`compra`, `factura`) y contraparte.
- [x] 3.3 Crear `src/app/api/contabilidad/anticipos/[id]/ejecutar/route.ts` con `idempotencyKey` obligatoria y mapeo de errores de concurrencia/idempotencia.
- [x] 3.4 Crear `src/app/api/contabilidad/anticipos/[id]/revertir/route.ts` para reversión contable segura y trazable.
- [x] 3.5 Modificar `src/app/api/compras-productos/route.ts` para aceptar forma de pago por anticipo, ejecutar flujo y bloquear cobertura incompleta.
- [x] 3.6 Modificar `src/app/api/ofertas/[id]/facturar/route.ts` para aceptar `anticipoCobroId` y `idempotencyKey` y ejecutar anticipo al crear factura.
- [x] 3.7 Modificar `src/app/api/ventas/route.ts` para soportar cobro anticipado en facturación directa sin romper flujos existentes.
- [x] 3.8 Añadir regla de anulación segura en endpoints de documentos impactados para exigir reversión previa cuando exista anticipo ejecutado.

## Phase 4: Frontend y Wiring de Formas de Pago

- [x] 4.1 Modificar `src/lib/redux/services/contabilidadApi.tsx` para incluir endpoints de anticipos (crear, listar, disponibles, ejecutar, revertir).
- [x] 4.2 Modificar `src/lib/redux/services/comprasProductosApi.tsx` para enviar `anticipoPagoId`, `idempotencyKey` y metadatos de ejecución.
- [x] 4.3 Modificar `src/lib/redux/services/ofertasApi.tsx` para enviar `anticipoCobroId` e `idempotencyKey` al facturar oferta.
- [x] 4.4 Modificar `src/components/compras/compra-producto-form.tsx` para mostrar “Pago anticipado”, filtrar anticipos elegibles y mostrar validación de saldo/cobertura.
- [x] 4.5 Modificar `src/components/ofertas/oferta-form.tsx` para seleccionar cobro anticipado en factura derivada de oferta.
- [x] 4.6 Modificar `src/components/ventas/pv-interface.tsx` para exponer cobro anticipado en factura directa de producto/servicio.
- [x] 4.7 Implementar feedback de UX en formularios para conflictos de concurrencia, conflictos idempotentes y bloqueos por tasa inválida.

## Phase 5: Pruebas para Cierre de Riesgos

- [x] 5.1 Ampliar `src/lib/services/__tests__/pago-gastos-workflow.test.ts` con casos de pago anticipado, no duplicidad y cobertura completa obligatoria.
- [x] 5.2 Ampliar `src/lib/services/__tests__/facturacion-ventas-workflow.test.ts` con casos de cobro anticipado, idempotencia replay y rechazo por payload conflictivo.
- [x] 5.3 Crear `src/app/api/contabilidad/anticipos/__tests__/route.test.ts` para creación/listado y validaciones de datos obligatorios.
- [x] 5.4 Crear `src/app/api/contabilidad/anticipos/[id]/ejecutar/__tests__/route.test.ts` para concurrencia: dos ejecuciones simultáneas, solo una exitosa.
- [x] 5.5 Crear `src/app/api/contabilidad/anticipos/[id]/ejecutar/__tests__/route.test.ts` para idempotencia: mismo key mismo resultado, mismo key payload distinto conflicto.
- [x] 5.6 Crear `src/app/api/contabilidad/anticipos/[id]/ejecutar/__tests__/route.test.ts` para moneda: misma moneda sin conversión, distinta moneda sin tasa válida bloquea.
- [x] 5.7 Crear `src/app/api/contabilidad/anticipos/[id]/revertir/__tests__/route.test.ts` para reversión obligatoria y recomposición de saldo/estado.
- [x] 5.8 Crear pruebas de regresión para flujos actuales de compra/facturación sin anticipos en `src/app/api/compras-productos` y `src/app/api/ventas`.

## Phase 6: Rollout Controlado y Operación Segura

- [x] 6.1 Implementar flag `ENABLE_ANTICIPOS` en rutas y UI para habilitación progresiva por etapas.
- [x] 6.2 Definir en código y tests la política final de vigencia de anticipos (sin vigencia, por fecha o por contrato) y aplicarla de forma consistente.
- [x] 6.3 Estandarizar nomenclatura de forma de pago (`ANTICIPO_PAGO` y `ANTICIPO_COBRO`) en backend, frontend y tipos para evitar inconsistencias.
- [x] 6.4 Añadir métricas y logs operativos en `src/app/api/contabilidad/logs/route.ts` para monitorear conflictos de concurrencia, replay idempotente y reversos.
- [ ] 6.5 Ejecutar validación final de calidad con `pnpm run lint` y `pnpm run test:run` asegurando cero regresiones antes de habilitar el flag.
