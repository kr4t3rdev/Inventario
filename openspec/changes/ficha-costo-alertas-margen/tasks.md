# Tasks: Alertas de Margen Bajo — Ficha de Costo

## Work Units

| # | WU | Tests | ~Líneas |
|---|-----|-------|---------|
| 1 | Server Action + tipos | 6 | ~120 |
| 2 | Widget en Dashboard | 5 | ~200 |
| 3 | Notificaciones | 4 | ~100 |

---

## WU1: Server Action `getProductosMargenBajoAction`

### RED
- [ ] Crear `src/features/ficha-costo/__tests__/actions-alertas.test.ts`
- [ ] Tests:
  1. Retorna productos con margen < 10%
  2. Array vacío si todos tienen margen ≥ 10%
  3. Excluye productos con precioVenta = 0
  4. Filtra por tenantId
  5. Respeta el límite configurable
  6. Ordena por margen ascendente

### GREEN
- [ ] Crear `src/features/ficha-costo/actions-alertas.ts` con `'use server'`
- [ ] Tipo `GetProductosMargenBajoInput { limit?: number }`
- [ ] Tipo `ProductoMargenBajoItem { id, nombre, codigoInterno, precioCosto, precioVenta, margenPorcentaje, estado }`
- [ ] Query: `prisma.producto.findMany({ where: { tenantId, precioVenta: { gt: 0 }, precioCosto: { gt: 0 } } })`
- [ ] Filtrar y ordenar en memoria (margen simple)
- [ ] Actualizar barrel `actions.ts`

### Verificación
```bash
pnpm test:run src/features/ficha-costo/__tests__/actions-alertas.test.ts
```

---

## WU2: Widget `MargenBajoTable` en Dashboard

### RED
- [ ] Crear `src/features/dashboard/__tests__/margen-bajo-table.test.tsx`
- [ ] Tests:
  1. Renderiza tabla con productos
  2. Muestra badge de estado correcto
  3. Mensaje vacío cuando no hay productos
  4. Loading state con skeleton
  5. Error state

### GREEN
- [ ] Crear `src/features/dashboard/components/margen-bajo-table.tsx`
- [ ] Card con título "Productos con Margen Bajo"
- [ ] Tabla: Producto | Precio Venta | Costo | Margen | Estado
- [ ] Badge: 🟢 ≥10%, 🟡 0-10%, 🔴 <0%
- [ ] Integrar en `dashboard/page.tsx`

### Verificación
```bash
pnpm test:run src/features/dashboard/__tests__/margen-bajo-table.test.tsx
```

---

## WU3: Notificaciones de Margen Bajo

### RED
- [ ] Crear `src/features/notificaciones/__tests__/verificar-margen.test.ts` (o agregar a existente)
- [ ] Tests:
  1. Crea notificación para producto con margen < 10%
  2. Dedup: no notifica si ya fue notificado en 24h
  3. No notifica productos con margen ≥ 10%
  4. Batch: notifica múltiples productos en una sola llamada

### GREEN
- [ ] Crear `src/lib/verificar-margen.ts`
- [ ] Función `verificarMargenBajo()` siguiendo patrón de `verificar-stock.ts`
- [ ] Usa `crearNotificacion()` de `notificaciones-utils.ts`
- [ ] Tipo `margen_bajo` en el sistema de notificaciones
- [ ] Actualizar `panel-notificaciones.tsx` para nuevo tipo

### Verificación
```bash
pnpm test:run src/features/notificaciones/__tests__/verificar-margen.test.ts
```

---

## Definition of Done
- [ ] 15 tests nuevos pasan (6 + 5 + 4)
- [ ] Suite ficha-costo no se rompe (150 tests)
- [ ] Multi-tenant verificado en todas las queries
- [ ] Widget visible en dashboard
- [ ] Notificaciones creadas correctamente
