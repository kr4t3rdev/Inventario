# Design: Anticipos de Pago y Cobro en Contabilidad

## Technical Approach

Se implementará un subdominio de anticipos dentro de contabilidad que permita:

- Registrar anticipos de pago (egreso reservado a proveedor) y cobro (ingreso reservado de cliente).
- Exponer anticipos elegibles como forma de pago en compra y facturación.
- Ejecutar anticipos de forma atómica, idempotente y trazable.
- Integrar la ejecución con los workflows existentes de reconciliación (`pago-gastos-workflow` y `facturacion-ventas-workflow`).
- Soportar reversión contable obligatoria para anulaciones de documentos reconciliados.

La estrategia reutiliza patrones ya presentes en el proyecto:

- API Routes con `withAuth*` y validación con Zod.
- Operaciones críticas en `prisma.$transaction`.
- Servicios de dominio en `src/lib/services/*workflow.ts`.
- RTK Query para contratos frontend-backend.

## Architecture Decisions

### Decision: Persistir anticipos en tablas dedicadas

**Choice**: Agregar entidades dedicadas `Anticipo` y `AnticipoMovimiento`.
**Alternatives considered**:

- Reusar `CuentaPorPagar`/`CuentaPorCobrar`.
- Reusar `ReconciliacionVenta`/`ReconciliacionGasto` como origen del anticipo.

**Rationale**: Anticipo tiene ciclo de vida propio (reserva, ejecución, reverso, anulación) y requiere ledger independiente antes de reconciliar. Reusar CxP/CxC mezclaría deuda con fondos reservados y complica trazabilidad.

### Decision: Máquina de estados estricta con invariantes de saldo

**Choice**: Estados explícitos `RESERVADO | EJECUTADO | ANULADO`, con `saldoDisponible` y transición validada.
**Alternatives considered**:

- Estado derivado solo por saldo.
- Modelo sin estados y con flags.

**Rationale**: La spec exige bloqueo por elegibilidad y auditoría. Un estado explícito simplifica validaciones de negocio y consultas de UI.

### Decision: Ejecución mediante servicio transaccional unificado

**Choice**: Crear `anticipos-workflow.ts` para ejecutar anticipo y delegar reconciliación al workflow existente según contexto (compra o venta).
**Alternatives considered**:

- Implementar lógica en cada API route.
- Duplicar lógica de reconciliación en rutas de compras/ventas/ofertas.

**Rationale**: Mantiene una única fuente de verdad para concurrencia, idempotencia y validación de elegibilidad.

### Decision: Idempotencia por clave de operación reutilizando infraestructura actual

**Choice**: Requerir `idempotencyKey` en ejecución y usar `getIdempotentResult/setIdempotentResult` de `src/lib/idempotency.ts`.
**Alternatives considered**:

- Idempotencia solo por constraints SQL.
- Sin idempotencia y confiar en reintentos del cliente.

**Rationale**: Ya existe utilidad de idempotencia en el proyecto y cubre reintentos de red sin duplicar reconciliaciones.

### Decision: Control de concurrencia con locking transaccional

**Choice**: Bloquear fila de anticipo en ejecución con operación transaccional (lectura + update condicional por estado/saldo).
**Alternatives considered**:

- Optimistic lock sin condición de estado/saldo.
- Mutex en memoria de aplicación.

**Rationale**: La concurrencia debe resolverse en BD para múltiples instancias del servidor y evitar doble ejecución.

### Decision: Conversión de moneda con tasa vigente auditable

**Choice**: Si moneda difiere, exigir tasa vigente por fecha y registrar `tasaAplicada` y `montoConvertido` en movimiento/reconciliación.
**Alternatives considered**:

- Conversión implícita con tasa por defecto 1.
- Permitir ejecución sin tasa explícita.

**Rationale**: La spec exige bloqueo en ausencia de tasa válida y trazabilidad de la conversión.

### Decision: Reversión obligatoria como operación explícita

**Choice**: Exponer endpoint de reversión que recompone saldo/estado del anticipo y registra movimiento `REVERSO`.
**Alternatives considered**:

- Reversión implícita al anular factura/compra.
- Permitir anulación directa con compensación posterior.

**Rationale**: Reduce inconsistencias contables y aplica la regla de integridad previa a anulación.

## Data Flow

### Flujo A: Pago anticipado en compra (producto/servicio)

```text
UI Compra
  └─ selecciona formaPago=ANTICIPO_PAGO + anticipoId
       └─ POST /api/compras-productos
            └─ anticipos-workflow.execute({
                 tipo: PAGO,
                 contexto: COMPRA,
                 anticipoId,
                 documentoDestinoId,
                 idempotencyKey
               })
                 ├─ valida elegibilidad (proveedor, estado, saldo, moneda, vigencia)
                 ├─ lock transaccional del anticipo
                 ├─ descuenta saldo y transiciona estado
                 ├─ applyPagoGastoWorkflow(...)
                 ├─ registra AnticipoMovimiento(EJECUCION)
                 └─ devuelve resultado idempotente
```

