# Spec: Control de Caja POS y Cuadre Contable Operativo

> **Status**: Approved — decisiones Q1-Q4 resueltas
> **Decisiones**:
> - Q1: HÍBRIDA — POS PRINCIPAL obligatorio, MOVIL/SECUNDARIA automático
> - Q2: Pagos mixtos desde el principio
> - Q3: Arqueo opcional con advertencia
> - Q4: Integrar con PeriodoContable en esta tanda
> **Driver**: Grietas detectadas entre el POS operativo y la contabilidad formal
> **Dependencias**: Ninguna. Este spec es autocontenido y no depende de otros changes activos.

---

## 1. Objetivos

### 1.1 Primarios

1. **Rastrear el efectivo en cada punto de venta** desde que se abre hasta que se cierra.
2. **Desglosar ventas por método de pago** desde el origen (efectivo, tarjeta, transferencia, crédito, mixto).
3. **Comparar efectivo esperado vs real** mediante arqueo físico al cierre del turno.
4. **Integrar el cuadre diario** con turnos y arqueos para mostrar saldos iniciales/finales reales.

### 1.2 Secundarios

5. **Asociar cada venta a un turno y a un cajero responsable**.
6. **Extender PuntoDeVenta** con datos contables básicos (cuenta contable, tipo de caja).
7. **Soportar el flujo: abrir turno → vender → cerrar turno → arqueo**.

### 1.3 No objetivos

- Integración con `PeriodoContable` / `AperturaPeriodo` (tanda posterior).
- Corte de caja Z fiscal.
- Múltiples cajeros simultáneos por turno.
- Retenciones o impuestos por método de pago.

---

## 2. Decisiones Clave

### 2.1 Turno como entidad principal

Cada apertura de caja es un **TurnoPuntoVenta**. Una vez cerrado, no se puede modificar. El turno agrupa ventas y es el punto de anclaje para el arqueo.

### 2.2 Método de pago en Venta, no solo en ReconciliacionVenta

La venta debe registrar cómo pagó el cliente desde el momento de la transacción. La reconciliación es un paso contable posterior que puede refinar o mover el pago a otra cuenta.

### 2.3 Arqueo opcional pero incentivado

Se puede cerrar un turno sin arqueo (pérdida de control), pero el sistema MUST advertir y registrar que no hubo arqueo. El arqueo es el cierre responsable.

### 2.4 Efectivo en múltiples monedas

El fondo inicial y el arqueo SOPORTAN CUP y USD/MLC como mínimo. El spec NO define el mecanismo de conversión (se usará la tasa de cambio del día desde `TasaCambio` de contabilidad).

### 2.5 Compatibilidad hacia atrás

- Ventas existentes SIN turno: se asignan a un `TurnoPuntoVenta` especial de tipo `LEGACY` por tenant.
- Ventas existentes SIN método de pago: el campo es nullable, reportes advierten "sin dato".
- PuntoDeVenta existente: los nuevos campos son opcionales.

---

## 3. Modelos de Datos

### 3.1 TurnoPuntoVenta

```prisma
enum EstadoTurno {
  ABIERTO
  CERRADO
}

model TurnoPuntoVenta {
  id              String        @id @default(cuid())
  tenantId        String
  puntoDeVentaId  String
  empleadoId      String?       // Cajero que abre el turno
  tipo            String        @default("NORMAL")  // NORMAL | LEGACY
  fechaApertura   DateTime      @default(now())
  fechaCierre     DateTime?
  fondoInicialCup Int           @default(0)  // en centavos
  fondoInicialUsd Int           @default(0)  // en centavos
  estado          EstadoTurno   @default(ABIERTO)
  observaciones   String?
  createdAt       DateTime      @default(now())
  updatedAt       DateTime      @updatedAt

  // Relaciones
  puntoDeVenta    PuntoDeVenta  @relation(fields: [puntoDeVentaId], references: [pvId])
  empleado        Empleado?     @relation(fields: [empleadoId], references: [empleadoId])
  ventas          Venta[]
  arqueo          ArqueoCaja?
  tenant          Tenant        @relation(fields: [tenantId], references: [tenantId])

  @@unique([puntoDeVentaId, estado], name: "un_turno_abierto_por_pv")
  @@index([tenantId])
  @@index([puntoDeVentaId, fechaApertura])
  @@map("turnos_punto_venta")
}
```

