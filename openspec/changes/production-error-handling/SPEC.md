# Production Module: Error Handling & State Consistency

**Status**: Specification Phase  
**Last Updated**: 2026-04-09  
**Author**: SDD Workflow

## Goal

Implementar un sistema robusto de manejo de errores en el módulo de producción con notificaciones al usuario mediante sileo, corregir inconsistencias en enums de estado, y resolver problemas de conversión de unidades entre el módulo y catálogo de productos.

## Scope

### In Scope
1. **Error Handling Frontend**: Agregar try-catch + sileo notifications
2. **State Enum Consistency**: Normalizar UPPERCASE en UI, API y comparaciones
3. **Filter Implementation**: Corregir mismatch de estados en Select options
4. **Unit Conversion Validation**: Validar inconsistencias de unidades
5. **Backend Validation**: Agregar validación en `completar` endpoint

### Out of Scope
- Rediseño de UI/UX
- Cambios a schema Prisma (enums ya están bien definidos)
- Migración de sonner a sileo en otros módulos
- Ampliar VOLUME_UNITS (será en próxima mejora)

## Scenarios

### Scenario 1: Aprobar Orden con Materiales Insuficientes
**Given**: Usuario está en la pantalla de órdenes de producción  
**When**: Hace click en "Aprobar" para una orden, pero faltan materiales  
**Then**:
- ✅ El sistema valida stock en backend
- ✅ Retorna error con lista de productos faltantes
- ✅ Frontend captura error en try-catch
- ✅ Muestra toast sileo.error() con detalles (producto + cantidad faltante)
- ✅ La orden mantiene estado PENDIENTE
- ✅ Stock no es modificado

**Data Expected**:
```json
{
  "error": "Materiales insuficientes.",
  "materialesFaltantes": [
    {
      "productoId": "prod-1",
      "productoNombre": "Azúcar",
      "requerido": 50,
      "disponible": 30
    }
  ]
}
```

### Scenario 2: Filtrar Órdenes por Estado
**Given**: Usuario está en tab "Órdenes de Producción"  
**When**: Selecciona un filtro de estado desde el Select (ej: "En Proceso")  
**Then**:
- ✅ El Select muestra opciones legibles: "Pendiente", "En Proceso", etc.
- ✅ El valor enviado al API es UPPERCASE: "PENDIENTE", "EN_PROCESO", etc.
- ✅ La query ejecuta correctamente con parámetro estado=EN_PROCESO
- ✅ Solo se muestran órdenes que coinciden exactamente con el estado
- ✅ Cuando filtro="all", muestra todas las órdenes

### Scenario 3: Completar Orden con Validación de Stock
**Given**: Una orden está en estado EN_PROCESO  
**When**: Usuario hace click en "Completar"  
**Then**:
- ✅ Backend valida que el producto final existe
- ✅ Backend incrementa stock del producto
- ✅ Si hay error (producto no existe), retorna 400 con detalles
- ✅ Frontend captura error y muestra sileo.error()
- ✅ La orden transiciona a COMPLETADA si es exitoso
- ✅ Toast sileo.success() confirma

### Scenario 4: Cancelar Orden
**Given**: Una orden está PENDIENTE o EN_PROCESO  
**When**: Usuario hace click en "Cancelar"  
**Then**:
- ✅ Sistema pide confirmación
- ✅ Si había materiales reservados (EN_PROCESO), los libera al inventario
- ✅ Estado cambia a CANCELADA
- ✅ Toast sileo.success() confirma cancelación
- ✅ Si hay error, muestra sileo.error() con detalles

### Scenario 5: Badge de Estado Muestra Correctamente
**Given**: Una orden tiene estado PENDIENTE en base de datos  
**When**: Se carga la lista de órdenes  
**Then**:
- ✅ El badge muestra "Pendiente" (label legible)
- ✅ El icono y color son consistentes según estado
- ✅ No hay variaciones en case (no mezcla PENDIENTE + Pendiente)

## Validation Rules

1. **Estado Enum Validation**:
   - Todos los valores de estado siempre UPPERCASE en:
     - Base de datos
     - Comparaciones en backend
     - Parámetros de URL
     - Respuestas JSON
   
2. **Select Options Normalization**:
   - SelectItem value debe coincidir exactamente con enum
   - Display text puede ser legible (ej: "En Proceso" para "EN_PROCESO")
   
3. **Error Response Format**:
   - Status 400 con `error: string` y opcional `materialesFaltantes: array`
   - Detalles suficientes para mostrar en toast: producto, cantidad requerida, disponible

4. **Toast Notification Requirements**:
   - Usar sileo en lugar de console.log para errores
   - Título claro + descripción con detalles específicos
   - Errors: rojo, Success: verde, Warning: amarillo
   - Duration ~3-5 segundos

5. **Unit Consistency**:
   - Si producto catalogo usa "kg", ingrediente debe especificar "kg"
   - convertToBase() debe manejar conversión correctamente
   - Math.ceil() para redondear al alza (consumir stock conservador)

## Success Criteria

- [ ] Todos los handlers en page.tsx tienen try-catch + sileo
- [ ] Estados en filter Select usan valores UPPERCASE
- [ ] Badge no muestra estados con case mixto
- [ ] Error "Materiales insuficientes" muestra detalles en toast
- [ ] Endpoint completar/route.ts valida stock antes de actualizar
- [ ] Conversiones de unidad funcionan sin errores de tipo
- [ ] Tests E2E para los 5 scenarios pasan sin warnings

## Technical Notes

- **Sileo Setup**: Ya existe `src/lib/sileo-shim.ts` y está importado globalmente
- **RTK Query**: Los hooks ya existen, solo necesitan error handling en UI
- **Unit Converter**: Función `convertToBase()` en `src/lib/utils/unit-converter.ts`
- **Enum**: `EstadoProduccion` en `prisma/schema.prisma` line 1507
