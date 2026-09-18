# SDD Proposal: Cablear la contabilidad real en la app móvil

## Business Problem

La pestaña "Contabilidad" del cliente móvil muestra un menú de 18 módulos de los que solo 3 funcionan (Cuentas Bancarias, Exchange, Anticipos); los otros 15 no tienen pantalla detrás o caen en casos de navegación inexistentes. En paralelo, existe un shell contable completo (`AccountingShell`) con sus seis superficies SDK y tests, pero no está importado por ningún archivo vivo. Además, `App.tsx` construye los 9 adapters contables (`accountingClients`) en cada sesión y los descarta porque nunca se pasan a `BusinessShell`. El resultado es que la contabilidad de la app está rota para el comprador pese a que todo el código necesario ya existe y está testeado.

## Hallazgos (Evidence)

### H1 — `accountingClients` se crea y se descarta

**Archivo:** `mobile/App.tsx:94-96` y `:176`

`createAccountingClients(...)` produce 9 adapters (banking, reconciliation, receivablesPayables, cashFinancing, advances, capital, exchange, paymentTypes, logs). Se usa únicamente en el guard de sesión (`:176`) pero **no** se incluye en el JSX de `<BusinessShell>` (`:184-220`). `BusinessShell` lo declara como prop opcional (`src/BusinessShell.tsx:113`) y lo desestructura (`:152`) sin volver a usarlo.

### H2 — `AccountingShell` y su cadena están muertos por cadena

**Archivo:** `mobile/src/AccountingShell.tsx`

`AccountingShell` (Bancos, Reconciliaciones, CxC/CxP, Préstamos y deudas, Anticipos, Configuración) y sus superficies `BankingSurface`, `ReconciliationSurface`, `ReceivablesPayablesSurface`, `LoansDebtsSurface`, `ConfigurationSurface` solo son importadas por el propio `AccountingShell` y por sus tests. Ningún componente vivo las renderiza.

### H3 — Pestaña Contabilidad actual: 18 módulos, 3 vivos

**Archivo:** `mobile/src/ContabilidadSurface.tsx:26-45` y `mobile/src/BusinessShell.tsx:230-245`

`ContabilidadSurface` lista 18 módulos. El switch `renderContabilidadScreen` solo maneja `bankAccounts`, `exchange`, `advances`; los callbacks `onSelectAccountsReceivable` / `onSelectAccountsPayable` (`BusinessShell.tsx:239-240`) fijan `contabilidadScreen` a valores sin `case`, por lo que el `default` vuelve a pintar el menú (botón muerto).

### H4 — Superficies contables duplicadas

Existen dos familias sobre el mismo SDK:
- Família viva: `BankAccountsSurface` (`bank-accounts-api`, wrapper sobre `accounting-api`), `ExchangeSurface` (`exchange-converter-api`), `AdvancesSurface` (`advances-api`, wrapper sobre `accounting-advances-api`).
- Família canónica (cadena `AccountingShell`): `BankingSurface`, `ReceivablesPayablesSurface`, `LoansDebtsSurface`, `ConfigurationSurface`.

Ambas derivan del mismo SDK (`accounting-clients.ts:56-91`). La cadena `AccountingShell` es la completa y probada; las superficies vivas `BankAccountsSurface`/`ExchangeSurface` incluyen botones "Nuevo"/"Crear" con `onPress={() => {}}` (muertos).

## Target Users

- Usuarios de negocio autenticados que consultan la contabilidad (bancos, CxC/CxP, anticipos, préstamos/deudas, conciliación, configuración contable) desde el dispositivo móvil.

## Scope

### Incluye

- Pasar `accountingClients` de `App.tsx` → `BusinessShell`.
- Renderizar `AccountingShell` (6 módulos) en el tab Contabilidad.
- Eliminar el estado `contabilidadScreen` (string plano) y los callbacks muertos.
- Retirar del flujo `ContabilidadSurface`, `BankAccountsSurface`, `ExchangeSurface` y los 5 props de clientes tipo `create*` que dejaban de usarse.
- Actualizar tests del shell y añadir aserción de los 6 módulos contables.
- Verificación: typecheck + suite completa verde.

### Excluye

- Eliminación física de archivos huérfanos (`ContabilidadSurface.tsx`, `BankAccountsSurface.tsx`, `ExchangeSurface.tsx`, `bank-accounts-api.ts`, `accounts-receivable-api.ts`, `accounts-payable-api.ts`, `exchange-converter-api.ts`) — se difiere a SDD-02 (limpieza de código muerto).
- Botón muerto "Contratos" de la pestaña Config (`ConfiguracionSurface.tsx`, distinta de la `ConfigurationSurface` contable) — se difiere a SDD-02.
- POS/turno/cuadre, reparaciones y reportes contables (fuera de la oleada A+B).

## Data Sources

- Ninguno nuevo. Se reutilizan los adapters de `mobile/src/accounting-clients.ts` (SDK vendido `sdks/mobile-v1/typescript`).

## Rollback

Reversible: revert del commit de la fase. No toca el contrato OpenAPI ni el backend; el cambio es exclusivo del repo móvil.