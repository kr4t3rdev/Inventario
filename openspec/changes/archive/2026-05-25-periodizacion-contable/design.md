# Design: Periodización Contable

## Technical Approach

Implementación de un sistema de períodos contables jerárquicos (diario → mensual → anual) con guard central de escritura, snapshots inmutables y auditoría completa. El diseño sigue el patrón existente del proyecto: Server Actions con `withAction` wrapper, servicios en `src/lib/services/`, modelos Prisma aditivos, y feature flag para activación gradual. La arquitectura separa lógica de dominio pura (`PeriodoContableService`) del orquestador de protección (`PeriodoGuard`), siguiendo el principio de responsabilidad única.

Referencias: proposal `openspec/changes/periodizacion-contable/proposal.md`, specs en `specs/periodo/`.

## Architecture Decisions

### Decision: Separación PeriodoContableService vs PeriodoGuard

**Choice**: Dos clases distintas — `PeriodoContableService` contiene lógica de dominio pura (CRUD, transiciones, queries), `PeriodoGuard` es el orquestador que se inyecta en los puntos de escritura.

**Alternatives considered**:
- Una sola clase que haga todo (servicio + guard)
- Guard como middleware puro de Next.js

**Rationale**: El servicio de dominio debe ser testeable en aislamiento sin depender de contexto HTTP. El guard necesita ser inyectable en múltiples contextos (Server Actions, API Routes, workflows). Separarlos permite mockear el servicio en tests del guard y viceversa.

### Decision: Feature flag con dos modos (enforce/audit-only)

**Choice**: Variable de entorno `PERIODO_GUARD_MODE` con valores `'enforce'` (default) y `'audit-only'`. `PERIODO_GUARD_ENABLED=false` es alias de bypass total.

**Alternatives considered**:
- Solo un booleano on/off
- Feature flag por tenant en base de datos

**Rationale**: El modo `audit-only` permite detectar handlers legacy no cubiertos sin romper producción. Un booleano simple no da esta granularidad. El flag por tenant se deja como iteración futura.

### Decision: Caché en memoria con Map simple (no Redis)

**Choice**: `Map<string, { periodo: PeriodoContable; expiresAt: number }>` con TTL de 5 minutos.

**Alternatives considered**:
- Redis para caché distribuido
- Sin caché, query directa en cada escritura

**Rationale**: El proyecto no usa Redis actualmente. Agregarlo solo para este feature es over-engineering. Un Map en memoria funciona para instancias single-process (Vercel serverless tiene cold start pero el TTL de 5 min es suficiente). Si se escala a múltiples instancias, se migra a Redis.

### Decision: Jerarquía implícita por rango de fechas (no relación explícita)

**Choice**: Los períodos diario/mensual/anual se relacionan por solapamiento de fechas, no por `padreId` en el schema.

**Alternatives considered**:
- Campo `padreId` con relación explícita en Prisma
- Ambos: relación explícita + resolución por fechas

**Rationale**: La jerarquía implícita elimina la necesidad de mantener consistencia manual entre padre e hijo. Un período diario siempre pertenece al mensual cuyo rango lo contiene. Esto simplifica el schema y evita bugs de sincronización. Se resuelve con queries de rango (`fechaInicio <= X <= fechaFin`).

### Decision: SnapshotService separado del PeriodoContableService

**Choice**: `SnapshotService` como clase independiente con responsabilidad única de generar y verificar snapshots de saldos.

**Alternatives considered**:
- Generar snapshots dentro del método `cerrarPeriodo` del servicio principal
- Trigger de base de datos para snapshots

**Rationale**: La generación de snapshots es una operación costosa (iterar todas las cuentas bancarias, capturar saldos). Separarla permite reintentar sin re-ejecutar toda la transición de cierre. Además facilita tests aislados de integridad.

### Decision: Modelo de datos aditivo — no modificar modelos existentes

**Choice**: Los nuevos modelos (`PeriodoContable`, `SaldoSnapshot`, `AuditoriaPeriodo`) se agregan al schema sin modificar modelos legacy (`CierreContable`, campos `periodo` string).

**Alternatives considered**:
- Migrar campos string a relaciones con `PeriodoContable`
- Reemplazar `CierreContable` directamente

**Rationale**: La migración de datos históricos es un cambio separado (ver spec `migracion-legacy.md`). Los campos string coexisten durante la transición. El guard se aplica sobre la lógica, no sobre el schema legacy.

## Data Flow

