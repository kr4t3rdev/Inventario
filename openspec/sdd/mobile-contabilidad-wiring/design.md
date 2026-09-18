# Design: Cableado de contabilidad en la app móvil

## Technical Approach

Cambio exclusivo del repo móvil, sin backend ni contrato OpenAPI. Se adopta la cadena SDK canónica (`AccountingShell`) como único punto de entrada contable y se eliminan las dos vías alternativas (menú de 18 módulos y 5 clients intermedios). El trabajo es de cableado: quitar el estado `contabilidadScreen` y los props redundantes, y apuntar el `case 'contabilidad'` a `AccountingShell`.

## Detailed Design

### 1. App.tsx

- Añadir `accountingClients={accountingClients}` al JSX de `<BusinessShell>`.
- Eliminar las 5 llamadas `useMemo` (`bankAccountsApi`, `accountsReceivableApi`, `accountsPayableApi`, `exchangeApi`, `advancesApi`) y sus importaciones (`createCuentasBancariasApiClient`, `createCuentasXCobrarApiClient`, `createCuentasXPagarApiClient`, `createExchangeConverterApiClient`, `createAnticiposApiClient`).
- Simplificar el guard de sesión para dejar de exigir esos 5 clients (mantener `accountingClients`).

### 2. BusinessShell.tsx

- Prop `accountingClients` pasa de opcional a requerida.
- Eliminar prop + importación + desestructuración de los 5 clients contables intermedios.
- Eliminar `useState<string>('menu')` de `contabilidadScreen` y su rama en el `BackHandler`.
- Sustituir `renderContabilidadScreen` por renderizado directo de `AccountingShell`:

```tsx
case 'contabilidad': return (
  <AccountingShell
    onSelectModule={() => {}}
    bankingApi={accountingClients.banking}
    reconciliationApi={accountingClients.reconciliation}
    receivablesPayablesApi={accountingClients.receivablesPayables}
    cashFinancingApi={accountingClients.cashFinancing}
    advancesApi={accountingClients.advances}
    exchangeApi={accountingClients.exchange}
    paymentTypesApi={accountingClients.paymentTypes}
    capitalApi={accountingClients.capital}
    logsApi={accountingClients.logs}
  />
);
```

- Eliminar las importaciones de `ContabilidadSurface`, `BankAccountsSurface`, `ExchangeSurface`, `AdvancesSurface` y añadir `AccountingShell`.

### 3. Navegación (types)

No se añade unión `ContabilidadScreen`: `AccountingShell` gestiona su propio `selectedModule`, y el botón "Volver a Contabilidad" resuelve el retroceso de módulo. El tab queda como una pantalla atómica a efectos del `BackHandler` (back sale al Dashboard).

### 4. Tests (BusinessShell.test.tsx)

- Sustituir los 5 props contables por `accountingClients` tipado (`AccountingClients`) construido con stubs.
- Añadir un test que, al pulsar "Contabilidad", aserte las 6 etiquetas de módulo.

## Riesgos y mitigación

- **Regresión UX puntual:** `BankingSurface` es una lista más simple que `BankAccountsSurface` (que tenía "Nueva cuenta" muerto). Mitigación: la pérdida es solo de botones sin `onPress` real; la capacida de listado se conserva en `BankingSurface`.
- **Doble `ConfigurationSurface`:** coexisten `ConfiguracionSurface` (tab Config, negocio) y `ConfigurationSurface` (contable). Mitigación: nombres de archivo ya son distintos; no se toca `ConfiguracionSurface`.
- **Hardware back en Android:** al quitar `contabilidadScreen`, back desde un módulo contable sale al Dashboard en vez de al menú. Mitigación: iOS (target del producto) usa botón "Volver a Contabilidad"; se documenta como limitación aceptada.