### Flujo B: Cobro anticipado en oferta aceptada o factura directa

```text
UI Oferta/Factura
  └─ selecciona formaPago=ANTICIPO_COBRO + anticipoId
       └─ POST /api/ofertas/{id}/facturar o POST /api/ventas
            └─ crear factura
            └─ anticipos-workflow.execute({
                 tipo: COBRO,
                 contexto: FACTURA_VENTA,
                 anticipoId,
                 facturaId,
                 ventaId,
                 idempotencyKey
               })
                 ├─ valida elegibilidad (cliente, estado, saldo, moneda)
                 ├─ lock transaccional del anticipo
                 ├─ descuenta saldo y transiciona estado
                 ├─ applyFacturacionCobroWorkflow(...)
                 ├─ registra AnticipoMovimiento(EJECUCION)
                 └─ devuelve reconciliación de venta
```

### Flujo C: Reversión por anulación

```text
UI Anulación
  └─ POST /api/contabilidad/anticipos/{id}/revertir
       ├─ valida que exista documento reconciliado
       ├─ revierte reconciliación/impacto financiero según tipo
       ├─ recompone saldo y estado del anticipo
       └─ registra AnticipoMovimiento(REVERSO)
```

## File Changes

| File | Action | Description |
| ---- | ------ | ----------- |
| `prisma/schema.prisma` | Modify | Agregar modelos `Anticipo` y `AnticipoMovimiento`, enums de estado/tipo/contexto y relaciones con `Contrato`, `Vendor`, `Cliente`, `Factura`, `CompraProducto` |
| `src/lib/services/anticipos-workflow.ts` | Create | Servicio de dominio para crear, ejecutar, validar elegibilidad, aplicar idempotencia y reversión |
| `src/lib/services/anticipos-workflow.types.ts` | Create | Tipos de entrada/salida del workflow y errores de negocio |
| `src/app/api/contabilidad/anticipos/route.ts` | Create | GET listado filtrado y POST creación de anticipos de pago/cobro |
| `src/app/api/contabilidad/anticipos/disponibles/route.ts` | Create | GET anticipos elegibles por contexto (`compra`, `factura`) y contraparte |
| `src/app/api/contabilidad/anticipos/[id]/ejecutar/route.ts` | Create | POST ejecución explícita con `idempotencyKey` |
| `src/app/api/contabilidad/anticipos/[id]/revertir/route.ts` | Create | POST reversión contable y restauración de saldo/estado |
| `src/app/api/compras-productos/route.ts` | Modify | Soportar forma de pago con anticipo y delegar ejecución al workflow |
| `src/app/api/ventas/route.ts` | Modify | Aceptar selección de cobro anticipado en ventas facturadas |
| `src/app/api/ofertas/[id]/facturar/route.ts` | Modify | Aceptar `anticipoCobroId`/`idempotencyKey` y ejecutar anticipo al crear factura |
| `src/lib/services/facturacion-ventas-workflow.ts` | Modify | Añadir branch de cobro por anticipo manteniendo CxC/reconciliación |
| `src/lib/services/pago-gastos-workflow.ts` | Modify | Exponer integración para ejecución desde anticipo en compras |
| `src/lib/redux/services/comprasProductosApi.tsx` | Modify | Extender contrato de request para forma de pago con anticipo |
| `src/lib/redux/services/ofertasApi.tsx` | Modify | Extender `facturarOferta` con `cuentaBancariaId`, `anticipoCobroId` e `idempotencyKey` |
| `src/lib/redux/services/contabilidadApi.tsx` | Modify | Agregar endpoints de anticipos (crear/listar/disponibles/ejecutar/revertir) |
| `src/components/compras/compra-producto-form.tsx` | Modify | Mostrar `Pago anticipado`, selector de anticipo elegible y validaciones de cobertura |
| `src/components/ofertas/oferta-form.tsx` | Modify | Permitir seleccionar cobro anticipado al facturar |
| `src/components/ventas/pv-interface.tsx` | Modify | Exponer cobro anticipado en factura directa de venta |
| `src/app/models/model.ts` | Modify | Añadir interfaces `Anticipo`, `AnticipoMovimiento`, requests/responses y enums |
| `src/lib/services/__tests__/facturacion-ventas-workflow.test.ts` | Modify | Casos de cobro anticipado, idempotencia y moneda |
| `src/lib/services/__tests__/pago-gastos-workflow.test.ts` | Modify | Casos de pago anticipado y no duplicidad de reconciliación |
| `src/app/api/contabilidad/anticipos/__tests__/route.test.ts` | Create | Cobertura de creación/listado/validaciones |
| `src/app/api/contabilidad/anticipos/[id]/ejecutar/__tests__/route.test.ts` | Create | Concurrencia, idempotencia y elegibilidad |
| `src/app/api/contabilidad/anticipos/[id]/revertir/__tests__/route.test.ts` | Create | Reversión obligatoria y restauración de saldo |

