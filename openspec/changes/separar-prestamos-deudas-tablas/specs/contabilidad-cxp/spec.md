# Delta for contabilidad/cuentas-por-pagar

## MODIFIED Requirements

### Requirement: API Cuentas por Pagar excluye deudas cash

(Previously: El endpoint retorna TODAS las cuentas por pagar incluyendo `tipoDeuda: 'DEUDA_CASH'`)

El endpoint GET `/api/contabilidad/cuentas-por-pagar` MUST excluir registros con `tipoDeuda: 'DEUDA_CASH'` del resultado.

#### Scenario: API no retorna deudas cash

- GIVEN 4 cuentas por pagar: 2 COMPRA + 2 DEUDA_CASH
- WHEN se consulta GET `/api/contabilidad/cuentas-por-pagar`
- THEN retorna solo las 2 cuentas con `tipoDeuda: 'COMPRA'`

#### Scenario: Filtro se combina con tipo y estado

- GIVEN 2 compras PENDIENTE + 1 compra PAGADA + 1 deuda PENDIENTE
- WHEN se consulta con `?estado=PENDIENTE&tipo=compra`
- THEN retorna solo las 2 compras PENDIENTE

### Requirement: Tabla CxP sin lógica de deudas cash

(Previously: La tabla tenía detección `tipoDeuda === 'DEUDA_CASH'` para redirigir a `PagoDeudaModal` en lugar del diálogo estándar de pago)

La tabla CxP MUST renderizar solo compras/servicios. MUST NOT contener lógica condicional para deudas cash ni referencia a `PagoDeudaModal`.

#### Scenario: Pago siempre usa diálogo estándar

- GIVEN cualquier cuenta por pagar visible en la tabla
- WHEN el usuario hace clic en "Registrar Pago"
- THEN abre `PagarCuentaPorPagarDialog` (nunca `PagoDeudaModal`)
