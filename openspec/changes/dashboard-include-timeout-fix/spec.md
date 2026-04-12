# Spec: dashboard-include-timeout-fix

## Contexto

En producción (Vercel serverless), los gráficos y tablas del Dashboard fallan al cargar datos.
El endpoint `/api/dashboard/stats` realiza queries Prisma con `include: { ... }` que traen objetos
relacionales completos, generando timeouts en bases de datos con volumen real.

Dos patrones problemáticos identificados:

### Problema 1 — N+1 queries con `include` completo (`productosMasVendidos`)

```typescript
// ❌ Antes: 5 findUnique separados dentro de Promise.all, cada uno cargando categoria completa
const productosMasVendidos = await Promise.all(
  productosVentas.map(async ([productoId, cantidad]) => {
    const producto = await prisma.producto.findUnique({
      where: { id: productoId },
      include: { categoria: true },  // trae TODOS los campos de categoria
    })
  })
)
```

Genera hasta **5 queries separadas** al DB, cada una cargando el objeto `categoria` completo.

### Problema 2 — `findMany` con `include` completo (`productosStockBajo`)

```typescript
// ❌ Antes: trae TODOS los productos con objetos categoria y unidad completos
const todosLosProductos = await prisma.producto.findMany({
  where: baseWhereCondition,
  include: { categoria: true, unidad: true },
})
```

Con crecimiento del catálogo este query escala linealmente en payload y tiempo.

---

## Requisitos

### RF-01: productosMasVendidos — batch query con select limitado

- **DEBE** obtener los top 5 productos vendidos con una **sola query** `findMany` con `where: { id: { in: [...] } }`
- **DEBE** usar `select` restringido a: `id`, `nombre`, `stock`, `categoria: { nombre }`
- **NO DEBE** usar `include: { categoria: true }` ni queries individuales dentro de un loop/Promise.all
- El resultado debe ser idéntico en shape al anterior: `{ id, nombre, categoria, ventas, ingresos, stock }`

### RF-02: productosStockBajo — select limitado en findMany

- **DEBE** usar `select` restringido a: `id`, `nombre`, `stock`, `stockMinimo`, `categoria: { nombre }`, `unidad: { simbolo }`
- **NO DEBE** usar `include: { categoria: true, unidad: true }`
- El resultado debe incluir todos los campos que consume `stock-bajo-table.tsx`:
  `producto.id`, `producto.nombre`, `producto.categoria.nombre`, `producto.unidad.simbolo`,
  `producto.stockTotal`, `producto.stockMinimo`, `producto.umbralUsado`, `producto.diferencia`

### RF-03: Sin regresión en comportamiento

- Los datos devueltos por `/api/dashboard/stats` deben tener la misma estructura que antes
- Los tests existentes de `stock-bajo-table` deben seguir pasando

---

## Criterios de Aceptación

| ID | Criterio | Tipo |
|----|----------|------|
| CA-01 | El endpoint NO ejecuta queries N+1 para productosMasVendidos | funcional |
| CA-02 | Los `include: { categoria: true, unidad: true }` están eliminados del route | funcional |
| CA-03 | El componente `StockBajoTable` muestra datos correctamente | funcional |
| CA-04 | El componente `TopProductsTable` / gráficos muestran datos correctamente | funcional |
| CA-05 | No hay errores TypeScript en `dashboard/stats/route.ts` | técnico |
| CA-06 | Los tests de `stock-bajo-table` pasan sin cambios | regresión |

---

## Patrón Generalizable

Este mismo problema puede aparecer en cualquier endpoint que use:
- `include: { productos: true }` → timeout garantizado con catálogo grande
- `include: { categoria: true }` dentro de un loop/Promise.all → N+1
- `include: { unidad: true }` trayendo campos que no se usan

**Solución estándar**: siempre usar `select` con solo los campos necesarios para la respuesta.
Ver `/memories/repo/include-productos-fix-pattern.md` para el patrón documentado.