```
┌─────────────────────────────────────────────────────────────────────┐
│                        CLIENTE (React)                               │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌─────────────────────┐ │
│  │ Formulario│  │Panel     │  │Detalle   │  │Header: Período     │ │
│  │contable   │  │Períodos  │  │Período   │  │Activo              │ │
│  └────┬─────┘  └────┬─────┘  └────┬─────┘  └─────────────────────┘ │
│       │              │             │                                  │
│       ▼              ▼             ▼                                  │
│  Server Action   Server Action  Server Action                         │
│  (crear gasto)   (abrir período)(cerrar período)                      │
└───────┬──────────────┬──────────────┬─────────────────────────────────┘
        │              │              │
        ▼              ▼              ▼
┌───────────────────────────────────────────────────────────────────────┐
│                     WITHACTION WRAPPER                                  │
│  1. getCurrentUser()                                                    │
│  2. PeriodoGuard.assertWritable(fecha, tenantId, tipoOperacion) ◄──────┤
│     │                                                                   │
│     │  ┌─────────────────────────────────────────────┐                 │
│     │  │ PERIODO GUARD                                 │                 │
│     │  │ 1. Check feature flag (enforce/audit-only)   │                 │
│     │  │ 2. Convertir fecha a timezone del tenant      │                 │
│     │  │ 3. Buscar período activo (cache → DB)         │                 │
│     │  │ 4. Validar estado (ABIERTO/REABIERTO = OK)    │                 │
│     │  │ 5. Si cerrado → lanzar ActionError            │                 │
│     │  └─────────────────────────────────────────────┘                 │
│     │                                                                   │
│     ▼                                                                   │
│  3. Ejecutar lógica de negocio (si pasó el guard)                       │
│  4. Retornar { success, data } / { success: false, error }             │
└───────────────────────────────────────────────────────────────────────┘
        │
        ▼
┌───────────────────────────────────────────────────────────────────────┐
│                    PERIODO CONTABLE SERVICE                             │
│  - resolverPeriodoActivo(fecha, tenantId)                               │
│  - validarEscritura(fecha, tenantId, tipoOperacion)                     │
│  - abrirPeriodo(periodoId, actor)                                       │
│  - cerrarPeriodo(periodoId, actor) → SnapshotService.generarSnapshot()  │
│  - reabrirPeriodo(periodoId, actor, motivo)                             │
│  - aprobarPeriodo(periodoId, actor)                                     │
│  - obtenerTimeline(periodoId)                                           │
└───────────────────────────────────────────────────────────────────────┘
        │              │              │
        ▼              ▼              ▼
┌──────────────┐ ┌──────────────┐ ┌──────────────┐
│  Prisma DB   │ │  Snapshot    │ │  Auditoria   │
│  Periodo     │ │  Service     │ │  Periodo     │
│  Contable    │ │  (saldos)    │ │  (timeline)  │
└──────────────┘ └──────────────┘ └──────────────┘
```

### Flow: Cierre de Período

```
Usuario → UI "Cerrar Período" → confirmación
  → Server Action: cerrarPeriodoAction(periodoId)
    → withAction wrapper
      → PeriodoContableService.cerrarPeriodo(periodoId, actor)
        1. Validar transición (ABIERTO → EN_CIERRE)
        2. Si mensual/anual: validar hijos cerrados
        3. Cambiar estado a EN_CIERRE
        4. SnapshotService.generarSnapshot(periodoId)
           - Iterar CuentaBancaria del tenant
           - Crear SaldoSnapshot por cada cuenta
        5. Cambiar estado a CERRADO
        6. Registrar cerradoPor, cerradoAt
        7. PeriodoAuditService.registrar(CIERRE, ...)
        8. revalidatePath('/busy/contabilidad/periodos')
        9. Retornar { success: true, data: periodo }
```

## File Changes

