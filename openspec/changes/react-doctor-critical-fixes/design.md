# Design: react-doctor-critical-fixes

## 1. Componente anidado — Extraer StockChange

### Current pattern

```tsx
// src/features/ventas/components/venta-Inter.tsx
export function VentaInter() {
  // ... muchos useState, efectos, handlers

  function StockChange({ product, onConfirm }) {
    const [open, setOpen] = useState(false);
    const [loading, setLoading] = useState(false);
    // ... estado interno
    return <Dialog open={open}>...</Dialog>;
  }

  return (
    <div>
      {/* ... donde se usa StockChange */}
      <StockChange product={p} onConfirm={handleConfirm} />
    </div>
  );
}
```

### Target pattern

```tsx
// Dentro de VentaInter:
const StockChange = useCallback((productId: string, stock: number) => {
  setCarrito((prevCart) =>
    prevCart.map((item) =>
      item.id === productId
        ? { ...item, stock: stock > 0 ? stock : 1 }
        : item
    )
  )
}, [setCarrito])
```

> **Nota de implementación**: `StockChange` NO es un componente React sino una función helper que actualiza el carrito vía `setCarrito` (setter estable de `useState`). React Doctor lo marcó por el nombre PascalCase. Se resuelve con `useCallback` en vez de extracción a archivo — mismo beneficio (la función no se recrea en cada render), mínimo cambio.

### Implementation steps

1. Leer `venta-Inter.tsx` línea 69 e identificar la función `StockChange`
2. Analizar dependencias: solo usa `setCarrito` (estable, nunca cambia entre renders)
3. Agregar `useCallback` al import de React
4. Envolver `StockChange` con `useCallback` y dependencia `[setCarrito]`
5. Verificar con `npx tsc --noEmit`

### Files affected
- `src/features/ventas/components/venta-Inter.tsx` — agregar import de `useCallback`, envolver función

## 2. Index como key — Reemplazar por keys estables

### Current pattern

```tsx
{array.map((item, idx) => (
  <SomeComponent key={idx} ... />
))}
```

o:

```tsx
{array.map((item, index) => (
  <SomeComponent key={index} ... />
))}
```

### Target pattern

```tsx
{array.map((item) => (
  <SomeComponent key={item.id} ... />
))}
```

### Key selection strategy

Para cada archivo, identificar el tipo de dato del item y elegir el campo ID correcto:

| Prefijo de variable | Campo ID típico |
|---------------------|----------------|
| `producto` / `product` | `productoId`, `id`, `codigo` |
| `venta` | `ventaId`, `id` |
| `cliente` | `clienteId`, `id` |
| `categoria` | `categoriaId`, `id` |
| `empleado` | `empleadoId`, `id` |
| `gasto` | `gastoId`, `id` |
| `contrato` | `contratoId`, `id` |
| `oferta` | `ofertaId`, `id` |
| `servicio` | `servicioId`, `id` |
| `transferencia` | `transferenciaId`, `id` |
| `movimiento` | `movimientoId`, `id` |
| `cuenta` | `cuentaId`, `id` |
| `prestamo` | `prestamoId`, `id` |
| `notificacion` | `notificacionId`, `id` |
| `merma` | `mermaId`, `id` |
| `factura` | `facturaId`, `id` |
| `usuario` / `user` | `id`, `userId` |
| `item` / genérico | Revisar tipo del item |
| `tab` / `step` / secciones fijas | Index puede ser válido si la lista es estática y nunca se reordena |

**Regla**: si la lista es estática (tabs, steps de un formulario, items que nunca cambian de orden), index es aceptable. Si la lista puede reordenarse, filtrarse, o mutarse → usar ID único.

### Implementation strategy

Procesar archivo por archivo en orden de riesgo:

**Batch A (riesgo bajo — listas de datos de servidor con IDs claros):**
1. `src/features/ventas/components/ventas-table.tsx:272,282` — ventaId
2. `src/features/ventas/components/pv-interface.tsx:154,567` — productoId
3. `src/features/reportes-financieros/components/reporte-general.tsx:224` — id
4. `src/features/contabilidad/components/cuentas-por-cobrar-table.tsx:147` — id
5. `src/features/contabilidad/components/prestamos-cash/prestamos-cash-table.tsx:231` — id
6. `src/features/contabilidad/components/resumen-financiero.tsx:368,388` — id
7. `src/features/reportes-financieros/components/reporte-por-categoria.tsx:72,136` — id
8. `src/features/reportes-financieros/components/reporte-venta-diaria.tsx:443,852` — id

**Batch B (riesgo medio — componentes con tipos mixtos):**
9-20: Resto de archivos de features (servicios, contratos, ofertas, empleados, etc.)

**Batch C (riesgo medio — dialogs y componentes de UI):**
21-30: category-move-dialog, cuentas-table, invoice, etc.

