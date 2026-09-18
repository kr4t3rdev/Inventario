# Exploración: Ficha de Costo

**Fecha**: 2026-06-18
**Change name sugerido**: `add-cost-sheet-module`
**Status**: Exploration complete

---

## 1. Realidad actual en el codebase

### Modelos de datos existentes (Prisma schema)

**Producto** (`prisma/schema.prisma:393-452`)
- `precioCosto: Int` — valor único, último costo registrado
- `precioVenta: Int` — precio de venta actual
- `esCompuesto: Boolean` — flag para productos con receta
- Relaciones: `costHistory`, `Receta`, `RecetaIngrediente`, `compras`, `gastoCompras`

**ProductoCostHistory** (`schema.prisma:2054-2071`)
- Registra cambios de precio: `oldPrecioCosto`, `newPrecioCosto`, `oldPrecioVenta`, `newPrecioVenta`
- Incluye `reason: CostChangeReason` y `changedBy: String`
- Solo captura el momento del cambio, no el origen del costo

**Receta + RecetaIngrediente** (`schema.prisma:1962-1996`)
- `Receta.costoUnitario: Float` — costo calculado de la receta
- `RecetaIngrediente`: `productoId`, `cantidad`, `desperdicio`
- Vinculada a `Producto` vía `productoId`

**OrdenProduccion** (`schema.prisma:1929-1945`)
- `costoMateriales: Float?` — costo de materiales de la orden
- Vinculada a `Receta`

**CompraProducto / CompraDocumento / CompraDocumentoItem** (`schema.prisma:887-974`)
- Sistema de compras con `precioUnitario`, `cantidad`, `total`
- `CompraDocumentoItem` tiene `PurchaseAllocation[]` para FIFO

**PurchaseAllocation** (`schema.prisma:979-996`)
- Asignación FIFO: vincula `VentaItem` con `CompraDocumentoItem`
- Ya existe trazabilidad compra→venta

**GastoCompra** (`schema.prisma:861-885`)
- Gastos asociados a compras: `productoId`, `vendorId`, `precioUnitario`, `total`

**PrecioProducto + ListaPrecio** (`schema.prisma:2026-2052`)
- Sistema de listas de precios múltiples por producto

### Features existentes relevantes

| Feature | Path | Relevancia |
|---------|------|------------|
| productos | `src/features/productos/` | CRUD, stock, restock |
| produccion | `src/features/produccion/` | Recetas, órdenes, ingredientes |
| compras-productos | `src/features/compras-productos/` | Registro de compras |
| reportes-financieros | `src/features/reportes-financieros/` | Rentabilidad por compra |
| contabilidad | `src/features/contabilidad/` | Exchange, cierres, períodos |
| listas-precios | `src/features/listas-precios/` | Listas de precios múltiples |

### Utilidades existentes

- `src/lib/cost-history-utils.ts` — `recordCostChange()` para auditar cambios de precio
- `src/features/reportes-financieros/actions-rentabilidad-compra.ts` — calcula ROI, margen, costo vendido por compra

---

## 2. Gaps para Ficha de Costo

### Lo que NO existe

1. **Entidad consolidada de costo**: No hay un modelo que represente la "ficha de costo" como documento con componentes desglosados.

2. **Costo promedio ponderado**: No hay cálculo visible de CPP (Costo Promedio Ponderado) para productos simples.

3. **Desglose de costos para productos compuestos**: La receta tiene `costoUnitario` pero no incluye:
   - Mano de obra
   - Costos indirectos (luz, gas, mantenimiento)
   - Merma esperada vs real
   - Margen de seguridad

4. **Costo estándar vs costo real**: No hay mecanismo para comparar costo planificado vs ejecutado.

5. **Ficha imprimible/exportable**: No hay vista consolidada que muestre:
   - Composición del costo
   - Historial de variaciones
   - Comparativa con precio de venta
   - Margen actual vs deseado

6. **Trazabilidad de origen de costo**: `ProductoCostHistory` registra el cambio pero no de dónde vino (compra, producción, ajuste manual).

### Lo que SÍ existe y se puede aprovechar

- ✅ Historial de compras con precios unitarios
- ✅ Sistema FIFO para trazabilidad compra→venta
- ✅ Recetas con ingredientes y cantidades
- ✅ Órdenes de producción con costo de materiales
- ✅ Reporte de rentabilidad por compra
- ✅ Auditoría de cambios de precio

