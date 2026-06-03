# Technical Design: Cuadre de Turno POS

## Architecture Overview

```
┌─ pv-interface.tsx (parent)
│  ├── CierreTurnoDialog ──→ "Ir a Arqueo" ──→ ArqueoForm
│  │                                                ↓ arqueo OK
│  └── CuadreTurnoDialog (NUEVO) ←───── "Repetir Arqueo"
│         ↓ "Aprobar y Cerrar"
│    cerrarTurnoAction
│         ↓
│    turno CERRADO → onSuccess()
```

## Component Tree

```
pv-interface.tsx
├── CabeceraTurno (existente, sin cambios)
├── AperturaTurnoDialog (existente, sin cambios)
├── CierreTurnoDialog (MODIFICADO — ya aplicado)
├── ArqueoForm (existente, ya no cierra turno)
└── CuadreTurnoDialog (NUEVO)
    ├── Cabecera del cuadre
    │   ├── Datos del turno (POS, empleado, fecha)
    │   └── Resumen del arqueo (total efectivo contado)
    ├── Tabla de productos
    │   ├── Fila por producto: [foto] nombre | stock | vendido | precio | restante
    │   └── Fila de totales:     TOTAL | sumStock | sumVendido | sumVentaMonto
    ├── Indicador de diferencia
    │   ├── VERDE + "Cuadre correcto" si diferencia = 0
    │   └── ROJO + "Diferencia detectada" si diferencia ≠ 0
    └── Footer con acciones
        ├── "Cancelar" — cierra diálogo
        ├── "Repetir Arqueo" — visible si diferencia ≠ 0
        └── "Aprobar y Cerrar Turno" — habilitado solo si diferencia = 0
```

## New Files

| Archivo | Propósito |
|---------|-----------|
| `src/features/turnos-pos/actions-cuadre.ts` | Server Action `getCuadreTurnoAction` |
| `src/features/turnos-pos/components/cuadre-turno-dialog.tsx` | Diálogo de cuadre + aprobación |
| `src/features/turnos-pos/types-cuadre.ts` (opcional) | Tipos del cuadre (pueden ir inline) |

## Modified Files

| Archivo | Cambio |
|---------|--------|
| `src/features/ventas/components/pv-interface.tsx` | Agregar estado `isCuadreDialogOpen`, importar y renderizar `CuadreTurnoDialog`; el `onSuccess` de `ArqueoForm` debe abrir el cuadre |
| `src/features/turnos-pos/index.ts` | Exportar `CuadreTurnoDialog` y `getCuadreTurnoAction` |

## Data Flow

### getCuadreTurnoAction

```typescript
// src/features/turnos-pos/actions-cuadre.ts
'use server';

// Queries paralelas:
// 1. Turno + Arqueo — findFirst con include arqueo
// 2. Ventas del turno — findMany VentaItem agrupado por productoId
// 3. StockUbicacion — findMany para el punto de venta

const PRODUCTOS_CUADRE_INCLUDE = {
  producto: {
    select: {
      id: true,
      nombre: true,
      codigoBarras: true,
      precioVenta: true,
      fotos: true,
      unidad: { select: { simbolo: true } },
    },
  },
} as const;

// Estrategia: Promise.all con 3 queries paralelas
const [turno, ventaItems, stockUbicacion] = await Promise.all([
  prisma.turnoPuntoVenta.findFirst({
    where: { id: turnoId, tenantId },
    include: { arqueo: true, empleado: { select: { nombre: true, apellido: true } } },
  }),

  // VentaItems de las ventas del turno
  prisma.ventaItem.findMany({
    where: { venta: { turnoId } },
    select: {
      productoId: true,
      cantidad: true,
      precioUnitario: true,
    },
  }),

  // Stock actual del punto de venta
  prisma.stockUbicacion.findMany({
    where: {
      puntoDeVentaId: turno.puntoDeVentaId, // ← hay que obtener esto del turno primero
      cantidad: { gt: 0 },
    },
    include: PRODUCTOS_CUADRE_INCLUDE,
  }),
]);
```

### Procesamiento de datos

```
1. Agrupar ventaItems por productoId → vendidoEnTurno { [productoId]: sum(cantidad) }
2. Mapear stockUbicacion → array productos
   - Para cada producto: stockEnUbicacion, vendidoEnTurno (0 si no se vendió),
     precioVenta (de producto.precioVenta), restante = stockEnUbicacion
3. Calcular totales:
   - totalStock = sum(stockEnUbicacion)
   - totalVendido = sum(vendidoEnTurno)
   - totalVentaMonto = sum(vendidoEnTurno * precioVenta)
4. Calcular totalArqueo = arqueo.totalEfectivoCup + arqueo.totalEfectivoUsd
   (O sumar todos los métodos de pago del arqueo)
5. difefencia = totalArqueo - totalVentaMonto
```

