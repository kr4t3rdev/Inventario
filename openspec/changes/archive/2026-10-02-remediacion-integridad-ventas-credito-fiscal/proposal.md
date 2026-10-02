# Proposal: Remediación de integridad en ventas, crédito y emisión fiscal

## Intent

Corregir seis brechas detectadas en ventas: crédito omitido al facturar pedidos, carreras en saldo/crédito de venta directa, comisiones de devoluciones imputadas al mes incorrecto, emisiones fiscales atascadas en `PROCESANDO`, emisión de una factura ajena desde una acción específica y aceptación de vuelto inconsistente.

## Scope

### In Scope

- Validar el cupo de crédito al **facturar** un pedido, no al crearlo ni mediante reserva de cupo; conservar el permiso `ventas.venta.credito-override` y exigir motivo persistido y auditable para excepciones.
- Mover la verificación de saldo preexistente y límite de crédito de la venta directa al mismo límite transaccional que crea la venta, con control de concurrencia/reintentos acotados para impedir aprobaciones simultáneas que excedan el cupo.
- Imputar la reversión de comisiones por nota de crédito al período de la venta original, incluso cuando la devolución se registra en otro mes; definir tratamiento explícito de períodos cerrados antes de activar la corrección histórica.
- Introducir recuperación/reconciliación explícita para emisiones fiscales inciertas en `PROCESANDO`, sin reenvío automático al proveedor; hacer que la acción de emitir afecte exclusivamente la factura solicitada y su tenant.
- Validar en servidor que, cuando se proporciona `cambioDevuelto`, coincida con la diferencia calculada entre efectivo recibido y efectivo exigible; mantener compatible el payload que omite el campo.
- Cubrir cada frontera con pruebas de regresión, incluidas concurrencia, aislamiento multi-tenant y devoluciones entre períodos.

### Out of Scope

- Reservar crédito al crear pedidos, cambiar globalmente las políticas de crédito o eliminar `ventas.venta.credito-override`.
- Reenviar automáticamente solicitudes fiscales de resultado incierto, emitir facturas de forma masiva desde la acción individual o sustituir el proveedor fiscal.
- Rediseñar la UI de ventas, reescribir el motor de precios o modificar otros flujos de contabilidad fuera de los ajustes imprescindibles de comisiones.

## Approach

Reutilizar el cálculo de crédito existente y hacerlo obligatorio en ambos puntos de materialización de la venta; ejecutar lectura y escritura bajo garantías transaccionales suficientes para serializar consumos concurrentes del mismo cliente y aplicar override únicamente con permiso y motivo auditado. Calcular los ajustes de comisiones por referencia a la venta original y definir una conciliación/backfill idempotente para datos históricos, sin reescribir períodos cerrados silenciosamente. Separar estados fiscales confirmados, fallidos e inciertos: registrar evidencia y habilitar consulta/reconciliación o intervención autorizada antes de decidir un eventual nuevo intento. El comando de emisión debe seleccionar por ID y tenant, no por antigüedad de pendientes. Endurecer el esquema de entrada del vuelto respetando los importes y redondeos monetarios del flujo actual.

## Affected Areas

| Area | Impact | Description |
|------|--------|-------------|
| `src/features/ventas/services/venta-lifecycle-service.ts`, `src/features/ventas/services/venta-mutation-service.ts` | Modified | Facturación de pedidos y venta directa: crédito, transacciones y override auditable. |
| `src/features/crm/services/credito-calculo.ts` | Modified/Reviewed | Cálculo de saldo/cupo compartido en el límite de validación. |
| `src/features/empleados/services/comision-service.ts` | Modified | Devoluciones vinculadas al período de la venta original. |
| `src/features/facturas/actions-fiscal.ts`, `src/features/facturas/services/fiscal-emision-service.ts` | Modified | Selección exacta de factura y reconciliación fiscal segura. |
| `src/features/ventas/schemas.ts` | Modified | Validación del cambio devuelto opcional. |
| `prisma/schema.prisma`, `prisma/migrations/` | Conditional | Solo si se requiere persistir lease/evidencia fiscal o ajustes históricos de comisiones. |

