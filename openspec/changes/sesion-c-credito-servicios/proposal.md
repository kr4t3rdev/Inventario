# Propuesta — Sesión C: crédito y servicios (límite, costo, CxC y factura-documento)

## Decisión ejecutiva

Cerrar los hallazgos 4 y 8 de la re-auditoría de módulos (2026-09-26) en el dominio **crédito + venta de servicios**, en seis fases TDD: (C-1) escritor de UI para el límite de crédito del cliente con permiso y auditoría; (C-2) enforcement del límite en la venta de servicios a crédito y revalidación al facturar pedidos de productos; (C-3) costo server-side de servicios desde el catálogo; (C-4) atomicidad venta+CxC en modo mixto y ajuste de la CxC en update; (C-5) delete con protección de CxC y FK Restrict; (C-6) factura-documento para servicios extendiendo `Factura`. Es trabajo correctivo de integridad financiera: no cambia el modelo de precios (LP-0) ni la base caja contable.

## Why

Verificado en código sobre `main` (b4be12ba) el 2026-09-27:

1. **`Cliente.limiteCredito` (centavos, `Int?`) no tiene ningún escritor en `src/`.** Solo lo lee `venta-mutation-service` (enforcement CRM-T2 de productos), `cliente-360` (display con badge "excedido") y los tests. Editarlo hoy exige SQL directo. La docstring de `cliente-360.tsx:32-33` lo declara pendiente.
2. **La venta de servicios a crédito no valida el límite.** `createVentaServicioAction` (mixto y legacy) crea CxC por el total sin leer `limiteCredito` ni `superaLimiteCredito`. Y `facturarVenta` (PVE, `venta-lifecycle-service.ts:250-439`) tampoco revalida: un pedido ENTREGADA se puede facturar a crédito por encima del tope sin error ni override.
3. **El costo de la venta de servicios se acepta del payload** (`costo: linea.costo ?? 0` en mixto, `data.costo ?? 0` en legacy, `updateData.costo = data.costo` en update; avalado por los 3 schemas Zod y editable en el carrito). Ese costo manipulable alimenta el reporte de gastos de servicios vendidos (`actions-reconciliacion.ts:950-966`, `monto = costo × cantidad`).
4. **Modo mixto no atómico:** las filas `VentaServicios` se crean en un `$transaction` de array (actions.ts:112-131) y las CxC de crédito en OTRO `$transaction` separado (actions.ts:134-148). Un fallo entre ambos deja ventas a crédito sin CxC (deuda invisible). El modo legacy sí es atómico.
5. **`updateVentaServicioAction` nunca toca la CxC:** cambiar cantidad o cliente deja la deuda con el monto/cliente original.
6. **`deleteVentaServicioAction` solo protege contra reconciliaciones** (actions.ts:375-383); la FK `CuentaPorCobrar.ventaServicioId` es `ON DELETE SET NULL` (migración `20260912000005_cxc_venta_servicio`), así que borrar la venta deja una CxC huérfana con `ventaServicioId = null` y `montoDeuda` viva en cartera.
7. **La venta de servicios no genera documento:** `Factura.ventaId` es 1:1 con `Venta` (productos), `VentaServicios` no tiene estados ni relación con `Factura`, y los cobros de servicios (`reconcileService`) jamás mueven la CxC a `PAGADA` ni marcan una factura.

## What Changes