| File | Action | Description |
|------|--------|-------------|
| `prisma/schema.prisma` | Modify | Agregar enums `TipoPeriodo`, `EstadoPeriodo` y modelos `PeriodoContable`, `SaldoSnapshot`, `AuditoriaPeriodo`. Agregar campo `contabilidadTimezone` a `Tenant`. |
| `src/lib/services/periodo-contable-types.ts` | Create | Tipos TypeScript, enums, interfaces, y error codes compartidos. |
| `src/lib/services/periodo-contable-service.ts` | Create | Lógica de dominio pura: CRUD, transiciones, resolución de períodos, validación de solapamiento. |
| `src/lib/services/periodo-contable-guard.ts` | Create | Orquestador de protección: `assertWritable`, feature flag, caché, integración con `withAction`. |
| `src/lib/services/periodo-snapshot-service.ts` | Create | Generación y verificación de snapshots de saldos bancarios. |
| `src/lib/services/periodo-audit-service.ts` | Create | Registro y consulta de auditoría de transiciones de período. |
| `src/lib/server-actions/with-action.ts` | Modify | Inyección opcional de `PeriodoGuard` en el wrapper existente. |
| `src/features/contabilidad/actions-periodos.ts` | Create | Server Actions para gestión de períodos (CRUD, apertura, cierre, reapertura, aprobación). |
| `src/features/contabilidad/components/periodos/periodo-list.tsx` | Create | Panel de lista de períodos con badges de estado y acciones. |
| `src/features/contabilidad/components/periodos/periodo-detail.tsx` | Create | Detalle de período con timeline de auditoría. |
| `src/features/contabilidad/components/periodos/reapertura-modal.tsx` | Create | Modal de motivo para reapertura. |
| `src/features/contabilidad/components/periodos/periodo-badge.tsx` | Create | Badge visual de estado con colores e íconos. |
| `src/features/contabilidad/components/periodo-activo-indicator.tsx` | Create | Indicador de período activo para header. |
| `src/app/busy/contabilidad/periodos/page.tsx` | Create | Ruta de gestión de períodos. |
| `src/lib/services/cierreContableService.ts` | Modify | Corregir bug tenantId: agregar parámetro `tenantId` y filtrar todas las queries. |
| `src/lib/services/__tests__/periodo-contable-service.test.ts` | Create | Tests unitarios del servicio de período. |
| `src/lib/services/__tests__/periodo-contable-guard.test.ts` | Create | Tests unitarios del guard. |
| `src/lib/services/__tests__/periodo-snapshot-service.test.ts` | Create | Tests unitarios del snapshot service. |
| `src/lib/services/__tests__/periodo-audit-service.test.ts` | Create | Tests unitarios del audit service. |
| `src/features/contabilidad/__tests__/actions-periodos.test.ts` | Create | Tests de integración de Server Actions de períodos. |

## Interfaces / Contracts

### Prisma Schema (exacto)

```prisma
// ── Enums ──────────────────────────────────────────────────────────────

enum TipoPeriodo {
  DIARIO
  MENSUAL
  ANUAL
}

enum EstadoPeriodo {
  BORRADOR
  ABIERTO
  EN_CIERRE
  CERRADO
  APROBADO
  REABIERTO
}

enum EventoAuditoria {
  APERTURA
  CIERRE
  REAPERTURA
  APROBACION
  BLOQUEO
  ERROR
  INTENTO_BYPASS
}

// ── Modelos ────────────────────────────────────────────────────────────

model PeriodoContable {
  periodoId        String          @id @default(cuid())
  tenantId         String
  tipo             TipoPeriodo
  fechaInicio      DateTime        // UTC
  fechaFin         DateTime        // UTC
  estado           EstadoPeriodo   @default(BORRADOR)
  motivoReapertura String?
  cerradoPor       String?         // userId
  cerradoAt        DateTime?
  aprobadoPor      String?         // userId
  aprobadoAt       DateTime?
  observaciones    String?
  createdAt        DateTime        @default(now())
  updatedAt        DateTime        @updatedAt

  // Relaciones
  tenant           Tenant          @relation(fields: [tenantId], references: [tenantId])
  snapshots        SaldoSnapshot[]
  auditoria        AuditoriaPeriodo[]

  // Índices
  @@unique([tenantId, tipo, fechaInicio, fechaFin])
  @@index([tenantId, estado])
  @@index([tenantId, fechaInicio, fechaFin])
  @@index([tenantId, tipo, fechaInicio, fechaFin])
}

model SaldoSnapshot {
  snapshotId       String          @id @default(cuid())
  periodoId        String
  cuentaBancariaId String
  saldo            Float           // Valor en el momento del cierre
  moneda           String          // ARS, USD, etc.
  metadata         Json?           // Datos adicionales del snapshot
  createdAt        DateTime        @default(now())

  periodo          PeriodoContable @relation(fields: [periodoId], references: [periodoId], onDelete: Cascade)

  @@index([periodoId])
  @@index([cuentaBancariaId])
}

model AuditoriaPeriodo {
  auditoriaId      String          @id @default(cuid())
  tenantId         String
  periodoId        String
  evento           EventoAuditoria
  actor            String          // userId o 'system'
  timestamp        DateTime        @default(now())
  entidadAfectada  String?         // tipo de entidad afectada
  motivo           String?
  payload          Json?           // Contexto adicional de la transición
  createdAt        DateTime        @default(now())

  periodo          PeriodoContable @relation(fields: [periodoId], references: [periodoId], onDelete: Cascade)
  tenant           Tenant          @relation(fields: [tenantId], references: [tenantId])

  @@index([periodoId])
  @@index([tenantId, timestamp])
  @@index([evento])
}
```

