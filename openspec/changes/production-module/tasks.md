# Tasks: Módulo de Producción

## Phase 1: Infrastructure / Base de Datos

- [x] 1.1 Modificar `prisma/schema.prisma` - Agregar campo `productoId` opcional al modelo `Receta`
- [x] 1.2 Modificar `prisma/schema.prisma` - Crear nuevo modelo `ValeSalida` con campos: valeSalidaId, concepto, observaciones, estado, createdAt, updatedAt, usuarioId
- [x] 1.3 Modificar `prisma/schema.prisma` - Crear modelo `ValeSalidaItem` con campos: valeSalidaItemId, valeSalidaId, productoId, cantidad
- [x] 1.4 Modificar `prisma/schema.prisma` - Crear modelo `OrdenProduccionHistorial` con campos: historialId, ordenProduccionId, estadoAnterior, estadoNuevo, observaciones, usuarioId, createdAt
- [x] 1.5 Ejecutar `npx prisma generate` para actualizar el cliente de Prisma
- [x] 1.6 Ejecutar `npx prisma db push` para crear las nuevas tablas en la base de datos

## Phase 2: Modelos y Tipos TypeScript

- [x] 2.1 Modificar `src/app/models/model.ts` - Agregar enum `EstadoProduccion` con valores: pendiente, en_proceso, completada, cancelada
- [x] 2.2 Modificar `src/app/models/model.ts` - Agregar enum `EstadoValeSalida` con valores: pendiente, completada, anulada
- [x] 2.3 Modificar `src/app/models/model.ts` - Agregar tipo `ValeSalida` con campos del modelo Prisma
- [x] 2.4 Modificar `src/app/models/model.ts` - Agregar tipo `ValeSalidaItem` 
- [x] 2.5 Modificar `src/app/models/model.ts` - Agregar tipo `RecetaProduccion` extendiendo receta con productoId
- [x] 2.6 Modificar `src/app/models/model.ts` - Agregar tipo `OrdenProduccion`
- [x] 2.7 Modificar `src/app/models/model.ts` - Agregar tipo `OrdenProduccionHistorial`

## Phase 3: API Routes - Recetas

- [x] 3.1 Crear `src/app/api/produccion/recetas/route.ts` - GET listar recetas con filtro search, POST crear receta
- [x] 3.2 Crear `src/app/api/produccion/recetas/[id]/route.ts` - GET obtener receta, PATCH actualizar, DELETE eliminar
- [x] 3.3 Crear `src/app/api/produccion/recetas/[id]/ingredientes/route.ts` - POST agregar/actualizar ingredientes de receta

## Phase 4: API Routes - Órdenes de Producción

- [x] 4.1 Crear `src/app/api/produccion/ordenes/route.ts` - GET listar órdenes con filtro estado, POST crear orden
- [x] 4.2 Crear `src/app/api/produccion/ordenes/[id]/route.ts` - GET obtener orden específica
- [x] 4.3 Crear `src/app/api/produccion/ordenes/[id]/aprobar/route.ts` - POST aprobar orden, reservar materiales (decrementar stock ingredientes), crear historial
- [x] 4.4 Crear `src/app/api/produccion/ordenes/[id]/completar/route.ts` - POST completar orden, incrementar stock producto terminado, calcular costos, crear registro en ReconciliacionGasto, crear historial
- [x] 4.5 Crear `src/app/api/produccion/ordenes/[id]/cancelar/route.ts` - POST cancelar orden, liberar materiales reservados, crear historial

## Phase 5: API Routes - Vales de Salida

- [x] 5.1 Crear `src/app/api/produccion/conceptos/route.ts` - GET obtener tipos de GastosDE para usar como conceptos
- [x] 5.2 Crear `src/app/api/produccion/vales/route.ts` - GET listar vales, POST crear vale (validar stock, decrementar inventario)
- [x] 5.3 Crear `src/app/api/produccion/vales/[id]/route.ts` - GET obtener vale, PATCH actualizar, DELETE anular
- [x] 5.4 Crear `src/app/api/produccion/vales/[id]/pdf/route.ts` - GET generar PDF del vale

## Phase 6: Redux Toolkit - API Slice

- [x] 6.1 Crear `src/lib/redux/services/produccionApi.ts` - Crear endpoints RTK Query para recetas
- [x] 6.2 Crear `src/lib/redux/services/produccionApi.ts` - Agregar endpoints para órdenes de producción
- [x] 6.3 Crear `src/lib/redux/services/produccionApi.ts` - Agregar endpoints para vales de salida
- [x] 6.4 Crear `src/lib/redux/services/produccionApi.ts` - Agregar endpoint para obtener conceptos
- [x] 6.5 Modificar `src/lib/redux/store.tsx` - Agregar `produccionApi` al store

## Phase 7: Componentes UI - Estructura

- [x] 7.1 Crear directorio `src/components/produccion/`
- [x] 7.2 Modificar `src/components/app-sidebar2.tsx` - Agregar enlace al módulo de producción

## Phase 8: Componentes UI - Recetas

- [x] 8.1 La funcionalidad de listas ya está integrada en la página principal
- [x] 8.2 Los formularios de recetas ya están integrados en la página principal

## Phase 9: Componentes UI - Órdenes de Producción

- [x] 9.1 La funcionalidad de listas ya está integrada en la página principal
- [x] 9.2 Los formularios de órdenes ya están integrados en la página principal

## Phase 10: Componentes UI - Vales de Salida

- [x] 10.1 La funcionalidad de listas ya está integrada en la página principal
- [x] 10.2 Los formularios de vales ya están integrados en la página principal

## Phase 11: Página Principal

- [x] 11.1 Crear `src/app/busy/produccion/page.tsx` - Página principal del módulo con layout de tabs
- [x] 11.2 El componente principal está integrado en la página

## Phase 12: Integración Contabilidad

- [x] 12.1 La integración con ReconciliacionGasto ya está implementada en el endpoint de completar orden

## Phase 13: Testing

- [x] 13.1 Crear test unitario para función `calcularCostoProduccion` en `src/lib/utils/produccion.ts`
- [x] 13.2 Crear test unitario para función `validarDisponibilidadMateriales`
- [x] 13.3 Crear test de integración para endpoint POST crear receta
- [x] 13.4 Crear test de integración para endpoint POST aprobar orden
- [x] 13.5 Crear test de integración para endpoint POST completar orden
- [x] 13.6 Crear test de integración para endpoint POST crear vale

## Phase 14: Verificación

- [x] 14.1 Verificar que las recetas del restaurante existentes siguen funcionando
- [x] 14.2 Verificar flujo completo: crear receta → crear orden → aprobar → completar
- [x] 14.3 Verificar flujo de vale: crear vale → validar decremento stock
- [x] 14.4 Verificar generación de PDF de vale
- [x] 14.5 Verificar integración con contabilidad (ReconciliacionGasto)
- [x] 14.6 Verificar historial de cambios de estado
