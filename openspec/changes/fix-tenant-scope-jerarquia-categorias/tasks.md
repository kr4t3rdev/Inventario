# Tasks: Tenant isolation en jerarquía de categorías

## Phase 1: Corregir Server Action

- [ ] 1.1 Agregar `const tenantId = requireTenant(user)` en `getCategoriaHierarchyAction` (reemplazar `_user` por `user`)
- [ ] 1.2 Agregar `where: { tenantId }` en el `prisma.categoria.findMany` dentro de `getCategoriaHierarchyAction`

## Phase 2: Actualizar test

- [ ] 2.1 En el test `'retorna jerarquía de categorías del tenant'`, agregar aserción que verifique que `prisma.categoria.findMany` fue llamado con `where: { tenantId: 'tenant-test' }`

## Phase 3: Verificación

- [ ] 3.1 Ejecutar `pnpm run test:run` para confirmar que todos los tests pasan
- [ ] 3.2 Ejecutar `pnpm run lint` para verificar estilo de código
