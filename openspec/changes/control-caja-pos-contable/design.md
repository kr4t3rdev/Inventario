# Design: Control de Caja POS y Cuadre Contable Operativo

> **Status**: Draft
> **Base spec**: `spec.md` (aprobado con decisiones Q1-Q4)

---

## 1. Diagrama de Entidades Final

```
┌──────────────────────┐       ┌──────────────────────────┐
│    PuntoDeVenta      │       │     TurnoPuntoVenta      │
├──────────────────────┤       ├──────────────────────────┤
│ pvId (PK)            │──1:N──│ id (PK)                  │
│ tenantId             │       │ tenantId                 │
│ nombre               │       │ puntoDeVentaId (FK)      │
│ ubicacion            │       │ empleadoId (FK) nullable │
│ listaPrecioId        │       │ tipo: NORMAL|AUTO|LEGACY │
│ tipoCaja*            │       │ fechaApertura            │
│ almacenId*           │       │ fechaCierre?             │
│ cuentaContableId*    │       │ fondoInicialCup          │
└──────┬───────────────┘       │ fondoInicialUsd          │
       │                       │ estado: ABIERTO|CERRADO  │
       │ 1:N                   │ observaciones?           │
       │                       └──────────┬───────────────┘
       │                                  │ 1:1
       │                                  ▼
       │                       ┌──────────────────────────┐
       │                       │       ArqueoCaja          │
       │                       ├──────────────────────────┤
       │                       │ id (PK)                  │
       │                       │ turnoId (FK, UNIQUE)      │
       │                       │ tenantId                 │
       │                       │ puntoDeVentaId (FK)      │
       │                       │ · conteo billetes CUP    │
       │                       │ · conteo billetes USD    │
       │                       │ · totalEfectivoCup       │
       │                       │ · totalEfectivoUsd       │
       │                       │ · totalTarjeta           │
       │                       │ · totalTransferencia     │
       │                       │ · totalCredito           │
       │                       │ · esperados (calculados) │
       │                       │ · diferencias            │
       │                       │ · contabilizado: bool    │
       └───────────────────────┘                          │
                               └──────────────────────────┘

┌──────────────────────┐
│       Venta          │
├──────────────────────┤
│ ventaId (PK)         │
│ ...campos existentes │
│ turnoId* (FK)        │──N:1──┘
│ metodoPago*          │
│ montoEfectivo*       │
│ montoTarjeta*        │
│ montoTransferencia*  │
│ montoCredito*        │
└──────────────────────┘

(* = nuevos campos)
```

### 1.1 Integración con PeriodoContable

```
┌──────────────────────┐
│  PeriodoContable     │
├──────────────────────┤
│ periodoId            │
│ estado               │
│ ...                  │
│ apertura (1:1)       │
└──────┬───────────────┘
       │
       │ 1:1
       ▼
┌──────────────────────┐       ┌──────────────────────────┐
│  AperturaPeriodo     │       │      ArqueoCaja           │
├──────────────────────┤       ├──────────────────────────┤
│ aperturaId           │       │ id                       │
│ periodoId (FK,UNQ)   │       │ turnoId (FK, UNQ)        │
│ saldoCajaInicial     │◄──────│ totalEfectivoCup         │
│ saldoBancoInicial    │       │ totalEfectivoUsd         │
│ saldoInventarioInicial│      │ totalTarjeta             │
│ ...                  │       │ ...                      │
│ detalleJson (JSON)   │──────▶│ contabilizado: true      │
└──────────────────────┘       └──────────────────────────┘

Flujo contable:
  ArqueoCaja (cierre turno)
    → suma por punto de venta en el periodo
    → alimenta saldoCajaInicial del siguiente AperturaPeriodo
    → ArqueoCaja.contabilizado = true
```

---

## 2. Arquitectura de Implementación

### 2.1 Capas por feature

