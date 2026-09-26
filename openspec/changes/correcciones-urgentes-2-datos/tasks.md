# Tasks — Correcciones Urgentes 2 (datos)

Protocolo de ejecución: TDD estricto por fase (rojo → verde → refactor →
commit con stage selectivo), code review por fase, verificación integral y
merge a `main` al cierre. Rama de trabajo:
`feat/correcciones-urgentes-2-datos` (worktree aislado, no toca
`feat/contabilidad-capa-formal`).

## F-1 Guard PV + cascadas de categoría

- [ ] 1.1 Test rojo: `deletePuntoDeVentaAction` bloquea con productos,
      ventas, turnos, arqueos o transferencias asociadas
      (`PUNTO_VENTA_EN_USO` + conteos en el mensaje) y permite borrar un PV
      vacío.
- [ ] 1.2 Test rojo: contrato estático — `schema.prisma` sin
      `onDelete: Cascade` en `Producto.puntoDeVenta` (→ SetNull),
      `Producto.categoria` (→ Restrict) ni `Categoria.parent` (→ Restrict).
- [ ] 1.3 Implementar guard (patrón `deleteAlmacenAction`) y cambios de
      schema; `prisma generate`/validación de schema.
- [ ] 1.4 Verde + commit `fix(catalogo): guard de borrado para punto de venta y cascadas no destructivas (A-1)`.

## F-2 Merma móvil alineada

- [ ] 2.1 Test rojo: nuevo servicio `registrarMermaEnTransaccion` crea merma
      con `creadoPorId`, decrementa stock, escribe kardex `SALIDA-0` y espejo
      `AjusteInventario`.
- [ ] 2.2 Test rojo: `POST /api/mobile/mermas` devuelve 201 con
      `creadoPorId`, llama kardex + espejo dentro de la transacción y
      notifica; rechaza stock insuficiente con 409 (regresión).
- [ ] 2.3 Test rojo: `DELETE /api/mobile/mermas/[id]` revierte kardex y
      anula espejo (alineado con `deleteMermaAction`).
- [ ] 2.4 Implementar servicio compartido; reescribir route móvil POST/DELETE
      para delegar; `createMermaAction` delega el núcleo al servicio.
- [ ] 2.5 Verde (tests desktop existentes incluidos) + commit
      `fix(mermas): alta móvil alineada al desktop vía servicio compartido (A-2)`.

## F-3 Limbo de ofertas

- [ ] 3.1 Test rojo: anular venta con `ofertaId` limpia el vínculo y
      restaura la oferta a `ACEPTADA` (rama PEDIDO y ENTREGADA/FACTURADA).
- [ ] 3.2 Test rojo: reconvertir oferta con venta anulada funciona; convertir
      con venta activa lanza error amigable (ya existía, cubierto);
      `facturarOfertaWorkflow` bloquea con venta activa y traduce `P2002`.
- [ ] 3.3 Implementar en `venta-lifecycle-service.ts`,
      `convertir-oferta-pedido.ts` y `facturar-oferta-workflow.ts`.
- [ ] 3.4 Verde + commit `fix(ofertas): liberar vínculo al anular venta y guarda de venta vinculada (A-3)`.

## F-4 Transferencias: BUG-3 + permiso de completar

- [ ] 4.1 Test rojo: `getStockDisponibleEnPuntoVenta` filtra
      `deletedAt: null` y `estado notIn [CANCELADA, RECHAZADA]` en ambos
      aggregates.
- [ ] 4.2 Test rojo: `completarTransferenciaAction` sin permiso
      `inventario.transferencias.gestionar` → `FORBIDDEN` y sin lecturas;
      con permiso (manager/dependiente) pasa.
- [ ] 4.3 Implementar ambos cambios.
- [ ] 4.4 Verde + commit `fix(transferencias): stock ignora canceladas/rechazadas y completar exige permiso (A-4)`.

## F-5 Período cerrado server-side en gastos

- [ ] 5.1 Test rojo: `createGastosDEAction`/`updateGastosDEAction` rechazan
      con código de período cerrado cuando el guard está en enforce y el
      período del `periodo` (YYYY-MM) está cerrado.
- [ ] 5.2 Test rojo: `deleteGastosDEAction`, `deleteGastosDEBulkAction`,
      `aprobarGastoDEAction`, `rechazarGastoDEAction` validan el período del
      gasto cargado (`PeriodoGuard.assertWritable`).
- [ ] 5.3 Test rojo: `POST /api/mobile/expenses` con fecha de período
      cerrado → 400 con código del guard (regresión: crea hoy).
- [ ] 5.4 Implementar wrappers/extractores y validaciones explícitas.
- [ ] 5.5 Verde + commit `feat(gastos): enforcement server del período contable cerrado (A-5)`.

## Cierre

- [ ] 6.1 Code review por fase (typescript-reviewer) y correcciones.
- [ ] 6.2 Verificación integral: `pnpm run lint`, typecheck y suite objetivo
      de las 5 fases en verde.
- [ ] 6.3 Merge a `main` (worktree), push, verificación de CI y deploymentSha.
- [ ] 6.4 Archivar change openspec y actualizar memoria de sesión.