**Nota sobre @@unique parcial**: Prisma no soporta unique compuestos con condición `estado = ABIERTO`. La validación se hará en la capa de aplicación (`beforeCreate`, `beforeUpdate`) verificando que no exista otro turno ABIERTO para el mismo `puntoDeVentaId`. Se puede complementar con un unique index parcial en SQL nativo agregado a la migración.

### 3.2 Modificaciones a Venta

```prisma
model Venta {
  // ... campos existentes ...

  // NUEVOS:
  turnoId         String?              // nullable para LEGACY backfill
  metodoPago      MetodoPagoVenta?     // nullable para LEGACY backfill
  montoEfectivo    Int?                // desglose para pago mixto (centavos)
  montoTarjeta     Int?                // desglose para pago mixto (centavos)
  montoTransferencia Int?              // desglose para pago mixto (centavos)
  montoCredito     Int?                // desglose para pago mixto (centavos)

  // Nueva relación
  turno            TurnoPuntoVenta?    @relation(fields: [turnoId], references: [id])

  // Índice
  @@index([turnoId])
}

enum MetodoPagoVenta {
  EFECTIVO
  TARJETA
  TRANSFERENCIA
  CREDITO
  MIXTO
}
```

### 3.3 ArqueoCaja

```prisma
model ArqueoCaja {
  id                  String     @id @default(cuid())
  turnoId              String     @unique
  tenantId            String
  puntoDeVentaId      String

  // Conteo físico — efectivo
  billetes1000Cup      Int        @default(0)
  billetes500Cup       Int        @default(0)
  billetes200Cup       Int        @default(0)
  billetes100Cup       Int        @default(0)
  billetes50Cup        Int        @default(0)
  billetes20Cup        Int        @default(0)
  monedasCup           Int        @default(0)  // valor total en centavos

  billetes100Usd       Int        @default(0)
  billetes50Usd        Int        @default(0)
  billetes20Usd        Int        @default(0)
  billetes10Usd        Int        @default(0)
  billetes5Usd         Int        @default(0)
  billetes1Usd         Int        @default(0)
  monedasUsd           Int        @default(0)  // valor total en centavos

  // Totales calculados
  totalEfectivoCup     Int        @default(0)  // en centavos
  totalEfectivoUsd     Int        @default(0)  // en centavos

  // Tarjetas y otros
  totalTarjeta         Int        @default(0)  // en centavos
  totalTransferencia   Int        @default(0)  // en centavos
  totalCredito         Int        @default(0)  // en centavos

  // Conciliación — esperado desde el sistema
  esperadoEfectivoCup  Int        @default(0)  // fondoInicial + ventasEfectivo - retiros
  esperadoEfectivoUsd  Int        @default(0)  // fondoInicial + ventasEfectivoUsd
  esperadoTarjeta      Int        @default(0)
  esperadoTransferencia Int       @default(0)
  esperadoCredito      Int        @default(0)

  // Diferencias
  diferenciaCup        Int        @default(0)  // totalEfectivoCup - esperadoEfectivoCup
  diferenciaUsd        Int        @default(0)

  // Control
  observaciones        String?
  contabilizado        Boolean    @default(false)  // true cuando se integra a PeriodoContable
  createdAt            DateTime   @default(now())
  updatedAt            DateTime   @updatedAt

  // Relaciones
  turno                TurnoPuntoVenta  @relation(fields: [turnoId], references: [id], onDelete: Cascade)
  puntoDeVenta         PuntoDeVenta     @relation(fields: [puntoDeVentaId], references: [pvId])
  tenant               Tenant           @relation(fields: [tenantId], references: [tenantId])

  @@index([tenantId])
  @@index([puntoDeVentaId])
  @@map("arqueos_caja")
}
```

### 3.4 Modificaciones a PuntoDeVenta

```prisma
model PuntoDeVenta {
  // ... campos existentes ...

  // NUEVOS:
  tipoCaja          String?    @default("PRINCIPAL")  // PRINCIPAL | SECUNDARIA | MOVIL
  almacenId         String?    // Almacén por defecto para productos de este POS
  cuentaContableId  String?    // Cuenta contable asociada (para integración futura con plan de cuentas)

  // Nuevas relaciones
  almacen           Almacen?   @relation(fields: [almacenId], references: [almacenId])
  turnos            TurnoPuntoVenta[]
  arqueos           ArqueoCaja[]
}
```

### 3.5 Resumen de cambios en schema.prisma