| Hoy | Objetivo |
|---|---|
| Límite de crédito solo editable por SQL | Dialog en la vista 360 del cliente + server action con permiso dedicado, validación y auditoría |
| Servicios a crédito sin validar tope; facturar pedidos sin revalidar | Mismo enforcement que productos POS (CREDITO_EXCEDIDO + permiso `ventas.venta.credito-override` + auditoría) en crear venta de servicio y en facturar |
| Costo de servicio aceptado del payload | `Servicios.costo` en catálogo; la venta persiste el snapshot del catálogo; el payload no puede fijarlo |
| Mixto: venta y CxC en transacciones separadas | Una sola transacción interactiva para ventas + CxC (+ auditoría de override) |
| Update no ajusta CxC | Update ajusta `montoDeuda`/`clienteId` de la CxC en la misma transacción, con revalidación de tope y guarda contra cobros registrados |
| Delete deja CxC huérfana (SetNull) | Guard `VENTA_CON_CXC_ACTIVA` + FK `Restrict`; CxC anuladas se eliminan junto a la venta en la misma transacción |
| Servicios sin documento de factura | `Factura.ventaServicioId` (1:1), action `facturarVentaServicioAction` con numeración de serie; el cobro de servicio pasa Factura y CxC a `PAGADA` |

## No-goals

- No se toca el enforcement de crédito de la venta de productos POS (`venta-mutation-service`) salvo reutilizar sus reglas puras y su permiso.
- No se implementa ciclo de estados propio para `VentaServicios` (v1: el estado del documento vive en `Factura.estado` y el de la deuda en `CxC.estado`; decisión en design.md §6).
- No se toca el flujo de ofertas (`facturar-oferta-workflow` también omite el tope): es territorio de la Sesión E.
- No se tocan las cascadas `VentaServicios.servicioId`/`clienteId` ni el guard de borrado de catálogo/categoría (Sesión A, pendiente de re-integración a main).
- No se implementa timbrado fiscal (`FiscalDocument`) para servicios: queda como anexo opt-in posterior.
- No se añaden cobros parciales de servicios (`reconcileService` sigue exigiendo monto == total).
- No se cambia la vista imprimible `/busy/invoice/print` más allá de soportar facturas de servicio si el costo es bajo; si no, queda documentado como pendiente.

## Solución propuesta (resumen; detalle en design.md)

Serie **C** en 6 fases, cada una con RED→GREEN→REFACTOR, code-review y commit propio:

1. **C-1 — Límite de crédito editable.** Permiso `operaciones.clientes.limite-credito` (manager, sensitive); `updateLimiteCreditoClienteAction` con auditoría `LIMITE_CREDITO_ACTUALIZADO` (valor anterior → nuevo); dialog en `cliente-360` junto al badge de excedido.
2. **C-2 — Enforcement del tope en servicios y al facturar.** Servicio compartido `credito-enforcement` (reutiliza `saldoVivoCliente`/`superaLimiteCredito` y el permiso `ventas.venta.credito-override`); llamado por `createVentaServicioAction` (CREDITO, mixto y legacy) y por `facturarVenta` (monto a crédito del input) con auditoría `CREDITO_OVERRIDE` dentro de la transacción.
3. **C-3 — Costo server-side.** Columna `Servicios.costo` (catálogo editable como el precio); `assertServiciosDelTenant` devuelve el snapshot de costo; create persiste el costo del catálogo y los schemas dejan de aceptar `costo` (strict lo rechaza); UI de venta deja de editarlo.
4. **C-4 — Atomicidad y update coherente.** Modo mixto en una `$transaction` interactiva; `updateVentaServicioAction` ajusta la CxC en la misma transacción (monto por cambio de cantidad, cliente con revalidación de tope), rechaza cambios de total con cobros registrados o CxC pagada.
5. **C-5 — Delete con protección de CxC.** Guard `VENTA_CON_CXC_ACTIVA`; CxC `ANULADA` se borra junto a la venta en la misma transacción; FK `CuentaPorCobrar.ventaServicioId` pasa a `Restrict` (migración revisada).
6. **C-6 — Factura-documento para servicios.** `Factura.ventaServicioId` unique; helper compartido de serie/consecutivo; `facturarVentaServicioAction` (permiso `ventas.servicios.facturar`) crea la Factura y enlaza la CxC existente; `reconcileService` pasa Factura y CxC a `PAGADA` al cobrar; botón Facturar en el historial de servicios.

