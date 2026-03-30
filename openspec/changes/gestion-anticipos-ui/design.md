# Design: Gestión de Anticipos UI y Funcionalidades Avanzadas

## Technical Approach

El objetivo es agregar una interfaz de usuario completa para gestionar anticipos en el módulo de Contabilidad, además de habilitar la ejecución parcial. Se reutilizará la infraestructura existente de anticipos, API y Redux.

## Architecture Decisions

### Decision: Estructura de Página de Anticipos

**Choice**: Crear página en `/busy/contabilidad/anticipos` con componentes embebidos
**Alternatives considered**: Crear route dinámico en `/contabilidad/[seccion]/anticipos`
**Rationale**: Sigue el patrón existente del proyecto (páginas en `/busy/`), más consistente con el menú actual

### Decision: Ejecución Parcial

**Choice**: Modificar el workflow existente para aceptar ejecución parcial, con flag opcional
**Alternatives considered**: Crear nuevo endpoint separado para ejecución parcial
**Rationale**: Mantiene la lógica centralizada y evita duplicación de código

### Decision: Reportes

**Choice**: Endpoints de agregación en `/api/contabilidad/anticipos/reportes/*` + UI de tablas
**Alternatives considered**: Usar el endpoint general con filtros complejos
**Rationale**: Separación clara de responsabilidades, mejor performance con aggregaciones de BD

## Data Flow

```
┌─────────────────────────────────────────────────────────────────┐
│                        Página UI                                 │
│  /busy/contabilidad/anticipos/page.tsx                          │
└──────────────────────────┬──────────────────────────────────────┘
                           │
                           ▼
┌─────────────────────────────────────────────────────────────────┐
│                   Redux API Layer                               │
│  contabilidadApi.tsx (useGetAnticiposQuery, etc.)              │
└──────────────────────────┬──────────────────────────────────────┘
                           │
                           ▼
┌─────────────────────────────────────────────────────────────────┐
│                     API Routes                                  │
│  /api/contabilidad/anticipos/*                                 │
│  /api/contabilidad/anticipos/disponibles/*                     │
│  NEW: /api/contabilidad/anticipos/reportes/*                   │
└──────────────────────────┬──────────────────────────────────────┘
                           │
                           ▼
┌─────────────────────────────────────────────────────────────────┐
│               Workflow Services                                 │
│  anticipos-workflow.ts                                         │
│  - createAnticipo()                                            │
│  - executeAnticipo() [MODIFICAR]                               │
│  - reverseAnticipo()                                           │
└──────────────────────────┬──────────────────────────────────────┘
                           │
                           ▼
┌─────────────────────────────────────────────────────────────────┐
│                    Prisma / PostgreSQL                          │
│  Anticipo, AnticipoMovimiento                                   │
└─────────────────────────────────────────────────────────────────┘
```

## File Changes

| File | Action | Description |
|------|--------|-------------|
| `src/app/busy/contabilidad/anticipos/page.tsx` | Create | Página principal de gestión de anticipos |
| `src/components/contabilidad/anticipos/anticipos-table.tsx` | Create | Tabla de anticipos con filtros |
| `src/components/contabilidad/anticipos/anticipo-form.tsx` | Create | Formulario crear anticipo |
| `src/components/contabilidad/anticipos/anticipo-detail.tsx` | Create | Detalle de anticipo con movimientos |
| `src/components/contabilidad/anticipos/anticipo-ejecutar-dialog.tsx` | Create | Dialog para ejecutar anticipo (parcial/total) |
| `src/components/contabilidad/anticipos/reportes-anticipos.tsx` | Create | Componente de reportes |
| `src/lib/services/anticipos-workflow.ts` | Modify | Habilitar ejecución parcial |
| `src/app/api/contabilidad/anticipos/[id]/ejecutar/route.ts` | Modify | Aceptar ejecución parcial |
| `src/app/api/contabilidad/anticipos/reportes/cliente/route.ts` | Create | Reporte por cliente |
| `src/app/api/contabilidad/anticipos/reportes/proveedor/route.ts` | Create | Reporte por proveedor |
| `src/app/api/contabilidad/anticipos/reportes/resumen/route.ts` | Create | Resumen ejecutivo |
| `src/lib/redux/services/contabilidadApi.tsx` | Modify | Agregar queries de reportes |
| `src/app/models/model.ts` | Modify | Agregar tipos de reportes |

## Interfaces / Contracts

### Nuevo Schema de Ejecución Parcial

```typescript
// En anticipos-workflow.types.ts
interface ExecuteAnticipoParams {
  anticipoId: string
  contexto: AnticipoContexto
  documentoDestinoId: string
  montoObjetivo: number
  monedaObjetivo: string
  tasaAplicada?: number
  idempotencyKey: string
  observaciones?: string
  permitirParcial?: boolean  // NUEVO: default false
}
```

### Endpoints de Reportes

```typescript
// GET /api/contabilidad/anticipos/reportes/cliente?clienteId=&fechaInicio=&fechaFin=
interface ReporteClienteResponse {
  cliente: { clienteId: string; nombre: string }
  anticipos: Array<{
    anticipoId: string
    montoOriginal: number
    saldoDisponible: number
    estado: string
    fechaReserva: Date
    movimientos: Array<{ tipo: string; monto: number; fecha: Date }>
  }>
  totales: {
    totalOriginal: number
    totalEjecutado: number
    totalPendiente: number
  }
}

// GET /api/contabilidad/anticipos/reportes/proveedor?proveedorId=&fechaInicio=&fechaFin=
interface ReporteProveedorResponse {
  proveedor: { vendorId: string; nombre: string }
  anticipos: Array<{...}>
  totales: {...}
}

// GET /api/contabilidad/anticipos/reportes/resumen
interface ResumenAnticiposResponse {
  porTipo: { PAGO: number; COBRO: number }
  porEstado: { RESERVADO: number; EJECUTADO: number; ANULADO: number }
  porMoneda: Record<string, number>
  evolucion: Array<{ mes: string; pagos: number; cobros: number }>
}
```

## Testing Strategy

| Layer | What to Test | Approach |
|-------|-------------|----------|
| Unit | Lógica de ejecución parcial en workflow | Tests en `anticipos-workflow.test.ts` |
| Integration | Endpoints de reportes | Tests en `reportes/route.test.ts` |
| Integration | Ejecución parcial desde UI | Tests E2E con Playwright |
| Component | Renderizado de tabla, filtros | Tests con Testing Library |

### Casos de Prueba Clave

1. **Ejecución Parcial**
   - Ejecutar por menos del saldo → queda RESERVADO
   - Ejecutar por exactamente el saldo → pasa a EJECUTADO
   - Ejecutar por más del saldo → rechazar

2. **Reportes**
   - Reporte por cliente sin anticipos → mensaje vacío
   - Reporte por cliente con anticipos → datos correctos
   - Filtros de fecha funcionan correctamente

## Migration / Rollout

**No migration required** — Los cambios son exclusivamente de aplicación (UI y lógica). La base de datos ya tiene el modelo Anticipo.

### Feature Flag

Se reutiliza el flag existente `ENABLE_ANTICIPOS`:
- `true` (default): Muestra página de anticipos y permite ejecución parcial
- `false`: Oculta la página (backward compatible)

## Open Questions

- [ ] ¿Se requiere gráfico可视化 de evolución de anticipos? (Sugerido en specs pero no detallado)
- [ ] ¿El formulario de crear anticipo debe permitir editar vigencia después de creado?
- [ ] ¿Se necesita exportar a Excel además de CSV?

Por defecto: se implementa CSV y el resto como trabajo futuro si se requiere.