| Modelo | Tipo de cambio | Nuevos campos |
|--------|---------------|---------------|
| `PuntoDeVenta` | Extensión | `tipoCaja`, `almacenId`, `cuentaContableId` |
| `Venta` | Extensión | `turnoId`, `metodoPago`, `montoEfectivo`, `montoTarjeta`, `montoTransferencia`, `montoCredito` |
| `TurnoPuntoVenta` | **NUEVO** | — |
| `ArqueoCaja` | **NUEVO** | — |
| `MetodoPagoVenta` | **NUEVO enum** | — |
| `EstadoTurno` | **NUEVO enum** | — |

---

## 4. Flujos

### 4.1 Abrir Turno

**Actor**: Cajero

```
Given un punto de venta SIN turno ABIERTO
When el cajero abre turno con fondoInicialCup y fondoInicialUsd
Then se crea un TurnoPuntoVenta con estado=ABIERTO
And se registra empleadoId y fechaApertura
And el POS queda listo para vender
```

**Restricciones**:
- No se MAY abrir un turno si ya hay uno ABIERTO en el mismo POS.
- El fondo inicial MUST ser ≥ 0.
- El fondo inicial SHOULD tener un máximo configurable por tenant (no implementado en esta tanda, pero el campo `fondoInicialCup`/`fondoInicialUsd` lo soporta).

**Server Action**: `abrirTurnoAction(input: { puntoDeVentaId, empleadoId?, fondoInicialCup?, fondoInicialUsd? })`

### 4.2 Vender durante un turno

**Actor**: Cajero (sistema)

```
Given un TurnoPuntoVenta ABIERTO
When se crea una Venta con metodoPago y desglose de montos
Then la Venta se asocia al turnoId
And se actualiza el total de ventas del turno
```

**Reglas**:
- Si el método de pago es `EFECTIVO`, entonces `montoEfectivo = total`.
- Si es `TARJETA`, `montoTarjeta = total`.
- Si es `MIXTO`, los montos desglosados MUST sumar el total de la venta.
- El `turnoId` MUST ser obligatorio al crear venta desde el POS. El sistema SHOULD usar el turno ABIERTO del puntoDeVenta automáticamente.

### 4.3 Cerrar Turno (sin arqueo)

**Actor**: Cajero / Supervisor

```
Given un TurnoPuntoVenta ABIERTO
When el cajero cierra el turno
Then se registra fechaCierre
And estado pasa a CERRADO
And el sistema MUST advertir que no hubo arqueo físico
```

### 4.4 Realizar Arqueo

**Actor**: Cajero / Supervisor

```
Given un TurnoPuntoVenta ABIERTO
When el supervisor realiza el arqueo (conteo físico)
Then se crea un ArqueoCaja con los totales contados
And se calculan los esperados (ventas + fondo inicial)
And se calculan las diferencias (contado - esperado)
And se registra el conteo de billetes y monedas
```

**Reglas**:
- El arqueo MAY realizarse antes del cierre del turno (recomendado) o después (cierre forzado).
- Si `diferenciaCup ≠ 0`, el sistema MUST mostrar una advertencia.
- Diferencias > umbral configurable (ej: 500 CUP) SHOULD requerir autorización de supervisor.
- El arqueo es la ÚNICA forma de cerrar un turno responsablemente.

**Server Actions**:
- `getEsperadosArqueoAction(turnoId)` — calcula lo que debería haber en caja según ventas + fondo inicial.
- `realizarArqueoAction(input: { turnoId, ...conteo })` — guarda el arqueo y cierra el turno.

### 4.5 Cuadre Diario mejorado

El endpoint `getCuadreDiarioAction` existente se extiende:

```
Given una fecha
When se solicita el cuadre diario
Then se incluye por cada punto de venta:
  - turno(s) del día (apertura/cierre)
  - fondoInicialCup, fondoInicialUsd
  - totalVentasEfectivo, totalVentasTarjeta, totalVentasTransferencia
  - arqueo (si existe)
  - diferenciaCup, diferenciaUsd
  - estado del turno (ABIERTO/CERRADO)
```

El resumen general incluye:

| Concepto | Antes | Después |
|----------|-------|---------|
| efectivoInicial | `0` (dummy) | Suma de fondosIniciales de turnos del día |
| efectivoFinal | `0` (dummy) | Suma de totalEfectivoCup de arqueos |
| ventas por metodoPago | No disponible | Desglose real |
| diferencias | No disponible | Suma de diferencias de arqueos |

