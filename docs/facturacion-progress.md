# Módulo de Facturación - Plan de Implementación

## ✅ **Implementado (25/01/2025)**

### **Funcionalidades Base**
1. **Modelo Factura** (`prisma/schema.prisma:1128-1163`)
   - Relación 1:1 opcional con `Venta`
   - Campo `numeroConsecutivo` autoincremental
   - Campo `numeroFactura` único con formato `{prefijo}-{consecutivo}`
   - Estados: `PENDIENTE`, `PAGADA`, `ANULADA`, `VENCIDA`
   - Campos completos: subtotal, impuestos, descuento, total, términos de pago, método de pago

2. **Creación automática de facturas** (`src/app/api/ventas/route.ts:69-97`)
   - Cuando una venta incluye `clienteId`, se crea automáticamente una factura
   - Generación del número usando serie por defecto "SD"
   - Soporte para ventas únicas múltiples
   - Auditoría: campos `creadoPor`, `actualizadoPor`

3. **Series de facturación** ✅ COMPLETADO (24/01/2025)
   - Modelo `SerieFacturacion` con campos: `prefijo`, `descripcion`, `consecutivo`, `activa`, `esPorDefecto`
   - Relación uno-a-muchos: `SerieFacturacion` → `Factura`
   - API automáticamente crea serie por defecto "SD" si no existe
   - Numeración: `{prefijo}-{consecutivo}` (ej: `SD-1`, `SD-2`)
   - Consecutivo se incrementa automáticamente después de cada factura
   - UI para gestión de series en `/busy/configuracion/series-facturacion`

### **Gestión de Facturas**
4. **API de gestión de facturas** (`src/app/api/facturas/`)
   - `GET /api/facturas` - Listado con paginación, filtros (estado, cliente, serie, fechas, búsqueda)
   - `GET /api/facturas/[id]` - Obtener factura específica con relaciones completas
   - `PATCH /api/facturas/[id]` - Actualizar estado, tipoDocumento, fechas, observaciones
   - `DELETE /api/facturas/[id]` - Eliminar facturas no vinculadas a ventas
   - `POST /api/facturas` - Crear facturas manualmente (sin venta asociada)

5. **Integración Redux** (`src/lib/redux/services/facturasApi.tsx`)
   - Endpoints RTK Query para todas las operaciones CRUD
   - Tipos TypeScript actualizados con `tipoDocumento`
   - Tags para invalidación automática de cache

6. **UI de gestión de facturas** (`src/app/busy/facturas/page.tsx`)
   - Página dedicada para gestión completa de facturas
   - Tabla con columnas: número factura, cliente, fechas, total, estado, venta relacionada, acciones
   - Filtros por estado y búsqueda textual
   - Paginación integrada con API
   - Resumen por estado con totales monetarios

7. **Componentes de estado** (`src/components/facturas/`)
   - `EstadoFacturaBadge` - Badge colorizado para cada estado
   - `ActualizarEstadoFactura` - Dropdown interactivo para cambiar estado (PENDIENTE → PAGADA → ANULADA → VENCIDA)

### **Migración y Compatibilidad**
8. **Migración de endpoints PDF/Excel** (`src/app/api/facturas/[id]/pdf/route.ts`, `src/app/api/facturas/[id]/excel/route.ts`)
   - Endpoints ahora usan datos de `Factura` cuando están disponibles
   - Mantienen compatibilidad con ventas sin factura
   - Números de factura correctos en documentos generados
   - Actualización de UI para nombres de archivo usando `numeroFactura`

9. **Extensión del modelo** (`prisma/schema.prisma:1141-1146`, `src/app/models/model.ts`)
   - Nuevo enum `TipoDocumento`: `FACTURA`, `NOTA_CREDITO`, `FACTURA_RECTIFICATIVA`, `PROFORMA`
   - Campo `tipoDocumento` en modelo `Factura` con valor por defecto `FACTURA`
   - Actualización de interfaces TypeScript y validaciones Zod

---

## 📋 **Plan de Implementación - Próximas Funcionalidades**

### 1. **Series de facturación** ✅ COMPLETADO (24/01/2025)
**Objetivo:** Permitir múltiples series de facturación (ej: `SD-` ventas, `FA-` servicios, `NC-` notas crédito)
- [x] Crear modelo `SerieFacturacion` en Prisma
- [x] Relacionar `Factura` con `SerieFacturacion`
- [x] Modificar API para usar serie por defecto `SD`
- [x] Interfaz para gestionar series (CRUD)
- [x] Selector de serie en interfaz POS

**Detalles implementados:**
- Modelo `SerieFacturacion` con campos: `prefijo`, `descripcion`, `consecutivo`, `activa`, `esPorDefecto`
- Relación uno-a-muchos: `SerieFacturacion` → `Factura`
- API automáticamente crea serie por defecto "SD" si no existe
- Numeración: `{prefijo}-{consecutivo}` (ej: `SD-1`, `SD-2`)
- Consecutivo se incrementa automáticamente después de cada factura

### 2. **Documentos relacionados** 🔄 EN PROGRESO
**Objetivo:** Soporte para notas de crédito, facturas rectificativas y proformas
- [x] Extender modelo `Factura` con tipo de documento
- [ ] Crear modelos relacionados: `NotaCredito`, `FacturaRectificativa`
- [ ] Flujos de conversión entre documentos
- [ ] Validaciones de integridad referencial

### 3. **Funcionalidades de impresión y envío**
**Objetivo:** Mejorar generación y distribución de documentos
- [ ] Plantillas personalizables por tipo de cliente/industria
- [ ] Envío automático por email con PDF adjunto
- [ ] Firma electrónica y validación legal
- [ ] Historial de versiones de cada factura

### 4. **Integración contable**
**Objetivo:** Automatizar procesos contables relacionados con facturación
- [ ] Asientos automáticos en libro diario
- [ ] Conciliación automática con pagos recibidos
- [ ] Reportes fiscales: IVA, retenciones, declaraciones
- [ ] Exportación a formatos (XML, JSON para SAT/SII)

### 5. **Gestión de vencimientos**
**Objetivo:** Mejorar seguimiento de cuentas por cobrar
- [ ] Recordatorios automáticos de pago
- [ ] Cálculo de intereses por mora
- [ ] Estadísticas de cobranza por cliente
- [ ] Dashboard de cuentas por cobrar envejecidas

### 6. **Validaciones y controles**
**Objetivo:** Asegurar integridad y cumplimiento normativo
- [ ] Límites de crédito por cliente
- [ ] Secuencia numérica validada contra autoridad fiscal
- [ ] Backup y archivado de facturas electrónicas
- [ ] Auditoría completa de cambios

---

## 🚀 **Próximos pasos inmediatos**
1. Implementar flujos de conversión entre tipos de documento (factura → nota crédito)
2. Crear plantillas personalizables para impresión
3. Implementar envío automático por email con PDF adjunto
4. Integración con cuentas por cobrar y recordatorios de pago

---

## 📊 **Métricas de Progreso**
- **Total funcionalidades:** 6
- **Completadas:** 1 (16.7%)
- **En progreso:** 1 (16.7%)
- **Pendientes:** 4 (66.6%)

*Última actualización: 25/01/2025*