---

## 3. Recommended first-scope change

### Opción recomendada: Ficha de Costo como vista calculada + modelo ligero

**Enfoque**: Crear un módulo `ficha-costo` que:

1. **Para productos simples** (no compuestos):
   - Calcule costo promedio ponderado desde `CompraDocumentoItem` + `GastoCompra`
   - Muestre historial de costos de compra
   - Compare con `precioCosto` actual y `precioVenta`
   - Calcule margen actual y margen deseado

2. **Para productos compuestos** (con receta):
   - Calcule costo de materiales desde `RecetaIngrediente` × costo de cada ingrediente
   - Permita agregar costos de mano de obra y gastos indirectos
   - Muestre desglose: materiales + mano de obra + indirectos
   - Compare con precio de venta y margen

3. **Modelo de datos**:
   - Nuevo modelo `FichaCosto` (opcional, para persistir configuración)
   - O vista calculada on-demand desde datos existentes

### Alcance del primer cambio (MVP)

1. **Server Actions** en `src/features/ficha-costo/actions.ts`:
   - `getFichaCostoAction(productoId)` — calcula ficha completa
   - `getHistorialCostosAction(productoId)` — historial de compras
   - `calcularCostoPromedioPonderadoAction(productoId)` — CPP
   - `getComposicionCostoAction(productoId)` — desglose para compuestos

2. **UI** en `src/features/ficha-costo/components/`:
   - Vista de ficha con tabs: Resumen | Historial | Composición | Margen
   - Exportable a PDF

3. **Integración**:
   - Link desde vista de producto
   - Actualización automática al registrar compras

---

## 4. Riesgos / Truthfulness constraints

### Restricciones de veracidad

1. **Consistencia de datos**: El costo calculado depende de que las compras estén correctamente registradas. Compras faltantes = costo subestimado.

2. **Monedas**: El sistema maneja CUP y USD. La ficha debe normalizar monedas usando tasas de cambio del período.

3. **Multi-tenant**: Todos los cálculos deben respetar `tenantId`. Sin fuga de datos entre tenants.

4. **Performance**: Calcular CPP para muchos productos puede ser costoso. Considerar caché o cálculo batch.

5. **Concurrencia**: Si se persiste `FichaCosto`, manejar concurrencia en actualizaciones.

6. **Redondeo**: Usar `Decimal` de Prisma para cálculos monetarios, no `Float`.

### Suposiciones vs Hechos

| Afirmación | Tipo | Evidencia |
|------------|------|-----------|
| Producto tiene precioCosto único | HECHO | schema.prisma:397 |
| No existe ficha de costo | HECHO | grep "ficha.*costo" = 0 results |
| CompraDocumentoItem tiene precios | HECHO | schema.prisma:956-974 |
| Receta tiene costoUnitario | HECHO | schema.prisma:1967 |
| Sistema usa FIFO | HECHO | PurchaseAllocation model |
| No hay CPP calculado | SUPOSICIÓN | No se encontró código de CPP |
| Mano de obra no está modelada | SUPOSICIÓN | No se encontró modelo de mano de obra |

---

## 5. Suggested SDD change name

```
add-cost-sheet-module
```

---

## 6. Relevant files/modules

### Schema
- `prisma/schema.prisma` — modelos Producto, Receta, Compra*, ProductoCostHistory

### Features
- `src/features/productos/` — CRUD de productos
- `src/features/produccion/` — recetas y órdenes de producción
- `src/features/compras-productos/` — registro de compras
- `src/features/reportes-financieros/` — rentabilidad (referencia para cálculos)

### Lib
- `src/lib/cost-history-utils.ts` — auditoría de cambios de precio
- `src/lib/services/tenant-scope.ts` — multi-tenant
- `src/lib/utils/unit-converter.ts` — conversión de unidades

### UI
- `src/app/busy/productos/` — página de productos (integración)
- `src/app/busy/produccion/` — página de producción (integración)

---

## 7. Próximos pasos

1. Crear proposal con el scope definido
2. Escribir spec con requisitos y escenarios
3. Diseñar arquitectura del módulo
4. Implementar Server Actions + UI

---

*Exploración completada el 2026-06-18*