---

## 5. Escenarios Específicos (Given/When/Then)

### E-1: Apertura de turno con fondo

```gherkin
Given un punto de venta "Cafetería Principal"
When el cajero "María" abre turno con fondoInicialCup = 50000 ($500.00 CUP)
Then el turno se crea con estado ABIERTO
And el fondoInicialCup es 50000
And el POS "Cafetería Principal" tiene un turno activo
```

### E-2: Venta en efectivo durante turno

```gherkin
Given un turno ABIERTO en "Cafetería Principal"
When se registra una venta por $150.00 CUP en EFECTIVO
Then la venta se crea con turnoId = <turno-activo>
And metodoPago = EFECTIVO
And montoEfectivo = 15000
And el esperadoEfectivo en caja aumenta a 50000 + 15000 = 65000
```

### E-3: Arqueo y cierre

```gherkin
Given un turno con fondoInicialCup = 50000
And ventas del turno suman $120.00 CUP en efectivo
When el supervisor hace el arqueo: cuenta 62000 en efectivo CUP
Then el sistema calcula esperadoEfectivoCup = 50000 + 12000 = 62000
And diferenciaCup = 62000 - 62000 = 0
And el turno se cierra
```

### E-4: Diferencia de caja

```gherkin
Given un turno con fondoInicialCup = 50000
And ventas del turno suman $100.00 CUP en efectivo
When el supervisor cuenta 59800 en efectivo CUP
Then esperadoEfectivoCup = 50000 + 10000 = 60000
And diferenciaCup = 59800 - 60000 = -200 (faltante)
And el sistema muestra advertencia de diferencia
```

### E-5: Doble apertura bloqueada

```gherkin
Given un turno ABIERTO en "Cafetería Principal"
When se intenta abrir otro turno en el mismo POS
Then el sistema rechaza con error "Ya existe un turno abierto en este punto de venta"
```

### E-6: Venta sin turno abierto (POLÍTICA)

```gherkin
Given un punto de venta SIN turno ABIERTO
When se intenta crear una venta
Then el sistema MUST rechazar con error "Debe abrir un turno antes de vender"
```

> **Excepción**: Ventas desde APIs externas o importación pueden usar el turno LEGACY. Esto se controla explícitamente en el caller.

### E-7: Legado — ventas sin turno ni metodoPago

```gherkin
Given ventas existentes en la BD sin turnoId y sin metodoPago
When se ejecuta la migración
Then se crea un TurnoPuntoVenta LEGACY por tenant
And se asignan todas las ventas huérfanas a ese turno LEGACY
```

### E-8: Pago mixto

```gherkin
Given un turno ABIERTO
When se registra una venta por $200.00 CUP
And el cliente paga $80 en efectivo y $120 con tarjeta
Then metodoPago = MIXTO
And montoEfectivo = 8000
And montoTarjeta = 12000
And la suma de montos desglosados = 8000 + 12000 = 20000 (total correcto)
```

---

## 6. API (Server Actions)

### 6.1 Abrir Turno

```typescript
export const abrirTurnoAction = withAction(
  async (input: {
    puntoDeVentaId: string
    empleadoId?: string
    fondoInicialCup?: number   // centavos
    fondoInicialUsd?: number   // centavos
  }, user: AuthenticatedUser) => {
    // 1. Validar que no exista turno ABIERTO en el mismo POS
    // 2. Validar empleado si se provee
    // 3. Crear TurnoPuntoVenta
    // 4. Revalidate /busy/puntosDeVenta
  }
)
```

### 6.2 Listar Turnos

```typescript
export const getTurnosAction = withAction(
  async (input: {
    puntoDeVentaId?: string
    fecha?: string
    estado?: EstadoTurno
  }, user: AuthenticatedUser) => {
    // Filtro por tenant, opcional por POS/fecha/estado
  }
)
```

### 6.3 Cerrar Turno

```typescript
export const cerrarTurnoAction = withAction(
  async (input: {
    turnoId: string
    forzar?: boolean   // permite cerrar sin arqueo si es true (debe advertir)
  }, user: AuthenticatedUser) => {
    // Validar que el turno sea del tenant
    // Validar que esté ABIERTO
    // Si forzar=false y no hay arqueo, advertir
    // Cerrar turno
  }
)
```

### 6.4 Realizar Arqueo (y cerrar turno)

