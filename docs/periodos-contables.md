# Módulo de Períodos Contables y Evento Contable

## Visión General

Este módulo implementa un sistema de gestión de períodos contables con enfoque mixto (caja + devengo) y un subledger normalizado de eventos contables. Permite abrir, cerrar, aprobar y reabrir períodos contables a nivel diario, mensual y anual, con trazabilidad completa de cada operación financiera.

```
┌─────────────────────────────────────────────────────┐
│                   Períodos Contables                │
│                                                     │
│  ANUAL ←── MENSUAL ←── DIARIO                      │
│   │          │          │                           │
│   │          │          ├── Apertura (saldos)        │
│   │          │          ├── Snapshot (cierre)        │
│   │          │          └── Auditoría (acciones)     │
│   │          │                                      │
│   │          └── Consolidación de diarios            │
│   └── Consolidación de mensuales                    │
│                                                     │
│  EventoContable (subledger normalizado)             │
│   ├── Líneas de doble partida (débito/crédito)      │
│   ├── Origen: Venta, Gasto, Transferencia, etc.     │
│   └── Criterio: CAJA o DEVENGO                      │
└─────────────────────────────────────────────────────┘
```

---

## Arquitectura

### Enfoque Mixto

- **Caja** → Cuadre diario, tesorería y conciliaciones efectivas
- **Devengo** → Resultados mensuales/anuales y posición contable

### Modelo de Estados

```
BORRADOR → ABIERTO → EN_CIERRE → CERRADO → APROBADO
               ↑                               │
               └────── REABIERTO ←─────────────┘
```

Solo los estados `ABIERTO` y `REABIERTO` aceptan nuevas operaciones.

### Jerarquía de Períodos

```
ANUAL (2026)
├── MENSUAL (2026-01)
│   ├── DIARIO (2026-01-01)
│   ├── DIARIO (2026-01-02)
│   └── ...
├── MENSUAL (2026-02)
└── ...
```

- Un mensual no puede cerrarse si tiene diarios sin cerrar/aprobar
- Un anual no puede cerrarse si tiene meses sin cerrar/aprobar

---

## Modelos de Base de Datos

### `PeriodoContable`

| Campo | Tipo | Descripción |
|-------|------|-------------|
| `periodoId` | String (PK) | ID único del período |
| `tipo` | Enum | `DIARIO`, `MENSUAL`, `ANUAL` |
| `codigo` | String (unique) | Código generado (ej: `D-2026-04-23`, `M-2026-04`, `A-2026`) |
| `fechaInicio` | DateTime | Inicio del período |
| `fechaFin` | DateTime | Fin del período |
| `estado` | Enum | Estado actual del período |
| `periodoPadreId` | String? | FK al período padre (diario→mensual, mensual→anual) |
| `abiertoPorId` | String? | FK al usuario que abrió |
| `cerradoPorId` | String? | FK al usuario que cerró |
| `aprobadoPorId` | String? | FK al usuario que aprobó |
| `reabiertoPorId` | String? | FK al usuario que reabrió |

### `AperturaPeriodo`

Saldos iniciales al momento de abrir un período.

| Campo | Tipo | Descripción |
|-------|------|-------------|
| `aperturaId` | String (PK) | ID único |
| `periodoId` | String (unique) | FK al período |
| `origenPeriodoId` | String? | Período desde el que se arrastran saldos |
| `saldoCajaInicial` | Decimal | Saldo de caja al inicio |
| `saldoBancoInicial` | Decimal | Saldo bancario al inicio |
| `saldoCuentasCobrarInicial` | Decimal | CxC al inicio |
| `saldoCuentasPagarInicial` | Decimal | CxP al inicio |
| `saldoInventarioInicial` | Decimal | Inventario al inicio |
| `saldoCapitalInicial` | Decimal | Capital al inicio |
| `saldoResultadoAcumInicial` | Decimal | Resultados acumulados |

### `SnapshotPeriodo`

Registro inmutable del cierre. Cada cierre genera una nueva versión.

