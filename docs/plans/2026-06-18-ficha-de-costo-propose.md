# Propuesta: Módulo Ficha de Costo

## Intent

Consolidar datos de costo dispersos (Producto.precioCosto, Receta.costoUnitario, CompraDocumentoItem, ProductoCostHistory) en una vista unificada de ficha de costo. Hoy no existe entidad ni cálculo que responda "¿cuánto me cuesta este producto?" de forma completa. El usuario necesita ver composición de costo, historial y margen en un solo lugar para tomar decisiones de pricing y producción.

## Scope

### In Scope
- Vista calculada de ficha de costo para productos simples (CPP desde compras)
- Vista calculada para productos compuestos (materiales + mano de obra + indirectos)
- Historial de costos de compra con trazabilidad
- Cálculo de margen actual vs precio de venta
- Exportación a PDF
- Link de navegación desde ficha de producto

### Out of Scope
- Persistencia de ficha como entidad (FichaCosto model) — se pospone
- Costo estándar vs real (comparativa planificada/ejecutada)
- Integración con contabilidad para cierres de período
- Actualización automática de precioCosto al registrar compras
- Gestión de listas de precios desde la ficha

## Approach

**Arquitectura**: Vista calculada on-demand, sin nuevo modelo Prisma. Los Server Actions consultan datos existentes y calculan en vuelo.

**Cálculos clave**:
- **Productos simples**: CPP = Σ(cantidad × precioUnitario + gastos proporcional) / Σ(cantidad) desde CompraDocumentoItem + GastoCompra
- **Productos compuestos**: Σ(ingrediente.cantidad × CPP_ingrediente) + manoDeObra + indirectos
- **Margen**: (precioVenta - costoCalculado) / precioVenta × 100

**Estructura**:
```
src/features/ficha-costo/
├── actions.ts              # getFichaCostoAction, getHistorialCostosAction
├── lib/cost-calculator.ts  # Lógica pura de cálculo CPP y composición
├── components/
│   ├── ficha-costo-view.tsx    # Vista principal con tabs
│   ├── historial-costos.tsx    # Timeline de costos
│   ├── composicion-costo.tsx   # Desglose materiales/MO/indirectos
│   └── ficha-costo-pdf.tsx     # Exportación PDF
```

**Integración**: Ruta `/busy/productos/[id]/ficha-costo` + botón en vista de producto.

## Affected Areas

| Area | Impact | Description |
|------|--------|-------------|
| `src/features/ficha-costo/` | New | Módulo completo |
| `src/app/busy/productos/[id]/` | Modified | Agregar link a ficha |
| `src/features/productos/actions.ts` | None | Solo lectura, sin cambios |
| `prisma/schema.prisma` | None | Sin nuevos modelos |

## Risks

| Risk | Likelihood | Mitigation |
|------|------------|------------|
| Compras registradas en monedas mixtas (CUP/USD) | High | Normalizar con tasa de cambio del período (Contabilidad ya tiene ExchangeRate) |
| CPP incorrecto si hay compras sin GastoCompra asociado | Medium | Documentar que gastos deben registrarse; warning en UI si faltan |
| Performance en productos con +1000 compras | Low | Paginación en historial; límite de 12 meses para CPP |
| Mano de obra / indirectos sin modelo de datos | Medium | MVP: campos manuales en ficha (input), no persistencia. Se modelan en fase 2 |
| Redondeo en cálculos monetarios | Medium | Usar Decimal de Prisma, redondear a 2 decimales al render |

## Rollback Plan

El módulo es 100% aditivo (nuevos archivos, sin modificar schema ni actions existentes). Rollback = borrar `src/features/ficha-costo/` y revertir el link en la vista de producto. Zero data migration risk.

## Success Criteria

- [ ] Ficha muestra CPP correcto para producto simple con ≥1 compra registrada
- [ ] Ficha muestra desglose materiales + MO + indirectos para producto compuesto
- [ ] Historial muestra timeline de costos de compra con fechas y montos
- [ ] Margen calculado coincide con cálculo manual (precioVenta - CPP) / precioVenta
- [ ] PDF exportable contiene todos los datos de la ficha
- [ ] Multi-tenant: ficha solo muestra datos del tenant del usuario autenticado
- [ ] Cálculo responde en <2s para producto con hasta 500 registros de compra