## Impact

| Elemento | Magnitud | Afectación |
|---|---|---|
| Schema | 3 cambios aditivos/1 FK | `Servicios.costo Int @default(0)`; `Factura.ventaServicioId String? @unique`; `CuentaPorCobrar.ventaServicioId` SetNull→Restrict. 3 migraciones pequeñas revisadas (producción aplica db-push) |
| Permisos | +2 claves | `operaciones.clientes.limite-credito`, `ventas.servicios.facturar` + fixture de paridad |
| AuditLog | +1 entidad | `'CLIENTE'` y `'VENTA_SERVICIO'` en la union `AuditEntity` |
| Payloads | Breaking controlado | Los schemas de venta de servicios dejan de aceptar `costo`; UI actualizada en el mismo deploy |
| UI | 3 superficies | Dialog límite en cliente-360; costo solo-lectura del catálogo en carrito/form; botón Facturar en historial de servicios |
| Tests | ~6 archivos nuevos/extendidos |Mocks de `@/lib/prisma` según contrato MM-B; sin DB real |

## Criterios de aceptación

1. Un manager edita el límite desde la UI y el cambio queda auditado con valor anterior/nuevo; quien no tiene el permiso recibe `FORBIDDEN`.
2. Una venta de servicios a crédito que supere el tope del cliente se rechaza con `CREDITO_EXCEDIDO` (mixto y legacy), no crea filas; con el permiso de override pasa y queda auditada.
3. Facturar un pedido ENTREGADA a crédito por encima del tope se rechaza con `CREDITO_EXCEDIDO` antes de crear Factura/CxC; con override queda auditado.
4. El costo persistido de toda venta de servicios nueva es el del catálogo aunque el payload envíe otro valor; el update ya no acepta costo.
5. Un fallo entre la creación de ventas y CxC en modo mixto deja cero filas de ambas (misma transacción).
6. Update de cantidad/cliente ajusta la CxC en la misma transacción; con cobros registrados o CxC pagada se rechaza.
7. No se puede eliminar una venta de servicio con CxC activa (`VENTA_CON_CXC_ACTIVA`); con CxC anulada se limpia en la misma transacción; la FK es Restrict.
8. Toda venta de servicio con cliente puede facturarse una única vez con número de serie; el cobro posterior marca Factura y CxC como `PAGADA`.
9. Suite focalizada verde, lint y typecheck sin errores nuevos; ningún test unitario toca DB real (barrera MM-B).

## Riesgos

| Riesgo | Mitigación |
|---|---|
| UI desplegada envía `costo` y los schemas strict lo rechazan | UI y schemas se despliegan juntos; el error es explícito (`VALIDATION_ERROR`) y la ventana de riesgo es la misma que la del deploy |
| FK Restrict en `CuentaPorCobrar.ventaServicioId` bloquea deletes legítimos | El guard previo da mensaje accionable; las CxC anuladas se limpian en la transacción; producción usa db-push con los mismos datos |
| Doble conteo del tope al revalidar en update/facturar de servicios | El helper admite excluir la CxC propia del saldo vivo y sumar el nuevo monto; test dedicado |
| Refactor de numeración de serie rompe facturación de productos | Helper extraído con regresión completa de `venta-lifecycle.test.ts` antes de usarlo en servicios |
| Payloads legacy (móvil) que envíen costo | Verificación con grep de writers móviles de venta de servicios antes del cambio; el rechazo es visible y el fix es del cliente |

## Rollback

Cada fase es independiente y reversible: los cambios de schema son aditivos salvo el `onDelete` (revertir migración devuelve SetNull); el permiso nuevo sin asignar equivale a comportamiento anterior para roles no-manager; el enforcement de crédito en servicios y facturación se neutraliza eliminando la llamada al helper (código aislado). Ninguna fase borra datos ni requiere backfill.
