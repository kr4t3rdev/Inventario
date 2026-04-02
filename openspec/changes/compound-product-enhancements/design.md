# Design: Compound Product Enhancements

## Technical Approach

Tres capas de cambios independientes: (1) extensión del form de creación con nuevos campos opcionales para el hijo, (2) filtros en selectores de compras y transferencias, (3) sync de stock padre↔hijo en las API routes. Todos aditivos; no hay migración de base de datos.

## Architecture Decisions

| Decisión | Opción elegida | Alternativas descartadas | Razón |
|---|---|---|---|
| `precioVentaHijo` en el schema | Campo opcional Zod en `productosSchema` | Estado local fuera del schema | Consistente con el patrón del form; validación inline gratuita |
| `preciosPorListaHijo` | Estado React fuera del schema (`Record<string,string>`) | Campo Zod | Idéntico al patrón de `preciosPorLista` del padre; evita arrays dinámicos en Zod |
| Toggle preview código hijo | Prop `usaEan13` en `CompoundProductSection` | Leer API desde el componente hijo | Sigue el flujo ascendente existente; `usaEan13` ya vive en el padre |
| Stock sync en compra | `tx.producto.update { stock: increment }` en el mismo `$transaction` | Evento/job asíncrono | El `$transaction` Prisma ya existe; añadir el incremento del hijo es una línea |
| Stock sync en venta | `tx.producto.update { stock: decrement }` en el padre dentro del `$transaction` de venta | Crear un `VentaItem` fantasma en el padre | Las ventas no usan `producto.stock` para el cálculo del PV (usan agregados), pero sí lo decrementan via compras; espejo exacto del pattern de compras |
| Filtros de selectores | `.filter(p => !p.productoPadreId)` en el cliente | Nuevo endpoint o param de query | `productoPadreId` ya viene en el payload de `GET /api/productos`; sin overhead de red |

## Data Flow

### Creación de producto compuesto

```
ProductoForm (onSubmit)
  │  payload: { ...parent, precioVentaHijo?, preciosPorListaHijo? }
  ↓
POST /api/productos
  ├── crea padre (Producto)
  ├── childPrice = precioVentaHijo ?? (precioVenta / cantidadEnPack)
  ├── crea hijo (Producto, productoPadreId = padre.id)
  └── si preciosPorListaHijo → crea PrecioProducto[] para el hijo
```

### Compra de padre → sync hijo

```
POST /api/compras-productos
  └── prisma.$transaction(tx)
        ├── tx.producto.update padre { stock += cantidad }
        ├── tx.stockUbicacion.upsert padre
        ├── [NUEVO] if padre.productosHijos.length > 0
        │     └── tx.producto.update hijo { stock += cantidad * cantidadEnPack }
        └── gastoCompra / cuentaPorPagar
```

### Venta de hijo → sync padre

```
POST /api/ventas (crearVentaIndividual + crearVentaUnica)
  └── prisma.$transaction(tx)
        ├── tx.venta.create (items del hijo)
        ├── [NUEVO] if item.producto.productoPadreId
        │     └── parentDecrement = floor(item.cantidad / cantidadEnPack)
        │         if parentDecrement >= 1:
        │           tx.producto.update padre { stock -= parentDecrement }
        └── factura / anticipo
```

## File Changes

| Archivo | Acción | Descripción |
|---|---|---|
| `src/components/productos/productos-form.tsx` | Modify | Agregar `precioVentaHijo` al schema; estado `preciosPorListaHijo`; pasar `usaEan13` a `CompoundProductSection`; incluir ambos en payload |
| `src/components/productos/compound-product-section.tsx` | Modify | Prop `usaEan13: boolean`; campo input `precioVentaHijo`; grid `preciosPorListaHijo`; preview código hijo condicional |
| `src/lib/redux/services/productosApi.tsx` | Modify | Ampliar `CompoundProductPayload` con `precioVentaHijo?: number` y `preciosPorListaHijo?: Array<{listaPrecioId,precio}>` |
| `src/app/api/productos/route.ts` | Modify | Ambas ramas (sin/con EAN-13): extraer `precioVentaHijo` y `preciosPorListaHijo` del body; usar en child creation |
| `src/app/api/compras-productos/route.ts` | Modify | Incluir `productosHijos` en `findUnique` del producto; sync stock hijo dentro del `$transaction` |
| `src/app/api/ventas/route.ts` | Modify | En `crearVentaIndividual` y `crearVentaUnica`: fetch `productoPadreId` y `cantidadEnPack` de cada item; decrementar padre si corresponde en el `$transaction` |
| `src/components/compras/compra-producto-form.tsx` | Modify | Filtrar lista de productos con `!p.productoPadreId` |
| `src/components/transferencias/transferencias-form.tsx` | Modify | Agregar `!p.productoPadreId` al filtro en `filteredProducts` de `ProductoSelector` |

## Interfaces / Contracts

```ts
// productos-form.tsx — additions to productosSchema
precioVentaHijo: z.preprocess(
  (v) => (v === '' || v === null || v === undefined ? undefined : Number(v)),
  z.number().positive().optional()
)

// compound-product-section.tsx — new prop
interface CompoundProductSectionProps {
  usaEan13: boolean   // NEW
  // ...existing props
}

// productosApi.tsx — additions to CompoundProductPayload
interface CompoundProductPayload {
  // ...existing
  precioVentaHijo?: number
  preciosPorListaHijo?: Array<{ listaPrecioId: string; precio: number }>
}

// api/compras-productos — product fetch
tx.producto.findUnique({
  where: { id: data.productoId },
  include: {
    vendor: true,
    productosHijos: { select: { id: true, cantidadEnPack: true } }  // NEW
  }
})
```

## Testing Strategy

| Layer | Qué testear | Enfoque |
|---|---|---|
| Unit | `precioVentaHijo` fallback a `precioVenta/cantidadEnPack` | Test en `productosApi` o util de precio |
| Unit | Filtro `!p.productoPadreId` excluye hijos del selector | Vitest en `compra-producto-form` con mock de productos |
| Integration | POST `/api/productos` crea hijo con `precioVentaHijo` explícito | Test de API route con Prisma mock |
| Integration | POST `/api/compras-productos` incrementa stock hijo | Test de transaction con spy en `tx.producto.update` |
| Integration | POST `/api/ventas` decrementa padre al vender hijo | Ídem |

## Migration / Rollout

No migration required. `productoPadreId` ya existe en el schema Prisma. Los productos compuestos existentes no tienen precios por lista configurados en el hijo — eso es aceptable; los nuevos sí los tendrán.

## Open Questions

- [ ] ¿El stock del hijo en las ventas debe afectar también `stockUbicacion` del padre? (actualmente la venta no toca `stockUbicacion`, solo `producto.stock`)
- [ ] Cuando se venden unidades hijo pero no llegan a un pack completo (`floor = 0`), ¿se muestra algún indicador de stock acumulado pendiente de sync?