| Campo | Tipo | Descripción |
|-------|------|-------------|
| `snapshotId` | String (PK) | ID único |
| `periodoId` | String | FK al período |
| `version` | Int | Versión incremental |
| `baseCajaJson` | JSON? | Datos base de caja |
| `baseDevengoJson` | JSON? | Datos base de devengo |
| `inconsistenciasJson` | JSON? | Lista de inconsistencias detectadas |
| `resumenJson` | JSON? | Resumen operativo |
| `hashIntegridad` | String? | Hash para verificación |

### `AuditoriaPeriodo`

Trail de auditoría de todas las acciones sobre un período.

| Campo | Tipo | Descripción |
|-------|------|-------------|
| `auditoriaId` | String (PK) | ID único |
| `periodoId` | String | FK al período |
| `accion` | Enum | `CREAR`, `ABRIR`, `CERRAR`, `APROBAR`, `REABRIR`, `BLOQUEAR_OPERACION`, `GENERAR_APERTURA`, `GENERAR_SNAPSHOT` |
| `usuarioId` | String | FK al usuario que ejecutó |
| `motivo` | String? | Motivo (obligatorio en reapertura) |
| `payloadJson` | JSON? | Datos adicionales |

### `EventoContable`

Subledger normalizado. Cada operación financiera genera un evento con líneas de doble partida.

| Campo | Tipo | Descripción |
|-------|------|-------------|
| `eventoId` | String (PK) | ID único |
| `fechaOperacion` | DateTime | Fecha de la operación original |
| `origenTipo` | String | Tipo de operación (VENTA, GASTO_DE, etc.) |
| `origenId` | String | ID del registro origen |
| `criterio` | Enum | `CAJA` o `DEVENGO` |
| `naturaleza` | Enum | `INGRESO`, `EGRESO`, `ACTIVO`, `PASIVO`, `PATRIMONIO`, `RESULTADO` |
| `monto` | Decimal | Monto de la operación |
| `moneda` | String | Moneda (default: CUP) |
| `estado` | String | Estado del evento (CONFIRMADO, PENDIENTE, ANULADO) |
| `lineas` | Relation | Líneas de doble partida |

### `EventoContableLinea`

| Campo | Tipo | Descripción |
|-------|------|-------------|
| `lineaId` | String (PK) | ID único |
| `eventoId` | String | FK al evento |
| `cuenta` | String | Nombre de la cuenta contable |
| `debito` | Decimal | Monto débito |
| `credito` | Decimal | Monto crédito |
| `moneda` | String | Moneda de la línea |

---

## Servicios Backend

### Dominio y Reglas

| Servicio | Archivo | Responsabilidad |
|----------|---------|-----------------|
| `periodo-contable-service` | `periodo-contable-service.ts` | Constantes, `buildPeriodRange`, `buildPeriodCode`, `canRegisterOperations`, `validateClosePeriod` |
| `periodo-operacion-guard` | `periodo-operacion-guard.ts` | `assertOperationAllowed` — bloquea operaciones en períodos no operables |
| `evento-contable-service` | `evento-contable-service.ts` | `ORIGEN_TIPO`, `CRITERIO`, `NATURALEZA`, `generarEventoSeed`, `generarLineasDoblePartida`, `validarEventoSeed` |

### Persistencia

| Servicio | Archivo | Responsabilidad |
|----------|---------|-----------------|
| `apertura-periodo-persistence-service` | `apertura-periodo-persistence-service.ts` | `persistOpeningPeriod` — apertura transaccional e idempotente |
| `cierre-diario-persistence-service` | `cierre-diario-persistence-service.ts` | `persistDailyClose` — cierre diario con snapshot y resumen (13 aggregates) |
| `cierre-mensual-persistence-service` | `cierre-mensual-persistence-service.ts` | `persistMonthlyClose` — consolida snapshots diarios |
| `cierre-anual-persistence-service` | `cierre-anual-persistence-service.ts` | `persistAnnualClose` — consolida snapshots mensuales |
| `evento-contable-persistence-service` | `evento-contable-persistence-service.ts` | `persistEventoContable` — persiste evento + líneas en transacción |
| `evento-contable-integration` | `evento-contable-integration.ts` | `registrarEventoContable` — helper no-bloqueante para rutas |

