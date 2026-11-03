# Libros contables formales (diario, mayor, comprobación y conciliación cruzada)

Los libros leen los asientos de la capa formal (`Asiento` y `AsientoLinea`) y los
contrastan contra los saldos operativos de la base caja. Son de **solo lectura**:
no escriben asientos ni modifican saldos.

La página vive en `/busy/contabilidad/libros` y se habilita con el flag de plan
`contabilidad-formal` (o para el rol `admin`). Si el tenant no tiene el flag, la
página no renderiza nada y las acciones que la alimentan rechazan la consulta.

## Qué ofrece

| Vista | Qué muestra | Origen |
|---|---|---|
| Libro diario | Asientos del período o rango de fechas, con sus líneas y totales, paginado | `obtenerLibroDiario` |
| Libro mayor | Movimientos de una cuenta con saldo inicial y saldo corrido según su naturaleza | `obtenerLibroMayor` |
| Balance de comprobación | Sumas debe/haber y saldos deudor/acreedor por cuenta | `obtenerBalanceComprobacion` |
| Conciliación cruzada | Saldo contable contra saldo operativo, por rubro | `obtenerConciliacionCruzada` |

La verificación forense de la cadena de hash (`verificarCadenaAsientosAction`)
recorre los asientos del tenant en orden cronológico, recalcula el hash
esperado con el contenido canónico y señala el primer asiento cuya cadena se
rompe. Es una lectura: no recalcula ni modifica hashes ni líneas históricas.

## Reglas de lectura

- **Aislamiento por tenant**: todas las consultas filtran por `tenantId`; un
  asiento de otro tenant no aparece en el diario, el mayor ni el balance, ni
  aunque se conozca el período. Hay una prueba de integración con dos tenants
  reales en PostgreSQL (`libros-aislamiento.test.ts`).
- **Moneda de presentación**: la moneda funcional del tenant
  (`TenantAccountingPolicy.functionalCurrencyCode`); sin política el libro mayor
  asume `CUP` y la conciliación cruzada se declara `NO_EVALUABLE`.
- **Estado del asiento**: el balance de comprobación y el libro mayor solo suman
  asientos `CONTABILIZADO`.
- **Saldo inicial**: el libro mayor arranca con el agregado de los asientos
  anteriores al rango pedido, en la naturaleza de la cuenta (`DEUDORA` o
  `ACREEDORA`).
- **Paginación**: el diario pagina por desplazamiento (`page`, `limit` con tope
  de 200) y devuelve totales de la página, no del período completo.

## Conciliación cruzada

Compara tres rubros: tesorería (caja y bancos), cuentas por cobrar y cuentas por
pagar. Cada rubro puede quedar en tres estados:

| Estado | Significado |
|---|---|
| `CONFORME` | Los dos lados coinciden |
| `DIFERENCIA` | Los dos lados son comparables y no coinciden |
| `NO_EVALUABLE` | Falta una fuente comparable: no se puede afirmar nada |

El resultado general es `CONFORME` solo si **ningún** rubro quedó en
`NO_EVALUABLE` o `DIFERENCIA`; `enforceReady` es true únicamente en ese caso.

Límites conocidos y deliberados:

- Un **corte parcial** (`fechaHasta`) deja todos los rubros en `NO_EVALUABLE`:
  la cobertura no permite afirmar la igualdad.
- La **CxC operativa** exige valoración funcional completa y verificable
  (importe original, importe funcional, moneda, tasa, fecha de vigencia y
  evidencia FX canónica). Si falta cualquiera de esos datos, el rubro queda
  `NO_EVALUABLE` en vez de estimar una diferencia.
- Una cuenta bancaria activa en moneda distinta de la funcional, con saldo
  pendiente, hace que la tesorería quede `NO_EVALUABLE`: sin evidencia de
  conversión no se puede comparar.
- Una CxP con pagos registrados pero sin moneda verificable también queda
  `NO_EVALUABLE`.

Los importes se comparan con `Decimal` de Prisma (sin pasar por coma flotante),
de modo que no aparecen diferencias binarias ni se pierden decimales en
importes grandes.

## Evidencia FX

La conciliación no inventa conversiones: cuando una CxC está en moneda
funcional, la evidencia persistida se contrasta contra el formato canónico de
la capa (`buildAppliedFxEvidence`), recalculando la huella y comparándola con la
columna y con el JSON almacenado. Si la conversión persistida no coincide con
la tasa y el importe original, la verificación falla cerrada y el rubro queda
`NO_EVALUABLE`.

## Referencias

- Acciones: `src/features/contabilidad-formal/actions-libros.ts`
- Servicios: `src/features/contabilidad-formal/services/libro-diario-service.ts`,
  `libro-mayor-service.ts`, `balance-comprobacion-service.ts`,
  `conciliacion-cruzada-service.ts`, `verificador-hash-service.ts`
- UI: `src/features/contabilidad-formal/components/libros-page-client.tsx` y los
  paneles de cada pestaña
- Ruta: `src/app/busy/contabilidad/libros/page.tsx`
- Pruebas: `src/features/contabilidad-formal/__tests__/libros.test.ts`,
  `actions-libros.test.ts`, `libros-ui.test.tsx`,
  `components/conciliacion-panel.test.tsx` y las pruebas de integración
  `__integration__/libros-aislamiento.test.ts` y
  `__integration__/conciliacion-cruzada.test.ts`
- Capa formal: `content/docs/modules/contabilidad/capa-formal-emisor-no-cash.md`