```
src/
├── features/
│   ├── puntos-venta/               ← Extensión
│   │   ├── actions.ts              ← + tipoCaja, almacenId, cuentaContableId
│   │   ├── schemas.ts              ← + tipoCaja enum
│   │   └── types.ts
│   │
│   ├── turnos-pos/                 ← NUEVA feature
│   │   ├── actions.ts              ← abrir, cerrar, listar, getEsperados
│   │   ├── schemas.ts              ← zod schemas
│   │   ├── types.ts
│   │   └── components/
│   │       ├── apertura-turno-dialog.tsx
│   │       ├── cabecera-turno.tsx
│   │       ├── selector-turno.tsx   ← turno activo para UI POS
│   │       └── cierre-turno-dialog.tsx
│   │
│   ├── arqueo-caja/                ← NUEVA feature
│   │   ├── actions.ts              ← realizarArqueo, getEsperados
│   │   ├── schemas.ts
│   │   ├── types.ts
│   │   └── components/
│   │       ├── arqueo-form.tsx
│   │       ├── conteo-billetes.tsx  ← componente reutilizable de entrada de billetes
│   │       ├── resumen-diferencias.tsx
│   │       └── historial-arqueos.tsx
│   │
│   ├── ventas/                     ← Extensión
│   │   ├── actions.ts              ← createVentaAction con turnoId + metodoPago
│   │   ├── schemas.ts              ← + metodoPago, desglose montos
│   │   ├── types.ts
│   │   └── components/
│   │       ├── pv-interface.tsx     ← + cabecera turno, metodoPago en checkout
│   │       └── metodo-pago-selector.tsx  ← NUEVO: selector con desglose mixto
│   │
│   ├── cuadre-diario/              ← Extensión
│   │   ├── actions.ts              ← + turnos, arqueos, metodoPago
│   │   └── components/
│   │       └── cuadre-diario.tsx    ← + saldos iniciales/finales/diferencias
│   │
│   └── contabilidad/               ← Extensión
│       └── actions-periodos.ts     ← + integrarArqueoEnPeriodo()
```

### 2.2 Nuevas features a crear

| Feature | Archivos | Propósito |
|---------|----------|-----------|
| `features/turnos-pos/` | actions, schemas, types, components | Gestión de turnos de punto de venta |
| `features/arqueo-caja/` | actions, schemas, types, components | Arqueo y conteo físico de caja |

### 2.3 Features existentes a extender

| Feature | Cambio |
|---------|--------|
| `features/puntos-venta/` | Agregar `tipoCaja`, `almacenId`, `cuentaContableId` a schema y actions |
| `features/ventas/` | Agregar `turnoId`, `metodoPago`, montos desglosados a createVentaAction |
| `features/cuadre-diario/` | Conectar turnos + arqueos + desglose metodoPago |
| `features/contabilidad/` | Nueva acción `integrarArqueoEnPeriodo()` |

---

## 3. Integración Contable con PeriodoContable

### 3.1 Flujo completo

```
1. Se abre un PeriodoContable (ej: mensual)
   └→ Se crea AperturaPeriodo con saldos iniciales

2. Durante el periodo, se abren y cierran turnos POS
   └→ Cada turno genera ventas con metodoPago
   └→ Al cerrar, se hace arqueo (opcional)

3. Al final del periodo (o bajo demanda):
   └→ Se llama a integrarArqueosEnPeriodo(periodoId)
   └→ Suma todos los arqueos del periodo por punto de venta
   └→ Acumula en AperturaPeriodo.detalleJson:
       {
         "arqueos": [
           { "puntoDeVentaId": "...", "totalEfectivoCup": 50000, "totalTarjeta": 30000 }
         ],
         "ventasPorMetodoPago": {
           "efectivo": 50000,
           "tarjeta": 30000,
           "transferencia": 10000,
           "credito": 5000,
           "mixto": 5000
         }
       }
   └→ Marca cada ArqueoCaja.contabilizado = true
```

### 3.2 Server Action

```typescript
/**
 * @description Integra todos los arqueos de caja de un periodo contable.
 * Recorre los turnos cerrados dentro del rango del periodo,
 * suma sus arqueos y actualiza AperturaPeriodo.detalleJson.
 */
export const integrarArqueosEnPeriodoAction = withAction(
  async (periodoId: string, user: AuthenticatedUser) => {
    const tenantId = requireTenant(user);

    const periodo = await prisma.periodoContable.findFirst({
      where: { periodoId, tenantId },
      include: { apertura: true },
    });
    if (!periodo) throw new ActionError('Periodo no encontrado', 'NOT_FOUND');

    // Obtener arqueos del periodo
    const arqueos = await prisma.arqueoCaja.findMany({
      where: {
        tenantId,
        createdAt: { gte: periodo.fechaInicio, lte: periodo.fechaFin },
        contabilizado: false,
      },
      include: { turno: { include: { ventas: true } } },
    });

    // Calcular agregados
    const detalle = {
      arqueos: arqueos.map(a => ({
        arqueoId: a.id,
        puntoDeVentaId: a.puntoDeVentaId,
        totalEfectivoCup: a.totalEfectivoCup,
        totalEfectivoUsd: a.totalEfectivoUsd,
        totalTarjeta: a.totalTarjeta,
        totalTransferencia: a.totalTransferencia,
        totalCredito: a.totalCredito,
        diferenciaCup: a.diferenciaCup,
        diferenciaUsd: a.diferenciaUsd,
      })),
      ventasPorMetodoPago: {} as Record<string, number>,
    };

    // Acumular ventas por metodoPago del periodo
    const ventasPeriodo = await prisma.venta.findMany({
      where: {
        tenantId,
        createdAt: { gte: periodo.fechaInicio, lte: periodo.fechaFin },
        metodoPago: { not: null },
      },
    });

    for (const v of ventasPeriodo) {
      const mp = v.metodoPago?.toLowerCase() ?? 'sin_dato';
      detalle.ventasPorMetodoPago[mp] = (detalle.ventasPorMetodoPago[mp] ?? 0) + (v.total ?? 0);
    }

    // Actualizar AperturaPeriodo
    await prisma.aperturaPeriodo.upsert({
      where: { periodoId },
      create: {
        periodoId,
        tenantId,
        saldoCajaInicial: 0, // se calcula en apertura formal
        detalleJson: detalle,
      },
      update: { detalleJson: detalle },
    });

    // Marcar arqueos como contabilizados
    await prisma.arqueoCaja.updateMany({
      where: { id: { in: arqueos.map(a => a.id) } },
      data: { contabilizado: true },
    });

    return { arqueosIntegrados: arqueos.length };
  }
);
```

