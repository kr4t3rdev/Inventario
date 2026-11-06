# Reporte contable formal (balance general y estado de resultados)

El reporte contable formal publica el **balance general acumulado por cuenta** y
el **estado de resultados del período**, ambos derivados del mayor formal
(`Asiento` y `AsientoLinea`) y con precisión decimal exacta.

El reporte se presenta **por cuentas y tipos contables**. No infiere rubros del
reporte legacy, no mezcla fuentes y no degrada a datos parciales: si la
evidencia no alcanza, el reporte queda **no disponible** con su causa.

## Dónde vive

| Consumidor | Ubicación | Qué devuelve |
|---|---|---|
| Pantalla | `/busy/contabilidad/reporte-formal` | Reporte por cuenta y tipo, o la causa de indisponibilidad |
| Server Action | `getFormalFinancialReportAction`, `listarPeriodosFormalesAction` | Resolución del reporte y períodos con evidencia |
| API (exportación) | `GET /api/contabilidad/reporte-formal?periodoId=…` | CSV del reporte, o `409` con la causa |

La pantalla consulta el tenant autenticado y solo ofrece los períodos que
tienen asientos en el mayor formal. La API exige la licencia
`contabilidad-formal` y devuelve `409` con el motivo cuando el reporte no está
disponible.

## Reglas de cálculo

- **Balance acumulado**: suma todos los movimientos hasta el corte, incluidos
  los cierres y sus reversos. El corte por defecto es el cierre del período.
- **Resultado del período**: suma desde el inicio del período hasta el corte,
  **excluyendo cierres y sus reversos**. El cierre traslada el resultado a
  patrimonio, por lo que no debe alterar la lectura del período.
- **Originales revertidos**: un asiento `ANULADO` con `revertidoPorId` sigue
  contando en el mayor. Si se descartara, el saldo acumulado sería
  formalmente incorrecto y ningún consumidor podría detectarlo.
- **Importes**: los `debe`/`haber` del mayor están en moneda funcional y se
  presentan con la precisión decimal exacta del ledger, sin convertir a coma
  flotante.

## Criterio de cobertura global

El reporte solo se publica si el período tiene **cobertura global acreditada**:

| Requisito | Detalle |
|---|---|
| Replay completado | `ReplayRun.status === 'COMPLETED'` |
| Sin omisiones | `omittedCount === 0` |
| Sin identidades ambiguas | `ambiguousCount === 0` |
| Valoración verificable | `noFxCount === 0` y `noCostCount === 0` |
| Sin fuentes fuera de período | `outOfPeriodCount === 0` |
| Reconciliación conforme | Persistida, `status === 'CONFORME'` y cubriendo todas las fuentes esperadas |
| Libro no vacío | `LIBRO_VACIO` descalifica la cobertura |

Un libro vacío, un replay parcial o una conciliación cruzada existente **no**
prueban cobertura global: la conciliación cruzada actual solo compara
tesorería, cuentas por cobrar y cuentas por pagar.

## Causas de indisponibilidad

| Causa | Significado |
|---|---|
| `PERIODO_NO_ENCONTRADO` | El período no pertenece a la empresa activa |
| `COVERAGE_NOT_CREDIFIED` | El período no reúne cobertura global acreditada |
| `REVERSAL_INTEGRITY_FAILED` | Hay inconsistencias en los vínculos de reversión |

La cobertura se reporta antes que la integridad de reversos. Ninguna de las
causas produce importes parciales: sin evidencia no hay números.

## Integridad de reversos

Cada reverso debe tener su original contabilizado, y cada original revertido
debe apuntar a un reverso contabilizado del mismo tenant. La verificación es
conservadora: la reversión anidada no se admite, porque un par incompleto
produce saldos formalmente incorrectos que ningún consumidor puede detectar.

## Checkpoint formal con procedencia

El checkpoint (`CheckpointContableFormal`) es la evidencia durable del reporte:

| Campo | Contenido |
|---|---|
| `payload` | Reporte persistido: cuentas, resultado y evidencia de cobertura |
| `hashIntegridad` | SHA-256 de la serialización canónica del payload |
| `ledgerHash` | SHA-256 de la cadena de asientos del tenant hasta el corte |
| `replayRunId` | Ejecución de replay que acreditó la cobertura |

- **Registro**: solo se crea con cobertura acreditada; un período sin
  cobertura no produce evidencia.
- **Lectura**: es doble. El payload debe conservar su hash de integridad y el
  mayor formal debe producir el mismo `ledgerHash`. Si el payload fue alterado
  o el ledger cambió, el checkpoint se rechaza con su motivo
  (`PAYLOAD_ALTERADO` o `LEDGER_ALTERADO`).

El checkpoint **no** reutiliza la evidencia legacy: ni `SaldoSnapshot` ni los
campos `resumenJson`/`hashIntegridad` del período, que se escriben desde el
cierre legacy.

## Estado actual: gates apagados

- `CONTABILIDAD_FORMAL_MODE` y `CONTABILIDAD_FORMAL_NO_CASH_MODE` siguen
  apagados, sin overrides por tenant.
- El reporte formal **no reemplaza** al reporte legacy de
  `/busy/contabilidad/balance-resultados`: son consumidores distintos y no se
  mezclan.
- La pantalla todavía no tiene enlace en la navegación (hay trabajo ajeno en
  curso en el sidebar).
- La ventana shadow R7.3 se omitió a propósito.

## Límites conocidos

- La cobertura se acredita por tenant y período; más allá de un período la
  cobertura global sigue sin resolverse.
- Un snapshot legacy con hash válido no acredita la procedencia del mayor.
- La apertura automática de saldos sigue bloqueada por
  `APERTURA_SALDOS_NO_VERIFICABLES`.
- La línea base R6 y la prueba directa de `enforce` en producción quedan
  pendientes de acceso a un tenant real.

## Referencias de código

- `src/features/contabilidad-formal/services/formal-financial-report-service.ts`
- `src/features/contabilidad-formal/services/financial-ledger-coverage.ts`
- `src/features/contabilidad-formal/services/financial-ledger-reversal-integrity.ts`
- `src/features/contabilidad-formal/services/formal-checkpoint-service.ts`
- `src/features/contabilidad-formal/services/formal-checkpoint-reader.ts`
- `src/features/contabilidad-formal/actions-reporte.ts`
- `src/app/busy/contabilidad/reporte-formal/page.tsx`
- `src/app/api/contabilidad/reporte-formal/route.ts`
