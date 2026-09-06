# Propuesta: Corrección de hallazgos de revisión (correcciones-review-fixes)

## Resumen
Resolver los hallazgos críticos y altos detectados en la revisión del change `correcciones-urgentes`:
1. Incluir/validar el módulo `@/features/inventario/movimientos` y alinear Prisma/TypeScript para que un checkout limpio compile.
2. Evitar doble conteo contable en ofertas mixtas (`Venta.total` + `VentaServicios`).
3. Encontrar una sola fuente contable para ofertas mixtas.
4. Usar el helper con reintento P2002 en las rutas reales de creación de contratos.
5. Validar clientes/vendedores en Server Action `createContratoAction`.
6. Propagar errores de `getOrCreateTurnoActivo` en facturación de ofertas.
7. Evitar turnos/PDV cross-tenant añadiendo `tenantId` a la búsqueda de turno activo.
8. Validar servicios en `facturarOfertaWorkflow` por tenant.
9. Validar relaciones en mutations secundarias de contratos (firmanteId, aprobadorId, versionId).
10. Agregar `@@index([listaPrecioId])` al modelo `Cliente` para alinearlo con la migración.

## Criterios de aceptación
1. `pnpm exec vitest run src/features/...` verde en los archivos modificados.
2. `tsc` sin errores nuevos en archivos modificados.
3. ESLint sin errores en archivos modificados.
4. `git diff --check` limpio.
5. Type-check y build funcionan standalone (sin depender de archivos no rastreados).

## No objetivos
- No refactorizar módulos no afectados.
- No cambiar UX/UI visible salvo para propagar mensajes de error.
- No cambiar la semántica contable de la venta normal (sin oferta).

## Alcance técnico
- Ofertas: facturación, workflow, acción de facturar.
- Contratos: Server Action + REST handler + numeración.
- Turnos POS: `getOrCreateTurnoActivo` tenant-scoped.
- Mermas: módulo inventario tracked.
- Schema: cliente.listaPrecioId índice.