### 3.3 Trigger de integración

La integración se dispara en dos momentos:

1. **Automático al cerrar periodo**: Cuando se ejecuta `cerrarPeriodoAction`, debe llamar a `integrarArqueosEnPeriodo` primero.
2. **Manual bajo demanda**: Botón "Integrar arqueos al periodo" en la UI de periodos contables.

---

## 4. Arquitectura de Componentes UI

### 4.1 Árbol de componentes

```
App POS (pv-interface.tsx)
├── CabeceraTurno                    ← Siempre visible cuando hay turno activo
│   ├── Indicador estado (🟢/🔴)
│   ├── Cajero asignado
│   ├── Fondo inicial
│   ├── Ventas del turno
│   └── [Cerrar Turno] [Ver Arqueo]
│
├── [Si no hay turno y tipo=PRINCIPAL]
│   └── AperturaTurnoDialog
│       ├── Selector empleado
│       ├── Input fondoInicialCup
│       ├── Input fondoInicialUsd
│       └── [Abrir Turno]
│
├── Zona de productos (existente)
│
├── Carrito (existente)
│
└── Checkout (mejorado)
    ├── Selector MetodoPago
    │   ├── [Efectivo] [Tarjeta] [Transferencia] [Crédito]
    │   └── [Mixto] → sub-form con desglose
    ├── Resumen total
    └── [Confirmar Venta]
```

### 4.2 Componente MetodoPagoSelector

```
┌─────────────────────────────────────┐
│  Método de Pago                     │
│─────────────────────────────────────│
│  ○ Efectivo                         │
│  ○ Tarjeta                          │
│  ○ Transferencia                    │
│  ○ Crédito                          │
│  ● Mixto ─────────────────────────  │
│    Efectivo:  [$ 80.00        ]     │
│    Tarjeta:   [$ 120.00       ]     │
│    Total: $200.00 ✓                 │
│                                     │
│  [Cancelar]  [Confirmar Venta]      │
└─────────────────────────────────────┘
```

**Validación**: La suma de montos desglosados DEBE ser exactamente igual al total de la venta. Si no, error inline y botón deshabilitado.

### 4.3 Cabecera de turno

```
┌──────────────────────────────────────────────────────────┐
│  🟢 Turno #00123 · María García                          │
│  Fondo: $500.00 CUP · Ventas: $1,230.00 · 12 tickets    │
│  ┌──────────────────────────────────────────────────┐    │
│  │  [🔒 Cerrar Turno]  [📋 Ver Arqueo]             │    │
│  └──────────────────────────────────────────────────┘    │
├──────────────────────────────────────────────────────────┤
│  (zona de venta normal abajo...)                         │
└──────────────────────────────────────────────────────────┘
```

### 4.4 Diálogo de cierre

```
┌─────────────────────────────────────┐
│  Cerrar Turno #00123                │
│─────────────────────────────────────│
│  📊 Resumen del turno               │
│  Ventas:                $1,230.00   │
│  Tickets:                       12  │
│                                     │
│  ⚠️ No se ha realizado arqueo      │
│  ¿Desea cerrar sin arqueo?          │
│                                     │
│  [Cancelar]  [Cerrar sin arqueo]    │
│  [Ir a Arqueo] ← recomendado        │
└─────────────────────────────────────┘
```