```typescript
export const realizarArqueoAction = withAction(
  async (input: {
    turnoId: string
    // conteo billetes CUP
    billetes1000Cup: number
    billetes500Cup: number
    billetes200Cup: number
    billetes100Cup: number
    billetes50Cup: number
    billetes20Cup: number
    monedasCup: number        // valor total en centavos
    // conteo billetes USD
    billetes100Usd: number
    billetes50Usd: number
    billetes20Usd: number
    billetes10Usd: number
    billetes5Usd: number
    billetes1Usd: number
    monedasUsd: number        // valor total en centavos
    // totales no-efectivo
    totalTarjeta: number
    totalTransferencia: number
    totalCredito: number
    observaciones?: string
  }, user: AuthenticatedUser) => {
    // 1. Validar turno ABIERTO y del tenant
    // 2. Calcular totales físicos CUP
    // 3. Calcular totales físicos USD
    // 4. Calcular esperados desde ventas + fondo inicial
    // 5. Calcular diferencias
    // 6. Si diferencia > umbral, requerir autorización (opcional en esta tanda)
    // 7. Guardar ArqueoCaja
    // 8. Cerrar turno
    // 9. Revalidate
  }
)
```

### 6.5 Cuadre Diario mejorado

```typescript
export const getCuadreDiarioAction = withAction(
  async (fecha: string, user: AuthenticatedUser) => {
    // Existente + EXTENSIONES:
    // - Obtener turnos del día agrupados por POS
    // - Obtener arqueos del día
    // - Calcular fondoInicialTotal, fondoFinalTotal, diferencias
    // - Desglosar ventas por metodoPago
    // - Devolver estructura enriquecida
  }
)
```

### 6.6 Obtener esperados para arqueo

```typescript
export const getEsperadosArqueoAction = withAction(
  async (turnoId: string, user: AuthenticatedUser) => {
    // Calcula:
    // - fondoInicial del turno
    // - suma de ventas en efectivo CUP del turno
    // - suma de ventas en efectivo USD (si aplica)
    // - suma de ventas en tarjeta, transferencia, crédito
    // Devuelve: { esperadoCup, esperadoUsd, esperadoTarjeta, ...}
    // Esto permite al UI mostrar "lo que debería haber" antes de contar
  }
)
```

---

## 7. Migración de Datos

### 7.1 Ventas existentes

```sql
-- Por cada tenant, crear un turno LEGACY
INSERT INTO "turnos_punto_venta" (id, "tenantId", "puntoDeVentaId", tipo, "fechaApertura", "fechaCierre", estado)
SELECT
  gen_random_uuid(),
  t."tenantId",
  pv."pvId",
  'LEGACY',
  (SELECT MIN(v."createdAt") FROM "Venta" v WHERE v."tenantId" = t."tenantId" AND v."puntoDeVentaId" = pv."pvId"),
  NOW(),
  'CERRADO'
FROM "Tenant" t
CROSS JOIN "PuntoDeVenta" pv
WHERE pv."tenantId" = t."tenantId"
AND EXISTS (SELECT 1 FROM "Venta" v WHERE v."tenantId" = t."tenantId" AND v."puntoDeVentaId" = pv."pvId");

-- Asignar turno LEGACY a ventas existentes sin turnoId
UPDATE "Venta" v
SET "turnoId" = tpv.id
FROM "turnos_punto_venta" tpv
WHERE v."tenantId" = tpv."tenantId"
AND v."puntoDeVentaId" = tpv."puntoDeVentaId"
AND v."turnoId" IS NULL
AND tpv.tipo = 'LEGACY';
```

### 7.2 Backfill metodoPago

No hay backfill automático para `metodoPago` porque no tenemos datos históricos confiables. Se deja como NULL y el cuadre diario existente no se ve afectado (sigue funcionando con los totales).

---

## 8. UI — Wireframes funcionales

### 8.1 Diálogo de apertura de turno

```
┌─────────────────────────────────────┐
│  Abrir Turno — Cafetería Principal  │
│─────────────────────────────────────│
│  Cajero:    [María García    ▼]     │
│                                     │
│  Fondo Inicial CUP:  [  500.00  ]  │
│  Fondo Inicial USD:  [    0.00  ]  │
│                                     │
│  Observaciones:  [_______________]  │
│                                     │
│        [ Cancelar ]  [ Abrir Turno ]│
└─────────────────────────────────────┘
```

### 8.2 Estado del turno en cabecera POS

