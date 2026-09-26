# Delta spec — transferencias (BUG-3 + permiso de completar)

## MODIFIED Requirement: Stock disponible en punto de venta para transferencias

El cálculo de stock disponible en un punto de venta DEBE ignorar
transferencias canceladas, rechazadas o eliminadas lógicamente.

#### Scenario: entradas canceladas no suman

- **WHEN** se calcula el stock disponible para un PV destino
- **THEN** los agregados excluyen transferencias con `deletedAt` definido y
  con estado `CANCELADA` o `RECHAZADA`; una entrada `CANCELADA` ya no
  infla el disponible.

#### Scenario: salidas rechazadas no restan

- **WHEN** se calcula el stock disponible para un PV origen
- **THEN** una salida `RECHAZADA` (o `CANCELADA`, o eliminada) deja de
  descontar del disponible y la transferencia legítima posterior ya no se
  bloquea.

## MODIFIED Requirement: Permiso para completar transferencia

Completar (recibir) una transferencia DEBE exigir el permiso
`inventario.transferencias.gestionar`, alineado con el rol operativo de la
recepción física.

#### Scenario: usuario sin permiso no completa

- **WHEN** un usuario sin `inventario.transferencias.gestionar` invoca
  `completarTransferenciaAction`
- **THEN** la action falla con `FORBIDDEN` antes de leer datos.

#### Scenario: usuario con permiso completa

- **WHEN** un usuario con el permiso (p. ej. manager o dependiente) completa
  una transferencia `APROBADA`
- **THEN** la recepción procede con su comportamiento actual (claim atómico,
  stock, kardex).
