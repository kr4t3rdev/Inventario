# Tasks: Configuración de producto de salida para producción

## Phase 1: Definición y validaciones

- [x] 1.1 Revisar el contrato actual de creación de productos reutilizable desde producción
- [x] 1.2 Definir el modo de selección de salida (`existing` vs `create`) en la UI de recetas
- [x] 1.3 Agregar validación para impedir que una receta productiva quede sin `productoId`

## Phase 2: UI de recetas de producción

- [x] 2.1 Actualizar `src/app/busy/produccion/page.tsx` para mostrar las dos opciones de producto de salida
- [x] 2.2 Mantener el selector actual para elegir un producto existente del catálogo
- [x] 2.3 Integrar el formulario o flujo reutilizable para crear un producto nuevo desde la receta
- [x] 2.4 Asociar automáticamente el producto recién creado a la receta sin re-selección manual
- [x] 2.5 Mostrar estado claro para recetas legacy sin producto de salida configurado

## Phase 3: API y coordinación de flujo

- [x] 3.1 Ajustar el flujo de guardado para crear primero el producto nuevo cuando corresponda
- [x] 3.2 Persistir la receta usando el `productoId` creado o seleccionado
- [x] 3.3 Bloquear operaciones productivas que dependan de receta completa cuando falte `productoId`

## Phase 4: Testing

- [x] 4.1 Agregar tests del flujo “usar producto existente”
- [x] 4.2 Agregar tests del flujo “crear producto nuevo”
- [x] 4.3 Agregar test de falla al crear producto y verificar que la receta no quede enlazada incorrectamente
- [x] 4.4 Agregar test para receta legacy sin producto de salida en flujo operativo

## Phase 5: Verificación funcional

- [ ] 5.1 Verificar crear receta con producto existente
- [ ] 5.2 Verificar crear producto nuevo desde receta y asociación automática
- [ ] 5.3 Verificar completar orden sin cambios cuando la receta está bien configurada
- [ ] 5.4 Verificar mensajes de recuperación para recetas incompletas
