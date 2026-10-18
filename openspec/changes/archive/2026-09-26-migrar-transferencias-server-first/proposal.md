# Proposal: Migrar transferencias a server-first

## Intent

La feature de transferencias todavía conserva dos dependencias cliente que impiden cerrar la migración a server-first:
- El reporte de movimientos sigue leyendo transferencias desde RTK Query
- El formulario de transferencias sigue dependiendo de stock por ubicación en cliente

La base server-side ya existe: las páginas de listado y edición consumen Server Actions, y las mutaciones principales viven en `src/features/transferencias/actions.ts`. Este cambio completa la migración de lectura y prepara la eliminación del slice residual de RTK Query.

## Scope

### In Scope
- Reemplazar `useGetTransferenciasQuery` en el reporte de movimientos por lectura server-first
- Reemplazar `useGetStockPorUbicacionQuery` en el formulario de transferencias por datos resueltos desde servidor
- Ajustar `TransferenciasContent` para usar Server Actions sin refresh dinámico por import
- Mantener la lógica de negocio y validación actual; solo cambia la capa de transporte y consumo
- Dejar `transferenciasApi.ts` sin consumidores reales para poder retirarlo en una fase posterior

### Out of Scope
- Cambiar el modelo Prisma de `Transferencia`
- Reescribir el flujo de creación/cancelación de transferencias
- Cambiar la UI visual de la feature más allá de lo necesario para consumir datos server-first
- Migrar otros reportes financieros que no dependan de transferencias

## Affected Modules
- `src/features/reportes-financieros/components/reporte-movimientos.tsx`
- `src/features/transferencias/components/transferencias-form.tsx`
- `src/features/transferencias/components/transferencias-content.tsx`
- `src/features/transferencias/api/transferenciasApi.ts`
- `src/features/transferencias/actions.ts`
- `src/app/busy/transferencias/page.tsx`
- `src/app/busy/transferencias/edit/[id]/page.tsx`
- `src/features/productos/actions.ts` si hace falta consolidar la carga de stock por ubicación

## Validation Boundaries
- La lista principal de transferencias debe seguir cargando desde Server Action en la página
- El formulario debe poder calcular stock y validaciones sin depender de RTK Query
- El reporte de movimientos debe renderizar los mismos datos funcionales que antes, pero sin hook de RTK Query
- Las mutaciones de cancelar/crear transferencia deben seguir revalidando la página de listado

## Rollback Plan
Si la migración expone una regresión, el rollback es directo:
- Restaurar el consumo de `useGetTransferenciasQuery` en el reporte
- Restaurar `useGetStockPorUbicacionQuery` en el formulario
- Mantener `transferenciasApi.ts` hasta completar la sustitución de consumidores

## Success Criteria
- [ ] No quedan consumidores de `useGetTransferenciasQuery` fuera del slice de transferencias
- [ ] No quedan consumidores de `useGetStockPorUbicacionQuery` dentro de la feature de transferencias
- [ ] `TransferenciasContent` obtiene y refresca datos solo con Server Actions
- [ ] El reporte de movimientos funciona sin RTK Query para transferencias
- [ ] `transferenciasApi.ts` queda sin uso real y listo para eliminación posterior