### Tenant modification

```prisma
// Agregar al modelo Tenant existente:
model Tenant {
  // ... campos existentes ...
  contabilidadTimezone String @default("America/Argentina/Buenos_Aires")

  // Relaciones nuevas:
  periodosContables  PeriodoContable[]
  auditoriaPeriodos  AuditoriaPeriodo[]
}
```

### TypeScript Types

```typescript
// src/lib/services/periodo-contable-types.ts

export enum TipoPeriodo {
  DIARIO = 'DIARIO',
  MENSUAL = 'MENSUAL',
  ANUAL = 'ANUAL',
}

export enum EstadoPeriodo {
  BORRADOR = 'BORRADOR',
  ABIERTO = 'ABIERTO',
  EN_CIERRE = 'EN_CIERRE',
  CERRADO = 'CERRADO',
  APROBADO = 'APROBADO',
  REABIERTO = 'REABIERTO',
}

export enum EventoAuditoria {
  APERTURA = 'APERTURA',
  CIERRE = 'CIERRE',
  REAPERTURA = 'REAPERTURA',
  APROBACION = 'APROBACION',
  BLOQUEO = 'BLOQUEO',
  ERROR = 'ERROR',
  INTENTO_BYPASS = 'INTENTO_BYPASS',
}

// Estados que permiten escritura contable
export const WRITABLE_STATES: EstadoPeriodo[] = [
  EstadoPeriodo.ABIERTO,
  EstadoPeriodo.REABIERTO,
];

// Transiciones válidas de estado
export const VALID_TRANSITIONS: Record<EstadoPeriodo, EstadoPeriodo[]> = {
  BORRADOR: [EstadoPeriodo.ABIERTO],
  ABIERTO: [EstadoPeriodo.EN_CIERRE],
  EN_CIERRE: [EstadoPeriodo.CERRADO],
  CERRADO: [EstadoPeriodo.APROBADO],
  APROBADO: [EstadoPeriodo.REABIERTO],
  REABIERTO: [EstadoPeriodo.EN_CIERRE, EstadoPeriodo.ABIERTO],
};

// Error codes del guard
export type PeriodoErrorCode =
  | 'PERIODO_CERRADO'
  | 'PERIODO_APROBADO'
  | 'PERIODO_EN_CIERRE'
  | 'PERIODO_NO_EXISTE'
  | 'PERIODO_SOLAPADO'
  | 'PERIODO_YA_ABIERTO'
  | 'TRANSICION_INVALIDA'
  | 'MOTIVO_REAPERTURA_REQUERIDO'
  | 'HIJOS_ABIERTOS'
  | 'GUARD_DISABLED';

export interface PeriodoError extends Error {
  code: PeriodoErrorCode;
  periodo?: PeriodoContableResumen;
}

export interface PeriodoContableResumen {
  periodoId: string;
  tipo: TipoPeriodo;
  estado: EstadoPeriodo;
  fechaInicio: Date;
  fechaFin: Date;
  label: string; // ej: "Marzo 2026"
}

export interface GuardConfig {
  enabled: boolean;
  mode: 'enforce' | 'audit-only';
}

export interface SnapshotTotales {
  totalCuentas: number;
  totalSaldos: Record<string, number>; // moneda → saldo total
  cuentas: {
    cuentaBancariaId: string;
    nombreBanco: string;
    numeroCuenta: string;
    saldo: number;
    moneda: string;
  }[];
}

export interface AuditEntry {
  auditoriaId: string;
  evento: EventoAuditoria;
  actor: string;
  timestamp: Date;
  motivo?: string;
  payload?: Record<string, unknown>;
  entidadAfectada?: string;
}

export interface ResolverPeriodoResult {
  periodo: PeriodoContableResumen | null;
  estado: EstadoPeriodo | 'NO_EXISTE';
  esWritable: boolean;
}
```

