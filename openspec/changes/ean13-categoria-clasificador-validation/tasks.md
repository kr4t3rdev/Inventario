# Tasks: Validación de categorías y subcategorías contra CLAS en modo EAN-13

## Phase 1: Foundation

- [x] 1.1 Agregar en `src/lib/clas-classifier.ts` helpers que, dada una sección o categoría CLAS, devuelvan solo las subcategorías o específicos correspondientes.
- [x] 1.2 Agregar en `src/lib/categoria-validation.ts` una validación condicional que consulte `prisma.miEmpresa` y determine si aplica rigor CLAS según `usaCodigoEan13`.
- [x] 1.3 Reutilizar el clasificador oficial en ese validator para aceptar solo parejas categoría/subcategoría que pertenezcan a la misma rama oficial.

## Phase 2: Client Guided Selection

- [x] 2.1 Ajustar `src/components/categorias/category-form.tsx` para mostrar dos selects en modo EAN-13: categoría/sección primero y subcategoría/específico después.
- [x] 2.2 Ajustar `src/hooks/use-category-form.ts` para recalcular el segundo select cuando cambie el primero y limpiar selecciones obsoletas.
- [x] 2.3 Enviar desde el formulario ambos valores seleccionados, categoría y subcategoría, cuando el usuario confirme una rama válida del clasificador.
- [x] 2.4 Emitir en el hook los toasts exactos de negocio cuando la categoría o la subcategoría no correspondan a CLAS, sin hacer la llamada a `fetch`.
- [x] 2.5 Crear un formulario dedicado para subcategorías basado en categorías ya existentes y exponerlo desde el listado de categorías.

## Phase 3: Server Enforcement

- [x] 3.1 Extender `validateCategoryCreation` y `validateCategoryUpdate` en `src/lib/categoria-validation.ts` para rechazar combinaciones categoría/subcategoría fuera de CLAS sólo con EAN-13 ON.
- [x] 3.2 Ajustar `src/lib/categoria-errors.ts` o la traducción de errores para que el backend devuelva una validación clara y consistente cuando falle la regla CLAS.
- [x] 3.3 Verificar `src/app/api/categorias/route.ts` y `src/app/api/categorias/[id]/route.ts` para asegurar que la nueva validación quede cubierta en create y update sin romper jerarquía/nombre único.

## Phase 4: Tests And Verification

- [x] 4.1 Crear test unitario focalizado para `src/lib/clas-classifier.ts` cubriendo filtrado del segundo select según la categoría o sección elegida.
- [x] 4.2 Crear test unitario focalizado para `src/lib/categoria-validation.ts` cubriendo: combinación inválida ON, combinación válida ON, y bypass permitido OFF.
- [x] 4.3 Crear test focalizado del flujo de parser/validación para confirmar que el segundo select se refresca, se envían ambos valores y la rama inválida no pasa.
- [x] 4.4 Ejecutar validación acotada del slice tocado con tests/lint y confirmar que el alta inválida deja de llegar al flujo de productos.

## Phase 5: First EAN-13 Surtido Starts At 0000

- [ ] 5.1 Ajustar `src/lib/ean13-utils.ts` para que `FindNextAvailableSurtido()` devuelva `0000` cuando no existan productos para la pareja sección/específico.
- [ ] 5.2 Revisar `src/lib/product-business-code.ts` y `src/components/productos/productos-form.tsx` para alinear el preview del código EAN-13 con el nuevo baseline `0000`.
- [ ] 5.3 Verificar `src/app/api/productos/route.ts` para que la generación real del primer producto use el nuevo surtido base sin romper el incremento posterior.
- [ ] 5.4 Actualizar tests de surtido y de generación de productos para cubrir el caso vacío con `0000` y el incremento `0000 -> 0001`.
- [ ] 5.5 Ejecutar validación acotada del slice de productos/EAN-13 y confirmar que no quedan expectativas duras en `0001` para la primera variante.