### Consulta y Transiciones

| Servicio | Archivo | Responsabilidad |
|----------|---------|-----------------|
| `listar-periodos-service` | `listar-periodos-service.ts` | `listPeriodos` — listado con filtros por tipo, estado, fechas |
| `periodo-transicion-service` | `periodo-transicion-service.ts` | `aprobarPeriodo`, `reabrirPeriodo` — transiciones con validación de jerarquía |
| `periodo-detail-service` | `periodo-detail-service.ts` | `getPeriodoDetail` — detalle completo con apertura, snapshots, auditorías, blockers |

---

## API REST

### Períodos

| Método | Ruta | Descripción | Auth |
|--------|------|-------------|------|
| `GET` | `/api/contabilidad/periodos` | Lista períodos con filtros | ✅ |
| `GET` | `/api/contabilidad/periodos/:id` | Detalle de un período | ✅ |
| `POST` | `/api/contabilidad/periodos/apertura-diaria` | Abre un período diario | ✅ |
| `POST` | `/api/contabilidad/periodos/cierre-diario` | Cierra el día y genera snapshot | ✅ |
| `POST` | `/api/contabilidad/periodos/cierre-mensual` | Consolida y cierra el mes | ✅ |
| `POST` | `/api/contabilidad/periodos/cierre-anual` | Consolida y cierra el año | ✅ |
| `POST` | `/api/contabilidad/periodos/:id/aprobar` | Aprueba un período cerrado | ✅ |
| `POST` | `/api/contabilidad/periodos/:id/reabrir` | Reabre un período (requiere motivo) | ✅ |
| `GET` | `/api/contabilidad/periodos/:id/snapshot` | Obtiene snapshots (con `?all=true`) | ✅ |
| `GET` | `/api/contabilidad/periodos/:id/inconsistencias` | Inconsistencias del último snapshot | ✅ |
| `GET` | `/api/contabilidad/periodos/precierre` | Pre-cierre sin persistir (resumen del día) | ✅ |

### Eventos

| Método | Ruta | Descripción | Auth |
|--------|------|-------------|------|
| `GET` | `/api/contabilidad/eventos` | Lista eventos contables con filtros | ✅ |

**Filtros de eventos**: `origenTipo`, `estado`, `naturaleza`, `fechaDesde`, `fechaHasta`, `limite`

---

## Guard Operativo

El `periodo-operacion-guard` se integra en **9 rutas** para bloquear operaciones cuando el período no está abierto:

| Ruta | Origen |
|------|--------|
| `POST /api/ventas` | VENTA |
| `POST /api/gastosDE` | GASTO_DE |
| `POST /api/pago-salario` | PAGO_SALARIO |
| `POST /api/empleados/nomina` | NOMINA |
| `POST /api/contabilidad/transferencias` | TRANSFERENCIA_BANCARIA |
| `POST /api/contabilidad/ajustes` | AJUSTE_BANCARIO |
| `POST /api/transferencias` | TRANSFERENCIA_INVENTARIO |
| `POST /api/contabilidad/reconciliacion/ventas` | RECONCILIACION_VENTA |
| `POST /api/contabilidad/reconciliacion/gastos` | RECONCILIACION_GASTO |

Cuando una operación se bloquea, se lanza `PeriodoOperacionError` con status 423 y código `PERIODO_CERRADO`.

---

## Evento Contable (Subledger)

Cada operación financiera genera automáticamente un `EventoContable` con líneas de doble partida:

```
Operación: Venta de $1000
│
├── EventoContable { origenTipo: "VENTA", monto: 1000, naturaleza: "INGRESO" }
│   ├── Línea: Banco        Débito:  1000
│   └── Línea: Ventas       Crédito: 1000
```

### Tipos de Origen