### Service Interfaces

```typescript
// src/lib/services/periodo-contable-service.ts

export class PeriodoContableService {
  /**
   * Resuelve el período activo para una fecha y tenant dados.
   * Busca en orden: DIARIO → MENSUAL → ANUAL.
   */
  static async resolverPeriodoActivo(
    fecha: Date,
    tenantId: string,
    tipo?: TipoPeriodo
  ): Promise<ResolverPeriodoResult>;

  /**
   * Valida si una fecha permite escritura contable.
   * Retorna void si pasa, lanza PeriodoError si no.
   */
  static async validarEscritura(
    fecha: Date,
    tenantId: string,
    tipoOperacion?: 'caja' | 'devengo'
  ): Promise<void>;

  /**
   * Crea un nuevo período con validación de solapamiento.
   */
  static async abrirPeriodo(
    tenantId: string,
    tipo: TipoPeriodo,
    fechaInicio: Date,
    fechaFin: Date,
    actor: string
  ): Promise<PeriodoContable>;

  /**
   * Inicia el cierre de un período (ABIERTO → EN_CIERRE → CERRADO).
   * Genera snapshot automáticamente.
   */
  static async cerrarPeriodo(
    periodoId: string,
    actor: string
  ): Promise<PeriodoContable>;

  /**
   * Reabre un período APROBADO. Requiere motivo.
   */
  static async reabrirPeriodo(
    periodoId: string,
    actor: string,
    motivo: string
  ): Promise<PeriodoContable>;

  /**
   * Aprueba un período CERRADO.
   */
  static async aprobarPeriodo(
    periodoId: string,
    actor: string
  ): Promise<PeriodoContable>;

  /**
   * Obtiene el timeline de auditoría de un período.
   */
  static async obtenerTimeline(
    periodoId: string
  ): Promise<AuditEntry[]>;

  /**
   * Valida que una transición de estado sea válida.
   */
  static validarTransicion(
    estadoActual: EstadoPeriodo,
    estadoNuevo: EstadoPeriodo
  ): boolean;

  /**
   * Verifica solapamiento de fechas para un tenant y tipo.
   */
  static async verificarSolapamiento(
    tenantId: string,
    tipo: TipoPeriodo,
    fechaInicio: Date,
    fechaFin: Date,
    excludePeriodoId?: string
  ): Promise<boolean>;
}
```

```typescript
// src/lib/services/periodo-contable-guard.ts

export class PeriodoGuard {
  /**
   * Punto de entrada principal. Valida que una fecha permita escritura.
   * Se llama desde withAction wrapper o middleware de API Routes.
   *
   * @throws {ActionError} Si el período no es writable (modo enforce)
   */
  static async assertWritable(
    fecha: Date,
    tenantId: string,
    tipoOperacion?: 'caja' | 'devengo'
  ): Promise<void>;

  /**
   * Versión que retorna resultado sin lanzar error (para audit-only).
   */
  static async checkWritable(
    fecha: Date,
    tenantId: string,
    tipoOperacion?: 'caja' | 'devengo'
  ): Promise<{ passed: boolean; error?: PeriodoError }>;

  /**
   * Lee la configuración del feature flag.
   */
  static getConfig(): GuardConfig;

  /**
   * Invalida el caché de períodos para un tenant.
   * Se llama después de apertura/cierre/reapertura.
   */
  static invalidateCache(tenantId: string): void;
}
```

```typescript
// src/lib/services/periodo-snapshot-service.ts

export class SnapshotService {
  /**
   * Genera snapshots de saldos para todas las cuentas bancarias del tenant.
   */
  static async generarSnapshot(
    periodoId: string
  ): Promise<SnapshotTotales>;

  /**
   * Verifica la integridad de los snapshots de un período.
   */
  static async verificarIntegridad(
    periodoId: string
  ): Promise<{ valida: boolean; inconsistencias: string[] }>;
}
```

```typescript
// src/lib/services/periodo-audit-service.ts

export class PeriodoAuditService {
  /**
   * Registra un evento de auditoría.
   */
  static async registrar(
    periodoId: string,
    tenantId: string,
    evento: EventoAuditoria,
    actor: string,
    options?: {
      motivo?: string;
      entidadAfectada?: string;
      payload?: Record<string, unknown>;
    }
  ): Promise<void>;

  /**
   * Obtiene el historial completo de un período.
   */
  static async obtenerHistorial(
    periodoId: string
  ): Promise<AuditEntry[]>;
}
```

