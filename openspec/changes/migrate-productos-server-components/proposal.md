# Proposal: Migrar Productos a Server Components

## Intent

La feature de Productos todavía mezcla datos, mutaciones y UI client-side. Además, tiene issues concretos que bloquean una migración limpia: `RestockHistoryDialog` depende de un hook RTK Query inexistente y `updateProductoAction` no protege escrituras relacionadas con una transacción. Este cambio busca limpiar primero esos puntos débiles y luego migrar la página de Productos a una arquitectura server-first real, donde el server resuelva datos y el cliente conserve solo la interactividad necesaria.

## Scope

### In Scope
- Corregir `RestockHistoryDialog` para que deje de depender de un hook inexistente y obtenga datos desde una fuente server/shared.
- Encapsular `updateProductoAction` en una transacción de Prisma para garantizar atomicidad.
- Convertir `/busy/products` a Server Component para la obtención inicial de datos.
- Resolver en server los catálogos y datos base usados por `ProductosForm`.
- Mantener como Client Components solo la UI interactiva: formularios, tabla, filtros y dialogs.
- Reducir o eliminar dependencias RTK Query específicas de Productos cuando ya no aporten valor.

### Out of Scope
- Reescribir toda la feature de Productos de una sola vez.
- Convertir `ProductosForm` en Server Component completo.
- Migrar otras features no relacionadas con Productos.
- Eliminar API routes legacy que todavía tengan consumidores fuera de esta migración.

## Approach

La migración se hará por etapas:

1. **Cleanup previo**: arreglar el historial de restock y la inconsistencia transaccional.
2. **Server-first listing**: mover la carga inicial de `/busy/products` al server y pasar props al árbol client.
3. **Client islands**: conservar en cliente solo la interactividad local (React Hook Form, tabla, modales, toasts).
4. **Depuración final**: retirar RTK Query residual de Productos y validar que el bundle cliente se reduzca.

La regla arquitectónica será: **datos y reglas en server; interacción rica en client**.

## Affected Areas

| Area | Impact | Description |
|------|--------|-------------|
| `src/app/busy/products/page.tsx` | Modified | Convertir a Server Component y resolver datos iniciales en server |
| `src/features/productos/actions.ts` | Modified | Hacer atómica `updateProductoAction` y ajustar helpers de historial |
| `src/features/productos/components/restock-history-dialog.tsx` | Modified | Eliminar dependencia de hook inexistente y separar fetch/UI |
| `src/features/productos/components/restock-history.tsx` | Modified | Hacerlo consumible con data server-side |
| `src/features/productos/components/productos-form.tsx` | Modified | Recibir catálogos/datos base desde server sin fetch client-side |
| `src/features/productos/components/enhanced-data-table.tsx` | Modified | Mantener UI interactiva como client island |
| `src/features/productos/components/product-filters.tsx` | Modified | Mantener filtros interactivos, idealmente con data precargada |
| `src/features/productos/api/*` | Modified/Removed | Reducir o eliminar RTK Query residual cuando quede sin consumidores |

## Risks

| Risk | Likelihood | Mitigation |
|------|------------|------------|
| Romper UX del diálogo de historial al mover el fetch al server | Medium | Separar shell client de data server/shared y validar el contrato de datos |
| Introducir regresiones en update de producto | Medium | Usar `$transaction` y pruebas focalizadas sobre actualización y precios |
| Sobrecargar el render server de `/busy/products` | Medium | Mantener la tabla y filtros interactivos como client islands y pasar solo datos iniciales necesarios |
| Dejar restos de RTK Query sin consumidores | Low | Auditar imports antes de eliminar archivos compartidos |

## Rollback Plan

Si la migración rompe el flujo de Productos:

1. Revertir `page.tsx` a la versión client-first previa.
2. Restaurar el flujo anterior de historial de restock mientras se corrige el contrato server/shared.
3. Revertir `updateProductoAction` a la implementación previa solo si la transacción introduce un problema no esperado.
4. Mantener API routes y handlers legacy como fallback temporal durante la transición.

## Dependencies

- `withAction()` y `requireTenant()` ya existentes.
- Prisma models de Productos, Precios, Stock y Relacionados.
- Contrato estable del historial de restock.
- Catálogos ya existentes para unidades, almacenes, listas de precios, categorías y vendors.

## Success Criteria

- [ ] `RestockHistoryDialog` deja de depender de un hook inexistente.
- [ ] `updateProductoAction` realiza escrituras relacionadas de forma atómica.
- [ ] `/busy/products` funciona como Server Component para la carga inicial.
- [ ] `ProductosForm` recibe datos base desde server sin fetch client-side para catálogos.
- [ ] Se reducen o eliminan dependencias RTK Query específicas de Productos.
- [ ] Typecheck y tests focalizados pasan para los slices tocados.
