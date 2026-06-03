# SDD Proposal: Cuadre de Turno POS

## Executive Summary

Rediseñar el flujo de cierre de turno POS para separar el arqueo del cierre, agregar una pantalla intermedia de **cuadre de turno** (estilo IPV clásico) que muestre el inventario del punto de venta vs lo vendido en el día, y validar que el arqueo coincida con el total de ventas antes de permitir cerrar el turno.

## Context

- **App**: Next.js 15, React 19, TypeScript, Prisma, PostgreSQL
- **Feature afectada**: `src/features/turnos-pos/`, `src/features/arqueo-caja/`, `src/features/ventas/components/pv-interface.tsx`
- **Estado actual**: El arqueo de caja cierra el turno automáticamente. El diálogo de cierre tiene un botón "Cerrar Turno" que nunca se puede usar (requiere arqueo, pero si hay arqueo el turno ya está cerrado). No hay pantalla de verificación intermedia.
- **Bug conocido**: En `CierreTurnoDialog` el total de venta se divide por 100 (`(totalVentas / 100).toFixed(2)`) pero `Venta.total` está en unidades/pesos, no en centavos. Esto muestra `8.53` cuando debería ser `853`.
- **TDD**: Strict mode activo (`openspec/config.yaml`)

## Problem

1. **Acoplamiento arqueo-cierre**: `realizarArqueoAction` cierra el turno en la misma transacción. No hay posibilidad de hacer arqueo sin cerrar, ni de verificar el cuadre antes del cierre definitivo.
2. **Sin verificación visual**: Al cerrar un turno, el cajero no ve un resumen de productos vs cantidades vendidas vs inventario restante. No hay forma de detectar discrepancias de inventario antes de cerrar.
3. **Validación débil**: El cierre puede forzarse sin arqueo (`forzar=true`), lo que permite cerrar turnos sin verificar el efectivo.
4. **Bug de visualización**: El total de venta en el diálogo de cierre se muestra incorrectamente (divide por 100).

## Proposed Solution

### Nuevo flujo de cierre

```
[Botón "Cerrar Turno"]
  ↓
[CierreTurnoDialog] — muestra resumen, botones: Cancelar, "Ir a Arqueo", "Cerrar Turno" (deshabilitado si no hay arqueo)
  ↓ (usuario elige "Ir a Arqueo")
[ArqueoForm] — conteo de billetes, al confirmar guarda arqueo pero NO cierra turno
  ↓ (arqueo exitoso)
[CuadreTurnoDialog] — NUEVA PANTALLA
  ├── Lista productos del POS: stock en ubicación | vendido hoy | precio venta
  ├── Lista cantidades restantes por producto al cierre
  ├── Fila resumen: total stock | total vendido | total venta $
  ├── Muestra diferencia entre arqueo y total venta
  ├── Si arqueo == total venta: botón "Aprobar y Cerrar Turno" habilitado
  ├── Si arqueo != total venta: todo en ROJO, botón "Repetir Arqueo" para volver
  └── Botón "Repetir Arqueo" → vuelve a ArqueoForm
```

### Separación de responsabilidades

| Acción | Comportamiento nuevo |
|--------|---------------------|
| `realizarArqueoAction` | Solo registra arqueo. NO cierra el turno. Valida que no haya arqueo previo. |
| `cerrarTurnoAction` | Valida que exista arqueo. Valida que el total del arqueo coincida con el total de ventas. Si no coincide, retorna error. Cambia estado a `CERRADO`. |
| `getCuadreTurnoAction` | **Nueva**: retorta productos del POS con stocks, vendidos en el turno, y totales. |

### Nueva Server Action

```typescript
// src/features/turnos-pos/actions-cuadre.ts
'use server';

export const getCuadreTurnoAction = withAction(
  async (turnoId: string, user: AuthenticatedUser) => {
    // Retorna:
    // - productos del punto de venta con stock actual
    // - cantidades vendidas en el turno por producto
    // - total de venta del turno
    // - datos del arqueo (total efectivo contado)
  }
);
```

### Nuevo componente

```typescript
// src/features/turnos-pos/components/cuadre-turno-dialog.tsx
'use client';

interface CuadreTurnoDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  turnoId: string;
  puntoDeVentaId: string;
  onRepetirArqueo: () => void;  // Vuelve al arqueo
  onSuccess: () => void;         // Turno cerrado exitosamente
}
```

## Impact Analysis

**Affected modules:**

| Archivo | Cambio |
|---------|--------|
| `src/features/arqueo-caja/actions.ts` | `realizarArqueoAction`: eliminar cierre de turno de la transacción |
| `src/features/turnos-pos/actions.ts` | `cerrarTurnoAction`: agregar validación de arqueo existente; eliminar `forzar` |
| `src/features/turnos-pos/components/cierre-turno-dialog.tsx` | Corregir bug de división por 100; ajustar botones |
| `src/features/ventas/components/pv-interface.tsx` | Ajustar flujo para nuevo diálogo de cuadre |
| `src/features/turnos-pos/actions-cuadre.ts` | **NUEVO** — Server Action para datos del cuadre |
| `src/features/turnos-pos/components/cuadre-turno-dialog.tsx` | **NUEVO** — Pantalla de cuadre |

**Risks:**

- **Datos existentes**: Turnos ya cerrados con arqueo no se afectan. Turnos abiertos sin arqueo: al cerrar, ahora requerirán arqueo (ya no se permite `forzar=true`).
- **Rendimiento**: La query de cuadre puede ser pesada si hay muchos productos. Limitar a productos del punto de venta + filtro de stock > 0.
- **Transaccionalidad**: `cerrarTurnoAction` debe ser atómico al cambiar estado CERRADO.

**Non-goals:**

- No se crea página de historial de turnos (existe `getTurnosAction` pero sin UI — queda para otro SDD)
- No se modifica el modelo Prisma (schema actual es suficiente)
- No se afecta el flujo de ventas ni la creación de turnos automáticos
- No se cambian las denominaciones de billetes (ya existen $10, $5, $1 USD)

## Correcciones inmediatas (no requieren SDD)

Además del nuevo flujo, se corregirán estos bugs existentes:

1. **Bug total venta**: `CierreTurnoDialog` usa `(totalVentas / 100).toFixed(2)` pero `Venta.total` está en pesos, no centavos. Cambiar a `totalVentas.toFixed(2)`.
2. **Separación arqueo-cierre**: `realizarArqueoAction` no debe cerrar el turno.
3. **Validación cierre**: `cerrarTurnoAction` debe requerir arqueo existente antes de cerrar.

## Alternatives Considered

1. **Mantener flujo actual**: El arqueo cierra el turno y no hay cuadre → el cajero no tiene visibilidad del inventario restante → rechazado.
2. **Cuadre embebido en ArqueoForm**: Mezclar conteo de efectivo con revisión de inventario hace el modal muy grande → rechazado (separación de concerns).
3. **Pantalla separada en ruta `/busy/turnos/cuadre`**: Requiere navegación, rompe el flujo modal → preferimos diálogo modal para mantener contexto.

## Next

→ **Spec** (si se aprueba): Given/When/Then para cada acción y validación
→ **Design**: Wireframe del cuadre, árbol de componentes, data flow
→ **Tasks**: 4-5 tareas agrupadas por dependencias