### Integration with withAction

```typescript
// src/lib/server-actions/with-action.ts (modificación)

import { PeriodoGuard } from '@/lib/services/periodo-contable-guard';

export function withAction<TInput, TOutput>(
  action: (input: TInput, user: AuthenticatedUser) => Promise<TOutput>
): ServerAction<TInput, TOutput> {
  return async (input: TInput): Promise<ActionResponse<TOutput>> => {
    try {
      const user = await getCurrentUser();
      if (!user) {
        return { success: false, error: { message: 'Unauthorized', code: 'AUTH_REQUIRED' } };
      }

      // ── PeriodoGuard: interceptar escrituras contables ──
      // Se aplica solo si el input tiene forma de fecha o la action está marcada.
      // La extracción de fecha se hace por convención: el campo 'fecha' o 'fechaCompra' etc.
      const fechaNegocio = extraerFechaNegocio(input);
      if (fechaNegocio && user.tenantId) {
        await PeriodoGuard.assertWritable(fechaNegocio, user.tenantId);
      }

      const data = await action(input, user);
      return { success: true, data: serializePrismaData(data) };
    } catch (error) {
      // ... existing error handling ...
    }
  };
}

/**
 * Extrae la fecha de negocio del input de una Server Action.
 * Busca campos conocidos por convención.
 */
function extraerFechaNegocio(input: unknown): Date | null {
  if (!input || typeof input !== 'object') return null;
  const obj = input as Record<string, unknown>;

  // Prioridad: fecha explícita de negocio > fechaReconciliacion > createdAt
  const fechaFields = ['fecha', 'fechaCompra', 'fechaServicio', 'fechaReconciliacion', 'fechaTransferencia', 'fechaPago'];
  for (const field of fechaFields) {
    const val = obj[field];
    if (val && typeof val === 'string') {
      const parsed = new Date(val);
      if (!isNaN(parsed.getTime())) return parsed;
    }
    if (val instanceof Date) return val;
  }
  return null;
}
```

### Server Actions de Períodos