## Tradeoffs

- Validar cupo al facturar permite pedidos que luego no puedan facturarse; evita inmovilizar crédito por pedidos pendientes.
- Serialización y reintentos reducen carreras a costa de mayor contención bajo ventas simultáneas; el fallo por conflicto debe ser explícito, no autorizar crédito por defecto.
- Imputación retroactiva corrige reportes históricos, pero puede modificar cifras ya informadas; períodos cerrados requieren política de ajuste/reapertura aprobada.
- Bloquear el reenvío fiscal incierto exige operación de conciliación manual o consulta al proveedor; prioriza evitar duplicados fiscales sobre recuperación automática inmediata.

## Risks

| Risk | Likelihood | Mitigation |
|------|------------|------------|
| Doble consumo del mismo cupo o deadlocks | Medium | Pruebas concurrentes con base real, aislamiento adecuado, reintentos limitados y rechazo seguro. |
| Recalcular comisiones de meses cerrados altera liquidaciones | High | Definir política de períodos cerrados, vista previa por tenant y backfill idempotente/auditable antes de aplicar. |
| Duplicación de comprobantes ante respuesta fiscal incierta | High | Prohibir reenvío automático; reconciliar contra proveedor con identidad externa y evidencia verificable. |
| Compatibilidad de consumidores antiguos de vuelto | Medium | Mantener ausencia del campo; pruebas de payloads anteriores y errores claros solo cuando se envía una diferencia inválida. |
| Cambios concurrentes en worktree, especialmente `facturacion-workflow.ts` | Medium | No sobrescribir cambios existentes; revisar diff antes de implementar y coordinar integración del flujo. |

## Migrations and Rollback Plan

Evaluar en diseño si hacen falta campos/índices para estado fiscal, evidencias y reconciliación o para liquidaciones históricas. Si son necesarios, migraciones Prisma aditivas y despliegue gradual: esquema antes del código, backfill verificable por tenant/período y monitoreo de inconsistencias. No alterar datos históricos sin política aprobada para cierres.

Rollback: detener nuevos flujos de conciliación/backfill y revertir aplicación y validaciones mediante despliegue anterior; conservar registros fiscales y de auditoría, nunca borrar ni reenviar estados inciertos al revertir. Si hubo migraciones aditivas, dejar columnas compatibles hasta completar reconciliación y liquidaciones pendientes; revertir ajustes de comisión solo mediante compensaciones trazables.

## Dependencies and Open Questions

- Diseñar la garantía concreta de serialización para crédito compartida por venta directa y facturación de pedidos; confirmar rutas de override y modelo de auditoría vigente.
- Confirmar API del proveedor fiscal para consultar por identificador/idempotencia y definir responsable y permisos de conciliación manual.
- **Pendiente**: política para devoluciones cuyo mes de venta original ya está cerrado o liquidado: reapertura controlada, ajuste retroactivo versionado o asiento de compensación asociado al período original. No ejecutar backfill hasta resolverlo.
- Confirmar tolerancia/precisión monetaria y fuente del efectivo exigible en pagos mixtos para `cambioDevuelto`.

## Success Criteria

- [ ] Un pedido no reserva cupo; al facturarlo se rechaza si excede el crédito salvo override autorizado con motivo auditado.
- [ ] Dos ventas concurrentes del mismo cliente no superan conjuntamente saldo/cupo disponible; los conflictos se rechazan o reintentan sin efectos parciales.
- [ ] Una devolución de otro mes corrige la comisión asociada al período de la venta original conforme a política aprobada para períodos cerrados, sin doble descuento.
- [ ] Una emisión incierta queda bloqueada para reenvío automático y dispone de reconciliación/intervención trazable; emitir factura A nunca procesa factura B ni otro tenant.
- [ ] `cambioDevuelto` inconsistente se rechaza cuando está presente; su ausencia conserva la compatibilidad previa.
- [ ] Pruebas unitarias e integración enfocadas pasan, y ningún cambio ajeno ni archivo secreto se modifica.