### Wireframe del CuadreTurnoDialog

```
┌─────────────────────────────────────────────────┐
│ 🔍 Cuadre del Turno               ✕             │
│ Punto de Venta: PV Principal                    │
│ Cajero: Juan Pérez  |  Fondo: $500.00 CUP      │
│ Apertura: 03/06/2026 08:30                      │
├─────────────────────────────────────────────────┤
│ ┌─── Resumen del Arqueo ──────────────────────┐ │
│ │ Efectivo CUP: $853.00                        │ │
│ │ Tarjeta:     $152.00                         │ │
│ │ Total arqueo: $1,005.00                      │ │
│ └──────────────────────────────────────────────┘ │
├─────────────────────────────────────────────────┤
│ Producto        Stock│Vendido│Precio│Restante    │
│ ─────────────────────────────────────────────── │
│ Leche pasteuriz.   15 │   12  │$45.00│    3      │
│ Pan de molde       23 │    8  │$30.00│   15      │
│ Arroz 1kg          30 │    5  │$25.00│   25      │
│ ...                                           │
│ ─────────────────────────────────────────────── │
│ TOTAL              68 │   25  │$853.00│   43     │
├─────────────────────────────────────────────────┤
│ ⚠️  Diferencia detectada: -$53.00 CUP          │
│ El arqueo ($800.00) no coincide con ventas      │
│ ($853.00). Revise el conteo.                    │
│              ┌──────────┐  ┌──────────────┐     │
│              │ Repetir  │  │ Aprobar y    │     │
│              │ Arqueo   │  │ Cerrar Turno │     │
│              │          │  │  (DESACT.)   │     │
│              └──────────┘  └──────────────┘     │
└─────────────────────────────────────────────────┘
```

## Component States

### CuadreTurnoDialog

| State | Condición | UI |
|-------|-----------|-----|
| **Loading** | Abriendo diálogo, cargando datos | Skeleton de tabla (4 filas) + spinner |
| **Error** | Action error (turno no encontrado, etc.) | Mensaje de error + botón "Cerrar" |
| **Loaded — OK** | diferencia = 0 | Todo normal, botón "Aprobar" habilitado |
| **Loaded — Diff** | diferencia ≠ 0 | Borde rojo en tabla + warning + botón "Aprobar" deshabilitado + botón "Repetir Arqueo" |
| **Submitting** | Usuario hizo clic en "Aprobar" | Spinner en botón, inputs deshabilitados |
| **Submit error** | cerrarTurnoAction falló | Mensaje de error en diálogo, botón reactivado |

## Validation Split

**Client-side (UI):**
- Comparación arqueo vs ventas para habilitar/deshabilitar botón
- Visual: rojo/verde según diferencia

**Server-side (Action):**
- `getCuadreTurnoAction`: valida que turno existe, pertenece al tenant, está ABIERTO, tiene arqueo
- `cerrarTurnoAction`: valida que existe, está ABIERTO, tiene arqueo (ya implementado)

## Tests Plan

### Unit tests (Vitest)

**actions-cuadre.test.ts:**
- Debe retornar cuadre completo con productos, ventas y arqueo
- Debe fallar si turno no existe
- Debe fallar si turno no tiene arqueo
- Debe calcular correctamente totalVentaTurno
- Debe agrupar correctamente ventaItems por productoId

### Component test (si aplica)
- CuadreTurnoDialog: renderiza correctamente en cada estado

## Edge Cases

1. **Producto vendido pero sin stock en ubicación**: aparece con stockEnUbicacion = 0 y restante = 0. El vendidoEnTurno muestra la cantidad correcta.
2. **Producto en inventario sin ventas**: aparece con vendidoEnTurno = 0. Se muestra para visibilidad de existencias.
3. **Turno sin ventas (solo apertura y arqueo)**: tabla vacía con mensaje "No hay productos en este turno", totalVentaMonto = 0.
4. **Arqueo en USD mayor que ventas**: la diferencia se calcula por separado (cup/usd) o se suman ambos. Decisión: sumar CUP + USD para la comparación principal.
5. **Muchos productos (>50)**: la tabla tiene scroll interno (max-h) para no ocupar toda la pantalla.