```typescript
// src/features/contabilidad/actions-periodos.ts

'use server';

import { z } from 'zod';
import { revalidatePath } from 'next/cache';
import { withAction, ActionError } from '@/lib/server-actions';
import { requireTenant } from '@/lib/services/tenant-scope';
import type { AuthenticatedUser } from '@/lib/auth-middleware';
import { PeriodoContableService } from '@/lib/services/periodo-contable-service';
import { PeriodoAuditService } from '@/lib/services/periodo-audit-service';
import { TipoPeriodo, EstadoPeriodo } from '@/lib/services/periodo-contable-types';

// ── Schemas ─────────────────────────────────────────────────────────────

const abrirPeriodoSchema = z.object({
  tipo: z.nativeEnum(TipoPeriodo),
  fechaInicio: z.string().datetime(),
  fechaFin: z.string().datetime(),
});

const cerrarPeriodoSchema = z.object({
  periodoId: z.string().min(1),
});

const reabrirPeriodoSchema = z.object({
  periodoId: z.string().min(1),
  motivo: z.string().min(1, 'El motivo es obligatorio'),
});

// ── Queries ─────────────────────────────────────────────────────────────

export const getPeriodosAction = withAction(async (
  input: { tipo?: TipoPeriodo; estado?: EstadoPeriodo; page?: number; limit?: number },
  user: AuthenticatedUser
) => {
  const tenantId = requireTenant(user);
  const { tipo, estado, page = 1, limit = 50 } = input;

  const where: Record<string, unknown> = { tenantId };
  if (tipo) where.tipo = tipo;
  if (estado) where.estado = estado;

  const [periodos, total] = await Promise.all([
    prisma.periodoContable.findMany({
      where,
      orderBy: [{ fechaInicio: 'desc' }],
      skip: (page - 1) * limit,
      take: limit,
      include: { snapshots: { select: { snapshotId: true, moneda: true, saldo: true } } },
    }),
    prisma.periodoContable.count({ where }),
  ]);

  return { periodos, total, page, limit };
});

export const getPeriodoDetailAction = withAction(async (
  periodoId: string,
  user: AuthenticatedUser
) => {
  const tenantId = requireTenant(user);
  const periodo = await prisma.periodoContable.findFirst({
    where: { periodoId, tenantId },
    include: {
      snapshots: { orderBy: { createdAt: 'desc' } },
      auditoria: { orderBy: { timestamp: 'desc' } },
    },
  });
  if (!periodo) throw new ActionError('Período no encontrado', 'NOT_FOUND');
  return periodo;
});

// ── Mutations ───────────────────────────────────────────────────────────

export const abrirPeriodoAction = withAction(async (
  input: z.infer<typeof abrirPeriodoSchema>,
  user: AuthenticatedUser
) => {
  const tenantId = requireTenant(user);
  const parsed = abrirPeriodoSchema.parse(input);

  const periodo = await PeriodoContableService.abrirPeriodo(
    tenantId,
    parsed.tipo,
    new Date(parsed.fechaInicio),
    new Date(parsed.fechaFin),
    user.userId
  );

  revalidatePath('/busy/contabilidad/periodos');
  return { periodo };
});

export const cerrarPeriodoAction = withAction(async (
  input: z.infer<typeof cerrarPeriodoSchema>,
  user: AuthenticatedUser
) => {
  const tenantId = requireTenant(user);
  const parsed = cerrarPeriodoSchema.parse(input);

  // Verificar ownership
  const periodo = await prisma.periodoContable.findFirst({
    where: { periodoId: parsed.periodoId, tenantId },
  });
  if (!periodo) throw new ActionError('Período no encontrado', 'NOT_FOUND');

  const resultado = await PeriodoContableService.cerrarPeriodo(
    parsed.periodoId,
    user.userId
  );

  revalidatePath('/busy/contabilidad/periodos');
  return { periodo: resultado };
});

export const aprobarPeriodoAction = withAction(async (
  input: z.infer<typeof cerrarPeriodoSchema>,
  user: AuthenticatedUser
) => {
  const tenantId = requireTenant(user);
  const parsed = cerrarPeriodoSchema.parse(input);

  const periodo = await prisma.periodoContable.findFirst({
    where: { periodoId: parsed.periodoId, tenantId },
  });
  if (!periodo) throw new ActionError('Período no encontrado', 'NOT_FOUND');

  const resultado = await PeriodoContableService.aprobarPeriodo(
    parsed.periodoId,
    user.userId
  );

  revalidatePath('/busy/contabilidad/periodos');
  return { periodo: resultado };
});

export const reabrirPeriodoAction = withAction(async (
  input: z.infer<typeof reabrirPeriodoSchema>,
  user: AuthenticatedUser
) => {
  const tenantId = requireTenant(user);
  const parsed = reabrirPeriodoSchema.parse(input);

  const periodo = await prisma.periodoContable.findFirst({
    where: { periodoId: parsed.periodoId, tenantId },
  });
  if (!periodo) throw new ActionError('Período no encontrado', 'NOT_FOUND');

  const resultado = await PeriodoContableService.reabrirPeriodo(
    parsed.periodoId,
    user.userId,
    parsed.motivo
  );

  revalidatePath('/busy/contabilidad/periodos');
  return { periodo: resultado };
});
```

## Testing Strategy

| Layer | What to Test | Approach |
|-------|-------------|----------|
| Unit | `PeriodoContableService` — transiciones de estado, solapamiento, resolución de período | Vitest con mocks de Prisma. Cada transición válida e inválida. Solapamiento con casos edge (mismo día, adyacente, parcial). |
| Unit | `PeriodoGuard` — feature flag, caché, assertWritable | Vitest. Mockear `PeriodoContableService.resolverPeriodoActivo`. Testear enforce vs audit-only vs disabled. Caché hit/miss/expired. |
| Unit | `SnapshotService` — generación de snapshots, verificación de integridad | Vitest con Prisma mock. Testear múltiples cuentas, múltiples monedas, cuentas con saldo 0. |
| Unit | `PeriodoAuditService` — registro y consulta de auditoría | Vitest. Verificar que toda transición genera entry. Timeline ordenado. |
| Unit | `extraerFechaNegocio` — extracción de fecha de inputs variados | Vitest. Testear cada campo conocido, objetos sin fecha, inputs no-objetos. |
| Integration | Server Actions de períodos — CRUD, apertura, cierre, reapertura | Vitest + `@testing-library/react` server test helpers. Verificar revalidatePath, rethrow de errores, retorno de datos. |
| Integration | Guard en Server Actions existentes — rechazar escritura en período cerrado | Vitest. Invocar actions de contabilidad con fecha en período cerrado. Verificar `{ success: false, error: { code: 'PERIODO_CERRADO' } }`. |
| Integration | `calcularEstadisticasCierre` con tenantId — corregir bug multi-tenant | Vitest. Crear datos de 2 tenants, verificar que estadísticas solo incluyen datos del tenant correcto. |
| E2E | UI de períodos — lista, filtros, acciones, modal de reapertura | Playwright. Navegar a `/busy/contabilidad/periodos`, verificar badges, abrir/cerrar/reabrir, validar motivo obligatorio. |