---

## 5. Migración de Datos — Detalle

### 5.1 Script de migración SQL

```sql
-- ============================================
-- Migration: control-caja-pos
-- ============================================

-- 1. Crear turnos LEGACY para ventas existentes
-- Por cada tenant + puntoDeVenta que tenga ventas sin turno
INSERT INTO turnos_punto_venta (
  id, tenantId, "puntoDeVentaId",
  tipo, "fechaApertura", "fechaCierre",
  estado, "fondoInicialCup", "fondoInicialUsd",
  "createdAt", "updatedAt"
)
SELECT
  gen_random_uuid()::text,
  v.tenantId,
  v."puntoDeVentaId",
  'LEGACY',
  MIN(v."createdAt"),
  NOW(),
  'CERRADO',
  0, 0,
  NOW(), NOW()
FROM "Venta" v
WHERE v."turnoId" IS NULL
GROUP BY v.tenantId, v."puntoDeVentaId";

-- 2. Asignar turno LEGACY a ventas huérfanas
UPDATE "Venta" v
SET "turnoId" = tpv.id
FROM turnos_punto_venta tpv
WHERE v."tenantId" = tpv."tenantId"
  AND v."puntoDeVentaId" = tpv."puntoDeVentaId"
  AND v."turnoId" IS NULL
  AND tpv.tipo = 'LEGACY';

-- 3. Actualizar PuntoDeVenta existentes con tipoCaja por defecto
UPDATE "PuntoDeVenta"
SET "tipoCaja" = 'PRINCIPAL'
WHERE "tipoCaja" IS NULL;
```

### 5.2 Migración Prisma

En el archivo de migración `prisma/migrations/`, se ejecuta el SQL raw anterior dentro de `CREATE TABLE` y luego el backfill.

---

## 6. Descomposición en Tareas

### Fase 1: Schema + Migración

| # | Tarea | Archivos | Depende de |
|---|-------|----------|-----------|
| 1.1 | Agregar modelos `TurnoPuntoVenta`, `ArqueoCaja` y enums al schema.prisma | `prisma/schema.prisma` | — |
| 1.2 | Extender `Venta` con `turnoId`, `metodoPago`, montos desglosados | `prisma/schema.prisma` | — |
| 1.3 | Extender `PuntoDeVenta` con `tipoCaja`, `almacenId`, `cuentaContableId` | `prisma/schema.prisma` | — |
| 1.4 | Generar migración Prisma + script backfill LEGACY | `prisma/migrations/` | 1.1, 1.2, 1.3 |
| 1.5 | Validar migración en BD local | — | 1.4 |

### Fase 2: Server Actions base

| # | Tarea | Archivos | Depende de |
|---|-------|----------|-----------|
| 2.1 | Crear feature `turnos-pos/` con schemas, types y barrel | `src/features/turnos-pos/` | 1.4 |
| 2.2 | `abrirTurnoAction` — crear turno, validar duplicado | `src/features/turnos-pos/actions.ts` | 2.1 |
| 2.3 | `getTurnosAction` — listar con filtros | `src/features/turnos-pos/actions.ts` | 2.1 |
| 2.4 | `cerrarTurnoAction` — cerrar con/sin arqueo, advertencia | `src/features/turnos-pos/actions.ts` | 2.1 |
| 2.5 | Turno automático: al crear venta sin turno activo en POS MOVIL | `src/features/turnos-pos/actions.ts` | 2.2 |
| 2.6 | Extender `createVentaSchema` con `turnoId`, `metodoPago`, montos | `src/features/ventas/schemas.ts` | 1.4 |
| 2.7 | Extender `createVentaAction` para usar turno activo + validar metodoPago | `src/features/ventas/actions.ts` | 2.2, 2.6 |

### Fase 3: Arqueo

| # | Tarea | Archivos | Depende de |
|---|-------|----------|-----------|
| 3.1 | Crear feature `arqueo-caja/` con schemas, types y barrel | `src/features/arqueo-caja/` | 1.4 |
| 3.2 | `getEsperadosArqueoAction` — calcular esperados desde ventas + fondo | `src/features/arqueo-caja/actions.ts` | 3.1 |
| 3.3 | `realizarArqueoAction` — guardar conteo, calcular diferencias, cerrar turno | `src/features/arqueo-caja/actions.ts` | 3.1, 3.2 |

### Fase 4: Integración contable

