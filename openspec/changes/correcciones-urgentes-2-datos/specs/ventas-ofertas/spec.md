# Delta spec — ventas/ofertas (limbo de ofertas)

## MODIFIED Requirement: Anulación de venta vinculada a oferta

Al anular una venta vinculada a una oferta, el sistema DEBE liberar el
vínculo y dejar la oferta en un estado que permita reintentar la conversión
o facturación.

#### Scenario: anulación limpia el vínculo

- **WHEN** `anularVentaPorEstado` anula una venta con `ofertaId` (estado
  PEDIDO, ENTREGADA o FACTURADA)
- **THEN** el claim atómico de anulación establece `ofertaId: null` en la
  misma operación que marca `ANULADA`/`deletedAt`, y la oferta asociada pasa
  a `ACEPTADA` (si estaba en `ACEPTADA` o `FACTURADA`).

#### Scenario: oferta liberada es reconvertible

- **WHEN** tras la anulación se convierte la oferta a pedido o se factura
- **THEN** la operación tiene éxito (no hay `P2002` por el unique de
  `Venta.ofertaId`).

## MODIFIED Requirement: Guarda de venta vinculada activa

La conversión y la facturación directa de una oferta DEBEN bloquearse si la
oferta ya tiene una venta NO anulada vinculada, con error de negocio y no un
fallo de base de datos.

#### Scenario: factura directa con venta activa se bloquea

- **WHEN** `facturarOfertaWorkflow` se ejecuta sobre una oferta con una venta
  viva (`deletedAt: null`) vinculada
- **THEN** el workflow falla con `VALIDATION_ERROR` y mensaje de negocio, sin
  crear venta ni factura.

#### Scenario: P2002 como red de seguridad

- **WHEN** una carrera hace que el `venta.create` con `ofertaId` ocupado
  choque con la restricción única
- **THEN** el error se traduce a un error de negocio amigable (código
  `VALIDATION_ERROR`) en lugar de propagar `P2002` como fallo 500.