## Migration / Rollout

### Phase 1: Schema + Servicios (sin impacto)

1. Agregar enums y modelos a `prisma/schema.prisma`
2. Agregar campo `contabilidadTimezone` a `Tenant`
3. Ejecutar `pnpm prisma migrate dev --name add-periodo-contable`
4. Crear los 4 servicios (`periodo-contable-service`, `periodo-contable-guard`, `periodo-snapshot-service`, `periodo-audit-service`)
5. Crear tipos compartidos (`periodo-contable-types.ts`)
6. Tests unitarios de todos los servicios

### Phase 2: Guard en Server Actions (detrás de feature flag)

1. Modificar `with-action.ts` para inyectar `PeriodoGuard.assertWritable()`
2. Setear `PERIODO_GUARD_MODE=audit-only` en `.env.local` — loguea violaciones sin bloquear
3. Ejecutar flujos existentes y revisar logs para identificar bypasses
4. Cambiar a `PERIODO_GUARD_MODE=enforce` en local, verificar que bloquea correctamente
5. Tests de integración de guard en actions

### Phase 3: Corrección de Bug + Cierre Contable

1. Modificar `calcularEstadisticasCierre` para recibir y filtrar por `tenantId`
2. Modificar `crearCierreContable` para pasar `tenantId` al cálculo
3. Enganchar `PeriodoGuard` en `actions-cierres.ts`
4. Tests del bug corregido

### Phase 4: UI de Gestión de Períodos

1. Crear componentes: `periodo-list`, `periodo-detail`, `reapertura-modal`, `periodo-badge`
2. Crear ruta `/busy/contabilidad/periodos`
3. Crear indicador de período activo para header
4. Crear Server Actions de períodos (`actions-periodos.ts`)
5. Tests E2E con Playwright

### Phase 5: Activación en Staging → Producción

1. Deploy a staging con `PERIODO_GUARD_MODE=enforce`
2. Validar flujos completos: crear período, abrir, cerrar, aprobar, reaperturar
3. Verificar que todas las escrituras contables son rechazadas en períodos cerrados
4. Activar en producción con `PERIODO_GUARD_MODE=enforce`
5. Monitorear logs durante 48 horas

### Phase 6: Deprecación Legacy (futuro)

1. Marcar handlers legacy con `@deprecated`
2. Loguear uso de handlers legacy para tracking
3. Planificar migración de campos string `periodo` a `PeriodoContable`
4. Eliminar handlers legacy en cambio separado

### Rollback

- **Schema**: Migration aditiva. `prisma migrate down` es seguro.
- **Guard**: `PERIODO_GUARD_MODE=audit-only` o `PERIODO_GUARD_ENABLED=false` desactiva sin redeploy.
- **UI**: Ruta nueva, no modifica existentes. Ocultar con feature flag si necesario.
- **Services**: No se importan en código existente hasta Phase 2. Sin impacto si no se enganchan.

## Open Questions

- [ ] **Cache distribuido**: Si la app corre en múltiples instancias de Vercel (serverless), el Map en memoria no se comparte entre instancias. ¿Es aceptable que cada instancia tenga su propio caché? (Respuesta provisional: sí, el TTL de 5 min es suficiente y la query es barata con índices).
- [ ] **Auto-creación de períodos**: Cuando una escritura llega a una fecha sin período, ¿se crea automáticamente en `BORRADOR` y se abre, o se rechaza? Las specs dicen "rechazar con `PERIODO_NO_EXISTE`", pero esto requiere que el usuario cree períodos manualmente primero. Se recomienda rechazar inicialmente y agregar auto-creación como feature futura.
- [ ] **Período activo por defecto**: Al activar el guard en producción, ¿se crea automáticamente un período mensual para el mes actual en estado `ABIERTO` para todos los tenants existentes? Esto evita bloquear operaciones legítimas el día del deploy.
- [ ] **Notificaciones de reapertura**: Las specs mencionan "notificación al admin" en reapertura. ¿Se usa el sistema de `Notification` existente o se envía por email? Se recomienda `Notification` existente para consistencia.