```
┌──────────────────────────────────────────────────┐
│  🟢 Turno activo #00123  |  María García         │
│  Fondo: $500.00 CUP  |  Ventas: $1,230.00       │
│  [Cerrar Turno] [Ver Arqueo]                     │
└──────────────────────────────────────────────────┘
```

### 8.3 Pantalla de arqueo

```
┌────────────────────────────────────────────────────────┐
│  Arqueo de Caja — Cafetería Principal                  │
│  Turno #00123  |  Abierto: 08:00  |  Cajero: María    │
│────────────────────────────────────────────────────────│
│                                                        │
│  ┌─ EFECTIVO CUP ─────────────────────────────────┐   │
│  │  Billetes $1000:  [  2  ]  =   $2,000.00      │   │
│  │  Billetes $500:   [  1  ]  =     $500.00       │   │
│  │  Billetes $200:   [  3  ]  =     $600.00       │   │
│  │  Billetes $100:   [  5  ]  =     $500.00       │   │
│  │  Billetes $50:    [  4  ]  =     $200.00       │   │
│  │  Billetes $20:    [  0  ]  =       $0.00       │   │
│  │  Monedas:         [ 45.50 ]                     │   │
│  │  ──────────────────────────────────────         │   │
│  │  Total contado:                    $3,845.50    │   │
│  │  Esperado (sistema):              $3,845.50    │   │
│  │  Diferencia:                           $0.00 ✅ │   │
│  └────────────────────────────────────────────────┘   │
│                                                        │
│  ┌─ TARJETA ──────────────────────────────────────┐   │
│  │  Total vouchers:              [$ 1,200.00  ]   │   │
│  │  Esperado (sistema):              $1,200.00    │   │
│  │  Diferencia:                           $0.00 ✅ │   │
│  └────────────────────────────────────────────────┘   │
│                                                        │
│  Observaciones: [Todo en orden                  ]     │
│                                                        │
│        [ Cerrar sin arqueo ]   [ Confirmar Arqueo ]   │
└────────────────────────────────────────────────────────┘
```

---

## 9. Estrategia de Implementación (orden sugerido)

| Fase | Items | Depende de | Esfuerzo estimado |
|------|-------|-----------|-------------------|
| **F1: Schema + migración** | Modelos nuevos, extensión Venta y PuntoDeVenta, migración, backfill LEGACY | Nada | 3-4h |
| **F2: Server Actions base** | `abrirTurnoAction`, `getTurnosAction`, `cerrarTurnoAction`, ajustar `createVentaAction` para turno/metodoPago | F1 | 4-5h |
| **F3: Arqueo** | `getEsperadosArqueoAction`, `realizarArqueoAction`, validaciones de diferencia | F2 | 4-5h |
| **F4: UI de turno** | Diálogo apertura, cabecera POS con estado, botón cerrar | F1, F2 | 4-6h |
| **F5: UI de arqueo** | Pantalla de arqueo con conteo, resumen de diferencias | F3 | 5-6h |
| **F6: Cuadre Diario mejorado** | Extender action existente, conectar turnos + arqueos + metodoPago | F2, F3 | 3-4h |
| **F7: Tests** | Unit/integration para actions y flujos críticos | F1-F6 | 4-5h |

**Total estimado**: 27-33 horas de implementación.

---

## 10. Decisiones Resueltas

| # | Pregunta | Decisión | Razón |
|---|----------|----------|-------|
| Q1 | ¿El turno debe ser OBLIGATORIO para vender? | **HÍBRIDA** — POS tipo `PRINCIPAL` requiere apertura manual con fondo; POS tipo `MOVIL`/`SECUNDARIA` crea turno automático al vender | Control donde hay efectivo físico, agilidad donde no lo hay. Se configura por tipo de caja. |
| Q2 | ¿Soportamos pago mixto desde el principio? | **Sí**, con desglose por tipo de pago | Cubre el caso real más común (cliente paga parte en efectivo, parte con tarjeta). Validación: suma de montos desglosados == total venta. |
| Q3 | ¿El arqueo debe ser obligatorio para cerrar turno? | **Opcional con advertencia** — se puede cerrar sin arqueo, pero el sistema muestra advertencia y lo registra | Flexibilidad operativa sin perder la trazabilidad de que no hubo control. |
| Q4 | ¿Integramos con PeriodoContable en esta tanda? | **Sí** — el arqueo genera un asiento contable en el periodo activo | Máximo valor contable desde el primer día. El arqueo alimenta `PeriodoContable` y cierres. |
