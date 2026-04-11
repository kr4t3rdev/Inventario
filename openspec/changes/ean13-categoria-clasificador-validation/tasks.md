# Tasks: Validación de categorías y subcategorías contra CLAS en modo EAN-13

## Phase 1: Foundation

- [ ] 1.1 Agregar en `src/lib/categoria-validation.ts` una validación condicional que consulte `prisma.miEmpresa` y determine si aplica rigor CLAS según `usaCodigoEan13`.
- [ ] 1.2 Reutilizar `mapCategoryToSection` y `mapSubcategoryToSpecific` en ese validator para distinguir categoría raíz (`parentId` vacío) de subcategoría (`parentId` con valor).

## Phase 2: Client Guardrails

- [ ] 2.1 Ajustar `src/hooks/use-category-form.ts` para ejecutar validación CLAS antes de la validación remota y abortar submit cuando falle.
- [ ] 2.2 Emitir en el hook los toasts exactos de negocio para categoría y subcategoría inválidas, sin hacer la llamada a `fetch`.
- [ ] 2.3 Pasar desde `src/components/categorias/category-form.tsx` el contexto mínimo necesario (`usaEan13` y tipo raíz/subcategoría si aplica) para que el hook no adivine estado de UI.

## Phase 3: Server Enforcement

- [ ] 3.1 Extender `validateCategoryCreation` y `validateCategoryUpdate` en `src/lib/categoria-validation.ts` para rechazar nombres fuera de CLAS sólo con EAN-13 ON.
- [ ] 3.2 Ajustar `src/lib/categoria-errors.ts` o la traducción de errores para que el backend devuelva una validación clara y consistente cuando falle la regla CLAS.
- [ ] 3.3 Verificar `src/app/api/categorias/route.ts` y `src/app/api/categorias/[id]/route.ts` para asegurar que la nueva validación quede cubierta en create y update sin romper jerarquía/nombre único.

## Phase 4: Tests And Verification

- [ ] 4.1 Crear test unitario focalizado para `src/lib/categoria-validation.ts` cubriendo: root inválida ON, subcategoría inválida ON, y bypass permitido OFF.
- [ ] 4.2 Crear test focalizado del flujo de submit del formulario o hook para confirmar que el toast exacto aparece y que no se dispara la llamada API.
- [ ] 4.3 Ejecutar validación acotada del slice tocado con tests/lint y confirmar que el alta inválida deja de llegar al flujo de productos.