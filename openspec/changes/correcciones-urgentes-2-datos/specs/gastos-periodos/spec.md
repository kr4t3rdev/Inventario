# Delta spec — gastos/períodos (enforcement server del período cerrado)

## ADDED Requirement: Escrituras de gastos validan período en servidor

Toda escritura de gasto de explotación DEBE validar en servidor que el
período contable de la fecha de negocio esté abierto para escritura,
independientemente de la validación client-side.

#### Scenario: alta en período cerrado se rechaza

- **WHEN** `createGastosDEAction` se ejecuta con `periodo` ("YYYY-MM") que
  resuelve a un período `CERRADO`/`APROBADO`/`EN_CIERRE` (guard en enforce)
- **THEN** la action falla con el código del guard (`PERIODO_CERRADO` o
  equivalente) y no crea el gasto.

#### Scenario: edición y aprobación validan el período del gasto

- **WHEN** `updateGastosDEAction`, `aprobarGastoDEAction` o
  `rechazarGastoDEAction` operan sobre un gasto cuyo `periodo` está cerrado
- **THEN** la action falla con el código del guard; si `update` cambia el
  `periodo`, se valida también el período destino.

#### Scenario: eliminación en período cerrado se rechaza

- **WHEN** `deleteGastosDEAction` o `deleteGastosDEBulkAction` intentan
  eliminar gastos de un período cerrado
- **THEN** la action falla con el código del guard y no se ejecutan las
  reversiones de efectos.

## ADDED Requirement: API móvil de gastos respeta el período

#### Scenario: alta móvil en período cerrado se rechaza

- **WHEN** `POST /api/mobile/expenses` recibe una `fecha` que resuelve a un
  período cerrado (guard en enforce)
- **THEN** la ruta responde 400 con el código del guard y no crea el gasto.

#### Scenario: configuración del guard se respeta

- **WHEN** el guard opera en modo `audit-only` o `disabled`
  (`PERIODO_CONTABLE_MODE`)
- **THEN** las escrituras no se bloquean (comportamiento actual preservado).
