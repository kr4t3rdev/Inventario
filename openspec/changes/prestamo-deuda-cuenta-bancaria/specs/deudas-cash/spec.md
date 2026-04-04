# Deudas Cash con Cuenta Bancaria — Specification

## Purpose

Describe el comportamiento del sistema al crear una Deuda Cash y registrar pagos de esa deuda, con impacto directo en el saldo de la cuenta bancaria seleccionada.

---

## Requirements

### Requirement: Selección de cuenta bancaria al crear deuda

Al crear una Deuda Cash, el sistema MUST solicitar que el usuario seleccione la cuenta bancaria en la que se recibe el dinero de la deuda contraída.

El campo `cuentaBancariaId` MUST ser obligatorio en el formulario y en el schema de validación.

#### Scenario: Creación exitosa con cuenta seleccionada

- GIVEN el usuario completó todos los campos obligatorios del form incluyendo `cuentaBancariaId`
- WHEN el usuario confirma la creación de la deuda
- THEN el sistema crea el registro `DeudaCash` con `cuentaBancariaId` vinculado
- AND el saldo de la `CuentaBancaria` seleccionada aumenta por `montoCapital`
- AND el sistema crea la `CuentaPorPagar` correspondiente en la misma transacción

#### Scenario: Intento de creación sin cuenta bancaria

- GIVEN el usuario no seleccionó una cuenta bancaria
- WHEN el usuario intenta confirmar la creación
- THEN el sistema MUST rechazar la operación con un error de validación
- AND ningún registro es creado ni ningún saldo es modificado

---

### Requirement: Atomicidad de la creación de la deuda

La creación de la deuda y el incremento del saldo bancario MUST ocurrir como una operación atómica (dentro de la misma `$transaction`).

#### Scenario: Falla durante la transacción

- GIVEN el usuario inició la creación de la deuda
- WHEN ocurre un error en cualquier paso de la transacción
- THEN el sistema MUST revertir TODOS los cambios: ninguna deuda creada, ningún saldo modificado

---

### Requirement: Impacto en saldo al pagar cuota de deuda

Al registrar un pago de una Deuda Cash, el saldo de la cuenta bancaria desde la que se paga MUST decrementarse por el monto pagado.

#### Scenario: Pago parcial exitoso

- GIVEN una deuda activa con saldo pendiente > 0
- WHEN el usuario registra un pago parcial con `monto` y `cuentaId`
- THEN el `saldoPendiente` de la `CuentaPorPagar` disminuye por `monto`
- AND el saldo de la `CuentaBancaria` (`cuentaId`) disminuye por `monto`

#### Scenario: Pago final de la deuda

- GIVEN una deuda con `saldoPendiente == monto` del pago
- WHEN el usuario registra el pago final
- THEN la deuda cambia a estado `PAGADO`
- AND el saldo de la cuenta bancaria disminuye por el monto pagado

#### Scenario: Intento de pagar monto mayor al saldo pendiente

- GIVEN una deuda con `saldoPendiente < monto` del pago
- WHEN el usuario intenta registrar el pago
- THEN el sistema MUST rechazar la operación
- AND ningún saldo bancario es modificado

#### Scenario: Saldo insuficiente en cuenta para pagar deuda

- GIVEN la cuenta bancaria seleccionada tiene saldo menor al `monto` del pago
- WHEN el usuario intenta registrar el pago
- THEN el sistema SHOULD advertir sobre el saldo insuficiente
- AND MAY rechazar la operación si el negocio no admite saldo negativo en cuentas

---

### Requirement: Compatibilidad con registros históricos

Las `DeudaCash` creadas antes de este cambio (con `cuentaBancariaId` nulo) MUST continuar funcionando sin errores. El campo `cuentaBancariaId` es nullable en la base de datos para garantizar retrocompatibilidad.

#### Scenario: Consulta de deuda histórica sin cuenta vinculada

- GIVEN una deuda creada antes de este cambio con `cuentaBancariaId = null`
- WHEN el usuario visualiza la deuda en la tabla
- THEN el sistema MUST mostrar la deuda normalmente
- AND el campo cuenta bancaria SHOULD mostrarse como "No asignada" en la UI