| # | Tarea | Archivos | Depende de |
|---|-------|----------|-----------|
| 4.1 | `integrarArqueosEnPeriodoAction` — sumar arqueos al periodo activo | `src/features/contabilidad/actions-periodos.ts` | 3.3 |
| 4.2 | Trigger en `cerrarPeriodoAction` para integrar arqueos automáticamente | `src/features/contabilidad/actions-periodos.ts` | 4.1 |

### Fase 5: UI de Turno

| # | Tarea | Archivos | Depende de |
|---|-------|----------|-----------|
| 5.1 | Componente `AperturaTurnoDialog` | `src/features/turnos-pos/components/` | 2.2 |
| 5.2 | Componente `CabeceraTurno` con estado activo | `src/features/turnos-pos/components/` | 2.1 |
| 5.3 | Componente `CierreTurnoDialog` con advertencia de arqueo | `src/features/turnos-pos/components/` | 2.4 |
| 5.4 | Integrar CabeceraTurno en `pv-interface.tsx` | `src/features/ventas/components/pv-interface.tsx` | 5.2 |
| 5.5 | Mostrar AperturaTurnoDialog cuando no hay turno y tipo=PRINCIPAL | `src/features/ventas/components/pv-interface.tsx` | 5.1, 5.4 |

### Fase 6: UI de Arqueo

| # | Tarea | Archivos | Depende de |
|---|-------|----------|-----------|
| 6.1 | Componente `ConteoBilletes` — entrada de billetes por denominación | `src/features/arqueo-caja/components/` | 3.1 |
| 6.2 | Componente `ResumenDiferencias` — tabla esperado vs contado | `src/features/arqueo-caja/components/` | 3.3 |
| 6.3 | Componente `ArqueoForm` — pantalla completa de arqueo | `src/features/arqueo-caja/components/` | 6.1, 6.2 |

### Fase 7: Cuadre Diario mejorado

| # | Tarea | Archivos | Depende de |
|---|-------|----------|-----------|
| 7.1 | Extender `getCuadreDiarioAction` con turnos, arqueos, desglose metodoPago | `src/features/cuadre-diario/actions.ts` | 2.1, 3.1 |
| 7.2 | Actualizar UI `CuadreDiarioFinanciero` con columnas de saldos y diferencias | `src/features/cuadre-diario/components/cuadre-diario.tsx` | 7.1 |

### Fase 8: Tests

| # | Tarea | Archivos | Depende de |
|---|-------|----------|-----------|
| 8.1 | Tests unitarios `abrirTurnoAction` — apertura, duplicado | `src/features/turnos-pos/__tests__/` | 2.2 |
| 8.2 | Tests unitarios `createVentaAction` con metodoPago y turno | `src/features/ventas/__tests__/actions.test.ts` | 2.7 |
| 8.3 | Tests unitarios `realizarArqueoAction` — conteo, diferencias | `src/features/arqueo-caja/__tests__/` | 3.3 |
| 8.4 | Tests unitarios `integrarArqueosEnPeriodoAction` | `src/features/contabilidad/__tests__/` | 4.1 |
| 8.5 | Tests de migración — backfill LEGACY | `src/__tests__/production/` | 1.4 |

---

## 7. Dependencias entre fases

```
F1 (Schema)
 ├── F2 (Actions base) → F3 (Arqueo) → F4 (Contable)
 └── F5 (UI Turno) → F6 (UI Arqueo)
                        └── F7 (Cuadre Diario)
F8 (Tests) ← todo lo anterior
```

**Orden de implementación recomendado**:
1. **F1** (no negociable, es la base)
2. **F2 + F5 en paralelo** (backend turno + UI turno no dependen entre sí estrictamente si el contrato de actions está definido)
3. **F3 + F6 en paralelo** (backend arqueo + UI arqueo)
4. **F4** (integración contable)
5. **F7** (cuadre diario mejorado)
6. **F8** (tests de integración)

---

## 8. Riesgos Técnicos

| Riesgo | Impacto | Mitigación |
|--------|---------|-----------|
| Validación de turno único ABIERTO sin unique parcial en Prisma | Medio | Validación en capa de aplicación + índice parcial SQL nativo |
| Ventas existentes sin metodoPago rompen reports | Bajo | metodoPago nullable; reports filtran con `not: null` |
| Arqueo con fondoInicialUsd y ventas en CUP — mezcla de monedas | Medio | Cada moneda se trata por separado: CUP y USD tienen sus propios campos. No hay conversión automática. |
| Cierre de periodo con arqueos sin contabilizar | Medio | `cerrarPeriodoAction` MUST llamar a `integrarArqueosEnPeriodo` primero o rechazar. |
| POS MOVIL sin internet no puede verificar turno | Bajo | Se asume online; el offline queda para tanda futura. |
