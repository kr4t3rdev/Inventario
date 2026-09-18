# Spec: Cableado de contabilidad en la app móvil

## Requisitos funcionales

### RF-1 — Un solo canal contable

El tab Contabilidad DEBE renderizar `AccountingShell` con los 9 adapters de `accounting-clients` (banking, reconciliation, receivablesPayables, cashFinancing, advances, capital, exchange, paymentTypes, logs). No DEBE renderizar `ContabilidadSurface` ni el switch de 18 módulos.

### RF-2 — Navegación de 6 módulos

DADO que el usuario abre el tab Contabilidad
CUANDO pulsa un módulo
ENTONCES se abre la superficie SDK correspondiente:
- Bancos → `BankingSurface` (banking)
- Reconciliaciones → `ReconciliationSurface` (reconciliation)
- Cuentas por cobrar y pagar → `ReceivablesPayablesSurface` (receivablesPayables)
- Préstamos y deudas → `LoansDebtsSurface` (cashFinancing)
- Anticipos → `AdvancesSurface` (advances vía `anticiposFromAccountingClient`)
- Configuración → `ConfigurationSurface` (exchange + paymentTypes + capital + logs)

### RF-3 — Sin botones muertos

No DEBE existir ningún elemento de navegación contable cuyo `onPress` deje al usuario en el mismo menú (estado sin `case`).

### RF-4 — `accountingClients` llega al shell

`App.tsx` DEBE pasar la prop `accountingClients` a `<BusinessShell>`. Los 5 clients intermedios (`bankAccountsApi`, `accountsReceivableApi`, `accountsPayableApi`, `exchangeApi`, `advancesApi`) DEJAN de crearse y de pasarse, porque su responsabilidad queda cubierta por `accountingClients`.

### RF-5 — Tipos estrictos

`BusinessShell` DEBE declarar `accountingClients: AccountingClients` como prop requerida (no opcional).

## Requisitos no funcionales

### RNF-1 — Sin regresión de tests

La suite DEBE mantenerse verde: ≥ 498 tests, typecheck limpio en el repo móvil.

### RNF-2 — Accesibilidad

Se MANTIENEN los `accessibilityLabel` y roles de `AccountingShell` y sus superficies. La selección de módulo sigue siendo una `Pressable` con `accessibilityRole="button"`.

## Escenarios (Given/When/Then)

### E1 — Contabilidad muestra los módulos

DADO un usuario autenticado
CUANDO pulsa la pestaña "Contabilidad"
ENTONCES ve exactamente 6 entradas: Bancos, Reconciliaciones, Cuentas por cobrar y pagar, Préstamos y deudas, Anticipos y Configuración.

### E2 — Anticipos reutiliza el adaptador existente

DADO que el usuario pulsa "Anticipos"
CUANDO `AccountingShell` recibe `accountingClients.advances` (`AccountingAdvancesApiClient`)
ENTONCES se transforma con `anticiposFromAccountingClient` a `AnticiposApiClient` y `AdvancesSurface` lista los anticipos.

### E3 — Volver desde un módulo

DADO que el usuario está dentro de un módulo contable
CUANDO pulsa "Volver a Contabilidad"
ENTONCES regresa al menú de 6 módulos.

## RFC 2119

- "DEBE" / "DEJAN" expresan requisitos normativos.
- "SE MANTIENEN" expresa invariante de accesibilidad que no debe degradarse.