| Origen | Naturaleza | Criterio |
|--------|-----------|----------|
| VENTA | INGRESO | DEVENGO |
| COBRO_VENTA | INGRESO | CAJA |
| GASTO_DE | EGRESO | DEVENGO |
| PAGO_GASTO | EGRESO | CAJA |
| PAGO_SALARIO | EGRESO | CAJA |
| TRANSFERENCIA_BANCARIA | ACTIVO | CAJA |
| AJUSTE_BANCARIO | RESULTADO | CAJA |
| RECONCILIACION_VENTA | INGRESO | CAJA |
| RECONCILIACION_GASTO | EGRESO | CAJA |

### Integración no-bloqueante

`registrarEventoContable` degrada silenciosamente si:
- El modelo `EventoContable` no existe en Prisma runtime
- El asiento no está balanceado (warn, no error)
- Cualquier error de persistencia

---

## Frontend

### Páginas

| Ruta | Componente | Descripción |
|------|-----------|-------------|
| `/busy/contabilidad/periodos` | `PeriodosPage` | Tablero de períodos |
| `/busy/contabilidad/eventos` | `EventosPage` | Visor de eventos contables |

### Componentes

| Componente | Descripción |
|-----------|-------------|
| `PeriodosManager` | Orquesta tabla + acciones + detalle |
| `PeriodosTable` | Tabla con filtros por tipo y estado |
| `PeriodoAcciones` | 4 cards: Apertura diaria, Cierre diario/mensual/anual |
| `PeriodoDetail` | Detalle con badges, aprobar/reabrir, blockers |
| `EventosContablesViewer` | Accordion con filtros y líneas de doble partida |

### Redux API

13 endpoints en `contabilidadApi.tsx`:

```typescript
// Queries
useGetPeriodosQuery(filtros)
useGetPeriodoQuery(id)
useGetPeriodoInconsistenciasQuery(id)
useGetPeriodoSnapshotQuery(id)
useGetPrecierreQuery({ fecha })
useGetEventosContablesQuery(filtros)

// Mutations
useAperturarPeriodoMutation({ fecha })
useCerrarDiarioMutation({ periodoId })
useCerrarMensualMutation({ periodoId })
useCerrarAnualMutation({ periodoId })
useAprobarPeriodoMutation({ id, motivo? })
useReabrirPeriodoMutation({ id, motivo })
```

---

## Tests

**25 archivos, 168 pruebas, 0 fallos.**

### Servicios (11 archivos)

| Test | Pruebas |
|------|---------|
| `periodo-contable-service.test.ts` | 7 |
| `periodo-operacion-guard.test.ts` | 5 |
| `periodo-transicion-service.test.ts` | 22 |
| `periodo-detail-service.test.ts` | 8 |
| `apertura-periodo-service.test.ts` | 5 |
| `apertura-periodo-persistence-service.test.ts` | 4 |
| `cierre-diario-persistence-service.test.ts` | 5 |
| `cierre-mensual-persistence-service.test.ts` | 5 |
| `cierre-anual-persistence-service.test.ts` | 5 |
| `listar-periodos-service.test.ts` | 4 |
| `evento-contable-service.test.ts` | 29 |
| `evento-contable-persistence-service.test.ts` | 11 |
| `evento-contable-integration.test.ts` | 5 |

### Rutas (12 archivos)

| Test | Pruebas |
|------|---------|
| `periodos/__tests__/route.test.ts` | 4 |
| `[id]/__tests__/transicion-routes.test.ts` | 8 |
| `[id]/aprobar/__tests__/route.test.ts` | 4 |
| `[id]/reabrir/__tests__/route.test.ts` | 5 |
| `[id]/inconsistencias/__tests__/route.test.ts` | 4 |
| `[id]/snapshot/__tests__/route.test.ts` | 4 |
| `apertura-diaria/__tests__/route.test.ts` | 4 |
| `cierre-diario/__tests__/route.test.ts` | 4 |
| `cierre-mensual/__tests__/route.test.ts` | 4 |
| `cierre-anual/__tests__/route.test.ts` | 4 |
| `precierre/__tests__/route.test.ts` | 4 |
| `eventos/__tests__/route.test.ts` | 4 |

