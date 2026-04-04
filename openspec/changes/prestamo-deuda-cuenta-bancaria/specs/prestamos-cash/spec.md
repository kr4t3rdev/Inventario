# Préstamos Cash con Cuenta Bancaria — Specification

## Purpose

Describe el comportamiento del sistema al crear un Préstamo Cash y registrar pagos de ese préstamo, con impacto directo en el saldo de la cuenta bancaria seleccionada.

---

## Requirements

### Requirement: Selección de cuenta bancaria al crear préstamo

Al crear un Préstamo Cash, el sistema MUST solicitar que el usuario seleccione la cuenta bancaria desde la que se entrega el dinero prestado.

El campo `cuentaBancariaId` MUST ser obligatorio en el formulario y en el schema de validación.

#### Scenario: Creación exitosa con cuenta seleccionada

- GIVEN el usuario completó todos los campos obligatorios del form incluyendo `cuentaBancariaId`
- WHEN el usuario confirma la creación del préstamo
- THEN el sistema crea el registro `PrestamoCash` con `cuentaBancariaId` vinculado
- AND el saldo de la `CuentaBancaria` seleccionada disminuye por `montoCapital`
- AND el sistema crea la `CuentaPorCobrar` correspondiente en la misma transacción

#### Scenario: Intento de creación sin cuenta bancaria

- GIVEN el usuario no seleccionó una cuenta bancaria
- WHEN el usuario intenta confirmar la creación
- THEN el sistema MUST rechazar la operación con un error de validación
- AND ningún registro es creado ni ningún saldo es modificado

#### Scenario: Saldo insuficiente en cuenta seleccionada

- GIVEN la cuenta bancaria seleccionada tiene saldo menor a `montoCapital`
- WHEN el usuario intenta confirmar la creación
- THEN el sistema MUST rechazar la operación con un error claro de saldo insuficiente
- AND ningún registro es creado ni ningún saldo es modificado

---

### Requirement: Atomicidad de la creación del préstamo

La creación del préstamo y el decremento del saldo bancario MUST ocurrir como una operación atómica (dentro de la misma `$transaction`).

#### Scenario: Falla durante la transacción

- GIVEN el usuario inició la creación del préstamo
- WHEN ocurre un error en cualquier paso de la transacción (falla DB, validación, etc.)
- THEN el sistema MUST revertir TODOS los cambios: ningún préstamo creado, ningún saldo modificado

---

### Requirement: Impacto en saldo al cobrar cuota de préstamo

Al registrar un pago (cobro de cuota) de un Préstamo Cash, el saldo de la cuenta bancaria que recibe el dinero MUST incrementarse por el monto cobrado.

#### Scenario: Cobro parcial exitoso

- GIVEN un préstamo activo con saldo pendiente > 0
- WHEN el usuario registra un pago parcial con `monto` y `cuentaId`
- THEN el `saldoPendiente` de la `CuentaPorCobrar` disminuye por `monto`
- AND el saldo de la `CuentaBancaria` (`cuentaId`) aumenta por `monto`

#### Scenario: Cobro final del préstamo

- GIVEN un préstamo con `saldoPendiente == monto` del pago
- WHEN el usuario registra el pago final
- THEN el préstamo cambia a estado `PAGADO`
- AND el saldo de la cuenta bancaria aumenta por el monto cobrado

#### Scenario: Intento de cobrar monto mayor al saldo pendiente

- GIVEN un préstamo con `saldoPendiente < monto` del pago
- WHEN el usuario intenta registrar el pago
- THEN el sistema MUST rechazar la operación
- AND ningún saldo bancario es modificado