## Interfaces / Contracts

### Prisma (resumen de contrato)

```prisma
enum TipoAnticipo {
  PAGO
  COBRO
}

enum EstadoAnticipo {
  RESERVADO
  EJECUTADO
  ANULADO
}

enum ContextoAnticipo {
  COMPRA_PRODUCTO
  COMPRA_SERVICIO
  FACTURA_OFERTA
  FACTURA_DIRECTA
}

model Anticipo {
  anticipoId          String         @id @default(cuid())
  tipo                TipoAnticipo
  estado              EstadoAnticipo @default(RESERVADO)
  montoOriginal       Decimal
  saldoDisponible     Decimal
  moneda              String
  contratoId          String
  proveedorId         String?
  clienteId           String?
  cuentaOrigenId      String?
  tipoPagoOrigenId    String?
  referenciaExterna   String?
  fechaReserva        DateTime       @default(now())
  fechaEjecucion      DateTime?
  createdById         String
  createdAt           DateTime       @default(now())
  updatedAt           DateTime       @updatedAt
  movimientos         AnticipoMovimiento[]
}

model AnticipoMovimiento {
  movimientoId        String          @id @default(cuid())
  anticipoId          String
  tipoMovimiento      String
  contexto            ContextoAnticipo?
  documentoDestinoId  String?
  monto               Decimal
  moneda              String
  tasaAplicada        Decimal?
  montoConvertido     Decimal?
  saldoAntes          Decimal
  saldoDespues        Decimal
  usuarioId           String
  idempotencyKey      String?
  createdAt           DateTime        @default(now())
  anticipo            Anticipo        @relation(fields: [anticipoId], references: [anticipoId], onDelete: Cascade)

  @@index([anticipoId, createdAt])
  @@unique([anticipoId, idempotencyKey])
}
```

### API de creación de anticipo

```typescript
type CreateAnticipoRequest = {
  tipo: 'PAGO' | 'COBRO'
  contratoId: string
  proveedorId?: string
  clienteId?: string
  monto: number
  moneda: string
  cuentaOrigenId?: string
  tipoPagoOrigenId?: string
  referenciaExterna?: string
}
```

### API de ejecución de anticipo

```typescript
type ExecuteAnticipoRequest = {
  anticipoId: string
  contexto: 'COMPRA_PRODUCTO' | 'COMPRA_SERVICIO' | 'FACTURA_OFERTA' | 'FACTURA_DIRECTA'
  documentoDestinoId: string
  montoObjetivo: number
  monedaObjetivo: string
  idempotencyKey: string
  observaciones?: string
}
```

### Respuesta de ejecución

```typescript
type ExecuteAnticipoResponse = {
  anticipoId: string
  estado: 'RESERVADO' | 'EJECUTADO' | 'ANULADO'
  saldoDisponible: number
  reconciliacionId?: string
  movimientoId: string
  idempotentReplay: boolean
}
```

## Testing Strategy

| Layer | What to Test | Approach |
| ----- | ------------ | -------- |
| Unit | Máquina de estados y elegibilidad | Tests de funciones puras de validación (estado/saldo/contraparte/moneda/vigencia) |
| Unit | Idempotencia | Simular reintentos con misma clave y payload distinto |
| Integration | APIs de anticipos | Vitest sobre routes: creación, listado, disponibles, ejecución y reversión |
| Integration | Concurrencia | Dos ejecuciones simultáneas del mismo anticipo; solo una debe aplicar |
| Integration | Integración con workflows existentes | Verificar creación única de reconciliación y actualización de saldos |
| E2E | Flujo compra con pago anticipado | Crear anticipo, usarlo en compra, confirmar estado y reconciliación |
| E2E | Flujo oferta/factura con cobro anticipado | Crear cobro, facturar oferta/factura directa, validar pago y trazabilidad |
| Regression | Flujos actuales sin anticipo | Pago completo/parcial y cobro contra pago deben seguir funcionando |

## Migration / Rollout

1. Aplicar migración Prisma para nuevas tablas/enums e índices de idempotencia.
2. Publicar backend de anticipos detrás de flag `ENABLE_ANTICIPOS`.
3. Habilitar UI progresivamente:
   - Etapa 1: creación/listado de anticipos.
   - Etapa 2: selección en compras.
   - Etapa 3: selección en facturación de oferta/directa.
4. Monitorear métricas:
   - ejecuciones exitosas,
   - conflictos de concurrencia,
   - repeticiones idempotentes,
   - reversos.

No se requiere migración de datos históricos para lanzar la primera versión.

## Open Questions

- [ ] Definir si se permite ejecución parcial de anticipo en fase posterior o queda prohibida por diseño inicial.
- [ ] Confirmar política de vigencia del anticipo (sin expiración, por fecha fija o por contrato).
- [ ] Definir nomenclatura final de forma de pago en UI (`ANTICIPO_PAGO`/`ANTICIPO_COBRO` vs `PAGO_ANTICIPADO`/`COBRO_ANTICIPADO`).