---

## Flujo Operativo Típico

### 1. Apertura Diaria

```
POST /api/contabilidad/periodos/apertura-diaria
Body: { "fecha": "2026-04-23" }
│
├── Busca período DIARIO anterior
├── Calcula saldos vivos (caja, bancos, CxC, CxP, inventario, capital)
├── Crea PeriodoContable (estado: ABIERTO)
├── Crea AperturaPeriodo con saldos iniciales
└── Registra AuditoriaPeriodo (ABRIR)
```

### 2. Operaciones del Día

Las operaciones (ventas, gastos, transferencias) se registran normalmente. El `periodo-operacion-guard` valida que el período esté abierto antes de permitir la operación. Cada operación genera un `EventoContable` con sus líneas de doble partida.

### 3. Pre-Cierre (Opcional)

```
GET /api/contabilidad/periodos/precierre?fecha=2026-04-23
│
├── Calcula 13 aggregates (ventas, gastos, salarios, reconciliaciones)
├── Detecta inconsistencias (sin movimientos, diferencia negativa, etc.)
└── Retorna resumen SIN persistir
```

### 4. Cierre Diario

```
POST /api/contabilidad/periodos/cierre-diario
Body: { "periodoId": "xxx" }
│
├── Valida que el período esté ABIERTO
├── Calcula resumen operativo
├── Crea SnapshotPeriodo (versión 1, inmutable)
├── Cambia estado a CERRADO
├── Registra AuditoriaPeriodo (CERRAR)
└── Retorna período, snapshot y resumen
```

### 5. Aprobación

```
POST /api/contabilidad/periodos/:id/aprobar
│
├── Valida que el período esté CERRADO
├── Valida que exista snapshot
├── Valida que no haya subperíodos sin cerrar
├── Cambia estado a APROBADO
└── Registra AuditoriaPeriodo (APROBAR)
```

### 6. Reapertura (con auditoría)

```
POST /api/contabilidad/periodos/:id/reabrir
Body: { "motivo": "Error de cálculo, requiere ajuste" }
│
├── Valida motivo obligatorio
├── Valida que el período esté CERRADO o APROBADO
├── Valida que no haya período padre aprobado
├── Cambia estado a REABIERTO
└── Registra AuditoriaPeriodo (REABRIR) con motivo
```

---

## Enumeraciones

### TipoPeriodo
`DIARIO` | `MENSUAL` | `ANUAL`

### EstadoPeriodo
`BORRADOR` | `ABIERTO` | `EN_CIERRE` | `CERRADO` | `APROBADO` | `REABIERTO`

### AccionPeriodo
`CREAR` | `ABRIR` | `CERRAR` | `APROBAR` | `REABRIR` | `BLOQUEAR_OPERACION` | `GENERAR_APERTURA` | `GENERAR_SNAPSHOT`

### CriterioContable
`CAJA` | `DEVENGO`

### NaturalezaEvento
`INGRESO` | `EGRESO` | `ACTIVO` | `PASIVO` | `PATRIMONIO` | `RESULTADO`

---

## Errores

| Error | Status | Código | Cuándo |
|-------|--------|--------|--------|
| `PeriodoOperacionError` | 423 | `PERIODO_CERRADO` | Operación en período no operable |
| `TransicionPersistenceUnavailableError` | 503 | `TRANSICION_PERSISTENCE_UNAVAILABLE` | Modelo Prisma no disponible |
| `PeriodoNotFoundError` | 404 | `PERIODO_NO_ENCONTRADO` | Período no existe |
| `AprobacionBlockerError` | 409 | `APROBACION_BLOCKER` | Hay subperíodos sin cerrar |
| `ReaperturaBlockerError` | 409 | `REAPERTURA_BLOCKER` | Período padre aprobado |
| `EventoPersistenceUnavailableError` | 503 | `EVENTO_PERSISTENCE_UNAVAILABLE` | Modelo EventoContable no disponible |
| `EventoValidationError` | 400 | `EVENTO_VALIDATION_ERROR` | Asiento desbalanceado o sin líneas |
