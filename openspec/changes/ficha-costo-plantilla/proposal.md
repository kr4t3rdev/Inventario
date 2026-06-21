# Proposal: Plantilla de ficha de costo

## Resumen Ejecutivo
Persistir plantillas versionadas de ficha de costo por producto para sugerir precios de venta sin modificar la verdad operativa actual.

## Contexto
Hoy la ficha es on-demand y no existe entidad de plantilla. `ProductoCostHistory` audita precios pero no composición. `Receta` modela materiales sin pricing. Existen patrones de versionado (`ContratoVersion`, `SnapshotPeriodo`) y "único default" (`ListaPrecio.esDefault`) reutilizables.

## Objetivo
- Guardar composición de costo (materiales + MO + indirectos + margen objetivo).
- Versionar: "v1.0", "v1.1".
- Activar/desactivar versiones (una activa por producto).
- Sugerir precio de venta: `costoTotal / (1 - margenObjetivo)`.
- Comparar ficha actual vs plantilla activa en UI.
- Aplicar precio sugerido a `Producto.precioVenta` mediante acción explícita.

## Alcance

### In Scope
- Schema Prisma: nuevo modelo `ProductoCostSheetTemplate`.
- Server Actions: CRUD plantillas, activar versión, calcular precio sugerido.
- UI: pestaña "Plantilla" en `ficha-costo-view` + card en Resumen.
- Tests unitarios e integración (TDD strict).

### Out of Scope
- Automatización de aplicación de precios (solo sugerencia).
- Cambios a `ProductoCostHistory` o `Receta`.
- Reportes avanzados de comparación histórica.

## Arquitectura Propuesta

### Modelo Prisma
```prisma
model ProductoCostSheetTemplate {
  templateId     String   @id @default(cuid())
  productoId     String
  tenantId       String
  version        Int
  nombre         String
  esActiva       Boolean  @default(false)
  materiales     Json     // [{ productoId, cantidad, costoUnitario }]
  manoObra       Decimal
  indirectos     Decimal
  margenObjetivo Decimal
  costoTotal     Decimal
  precioSugerido Decimal
  notas          String?
  createdAt      DateTime @default(now())
  createdBy      String
  producto       Producto @relation(fields: [productoId], references: [productoId])
  tenant         Tenant   @relation(fields: [tenantId], references: [tenantId])
  creador        User     @relation(fields: [createdBy], references: [userId])

  @@unique([productoId, version])
  @@unique([productoId, esActiva])
  @@index([tenantId])
}
```

### Server Actions
- `getPlantillasAction(productoId)` — listar versiones.
- `createPlantillaAction(input)` — crear nueva versión (auto-incremental).
- `activarPlantillaAction(templateId)` — set `esActiva=true` para una y `false` para el resto del producto.
- `calcularPrecioSugeridoAction(templateId)` — recalcular y retornar.
- `aplicarPrecioSugeridoAction(productoId, templateId)` — actualizar `Producto.precioVenta` explícitamente.

### UI
- Nueva pestaña "Plantilla" en `ficha-costo-view.tsx`.
- Tabla de versiones con badge "Activa".
- Botones: "Activar", "Calcular precio sugerido", "Aplicar a precio venta".
- Card en `resumen-costo.tsx` con comparación ficha actual vs plantilla activa.

## Consideraciones Técnicas
- Multi-tenant estricto: todas las queries filtran por `tenantId`.
- Desacoplada de `Producto.precioVenta`: la plantilla solo sugiere; la aplicación es acción explícita.
- Reutilizar patrón `@@unique([productoId, esActiva])` similar a `ListaPrecio.esDefault`.
- Versionado secuencial con `version` Int para simplificar.
- JSON para materiales para flexibilidad sin nueva tabla relacional.
- Transacción Prisma en `activarPlantillaAction` para garantizar unicidad de activa.

## Criterios de Aceptación
- [ ] Se puede crear una plantilla con composición de costo y margen.
- [ ] El sistema calcula `costoTotal` y `precioSugerido` correctamente.
- [ ] Solo una plantilla activa por producto; activar otra desactiva la anterior.
- [ ] La UI muestra comparación ficha actual vs plantilla activa.
- [ ] La aplicación de precio sugerido a `precioVenta` requiere confirmación explícita.
- [ ] Cobertura de tests > 80% en nuevos archivos.

## Riesgos

| Riesgo | Probabilidad | Mitigación |
|--------|--------------|------------|
| Race condition al activar versión | Baja | Transacción Prisma con `@@unique([productoId, esActiva])` |
| Divergencia entre plantilla y ficha on-demand | Media | UI de comparación clara y recálculo manual |
| Acoplamiento accidental a precios operativos | Baja | Acción explícita separada; sin triggers |

## Dependencias
- Ninguna externa. Requiere migración Prisma y posibles seeds de permisos.