### Files affected (full list from React Doctor diagnostics)

```
src/features/ventas/components/producto-card.tsx:37
src/features/ventas/components/ventas-table.tsx:272,282
src/features/reportes-financieros/components/reporte-general.tsx:224
src/features/gastosDE/components/gasto-conceptos-content.tsx:157
src/features/ventas/components/pv-interface.tsx:154,567
src/features/contabilidad/components/anticipos/reportes-anticipos.tsx:181,289
src/features/contabilidad/components/cuentas-por-cobrar-table.tsx:147
src/app/busy/cliente/page.tsx:162
src/features/contabilidad/components/prestamos-cash/prestamos-cash-table.tsx:231
src/features/contabilidad/components/reconciliacion/reconciliacion-gastos-form.tsx:507
src/features/servicios/components/servicios-recibidos-table.tsx:97
src/features/contabilidad/components/tipos-pago-config-page.tsx:39
src/features/contabilidad/components/reconciliacion/reconciliacion-hub-client.tsx:55,58,204
src/features/empleados/components/empleados-form.tsx:169
src/features/contabilidad/components/resumen-financiero.tsx:368,388
src/app/busy/reparaciones/ordenes/new/page.tsx:286,604
src/features/gastosDE/components/gastosDE-content.tsx:317
src/features/gastosDE/components/gasto-elementos-content.tsx:148
src/features/notificaciones/components/panel-notificaciones.tsx:178
src/features/productos/components/product-photo-upload.tsx:107
src/app/busy/sugerencias/wanda-dashboard/page.tsx:329
src/components/ui/animations.tsx:318
src/features/productos/components/restock-history.tsx:329
src/features/reportes-financieros/components/reporte-por-categoria.tsx:72,136
src/features/vendors/components/vendor-page-client.tsx:160
src/features/admin/components/migrate-cuentas-por-pagar-button.tsx:197
src/features/productos/components/bulk-stock-minimo-manager.tsx:372
src/features/servicios/components/servicios-content.tsx:164
src/components/stock-bajo-table.tsx:87
src/features/categorias/components/category-move-dialog.tsx:329
src/features/contabilidad/components/cierres/CierresTable.tsx:58
src/app/busy/reparaciones/page.tsx:270
src/features/contabilidad/components/deudas-cash/deudas-cash-table.tsx:143
src/app/busy/invoice/page.tsx:304,314
src/app/busy/reparaciones/ordenes/[id]/page.tsx:1112,1226
src/features/cuadre-diario/components/cuadre-diario.tsx:130
src/features/gastosDE/components/GastoDEForm.tsx:107
src/features/admin/components/tenant-users-skeleton.tsx:25,50
src/features/contabilidad/components/capital/capital-table.tsx:60
src/features/empleados/components/empleados-nomina-content.tsx:392
src/features/mermas/components/mermas-table.tsx:154,164
src/features/facturas/components/facturas-content.tsx:304
src/app/busy/contabilidad/page.tsx:73,79
```

## 3. ARIA combobox — Agregar aria-controls

### Current pattern

```tsx
<div role="combobox" aria-expanded={isOpen}>
```

### Target pattern

```tsx
const listboxId = `listbox-${uniqueId}`;
<div role="combobox" aria-expanded={isOpen} aria-controls={listboxId}>
<div id={listboxId} role="listbox">...</div>
```

### Files affected

1. `src/features/transferencias/components/transferencias-form.tsx:126`
2. `src/features/gastosDE/components/VendorCombobox.tsx:32`
3. `src/app/busy/contabilidad/analisis-cuenta-cliente/page.tsx:202`

### Implementation steps

Para cada archivo:
1. Identificar el elemento `role="combobox"`
2. Identificar dónde está el `role="listbox"` que contiene las opciones
3. Darle un ID único al listbox (o usar uno existente)
4. Agregar `aria-controls={idDelListbox}` al combobox

## Testing strategy

### Por tipo de fix

| Fix type | Test approach |
|----------|---------------|
| Componente anidado | Manual: abrir diálogo, triggerear re-render de VentaInter, verificar que el diálogo no se cierra. Build: `pnpm run build` |
| Index como key | Build: `pnpm run build` + `pnpm run lint`. Manual: navegar por cada pantalla modificada, verificar que las listas se renderizan correctamente |
| ARIA combobox | Build: `pnpm run build` + `pnpm run lint`. React Doctor ya no debe reportar `role-has-required-aria-props` |

### Commands

```bash
pnpm run build     # TypeScript + compilación
pnpm run lint      # ESLint
```

## Dependencies

Ninguna entre los 3 tipos de fix — pueden implementarse en cualquier orden.

**Orden recomendado**: Componente anidado → ARIA combobox → Index como key (de menor a mayor cantidad de archivos).
