# Tasks — Correcciones Urgentes (contratos, Ofertas, Almacenes, Ventas de Servicios, Mermas y Cliente)

Plan SDD/TDD. Ejecutar en el orden indicado. Reglas de trabajo (memorias del proyecto):

- **TDD estricto:** primero el test en RED con aserción del comportamiento esperado, luego GREEN mínimo, luego REFACTOR. Guardar evidencia del fallo inicial.
- **Tests con rutas explícitas:** `pnpm exec vitest run <rutas>` (la suite completa tarda ~26 min y tiene fallos preexistentes ajenos — no correrla como señal).
- **Mocks:** todo test que toque prisma lo mockea; en contabilidad/reconciliación el contrato exige `fxEvidence`, `tenantAccountingPolicy` y `$executeRaw` mockeados en transacciones, y prisma como import estático (no `doMock` tardío).
- **Commit por fase**, con **stage selectivo** (`git add <archivos de la fase>`): el worktree tiene cambios ajenos que no deben entrar. Mensaje sugerido por fase indicado abajo.
- **Code review por fase** antes de commitear (skill `code-review`).
- Migraciones con gate: crear con `prisma migrate dev --create-only`, revisar SQL, luego aplicar. Producción migra sola al redeploy (Railway).
- Nomenclatura: `- [ ]` = pendiente; marcar `- [x]` al completar cada tarea.

---

## F-01 — Contratos: IDOR + numeración por tenant

### CU-01 — Aislar API REST de contratos por tenant

- [x] **F01-T1 — RED tenant-negativo.** Crear/actualizar test `src/features/contratos/__tests__/api-tenant-isolation.test.ts` que para cada familia (get, update, delete, bulk-status, firmas, aprobaciones, alertas, versiones, check-diff, archivos) invoque el handler con un contrato del tenant B estando autenticado como tenant A, y espere el error "no encontrado" (mismo que ID inexistente). Ejecutar y guardar el fallo:
  `pnpm exec vitest run src/features/contratos/__tests__/api-tenant-isolation.test.ts`
- [x] **F01-T2 — GREEN helper + handlers.** Implementar `findContratoDelTenant` (ver `design.md` CU-01) y reemplazar todas las lecturas/escrituras sin tenant en `src/features/contratos/api/handlers.ts`; cubrir también las rutas mobile de contratos si existen. Repetir el test hasta verde.
- [x] **F01-T3 — Zod en firmas.** Añadir schema de body a `createContratoFirmaHandler` con test de payload inválido.
- [x] **F01-T4 — Verificación.** `pnpm exec vitest run src/features/contratos` + lint de archivos tocados + typecheck. Code review.

### CU-02 — Numeración por tenant

- [x] **F01-T5 — RED numeración.** Test en `src/features/contratos/__tests__/` (o junto al generador) demostrando: dos tenants con contratos del mismo tipo obtienen consecutivos independientes; dos creaciones concurrentes del mismo tenant no colisionan (reintento P2002).
  `pnpm exec vitest run src/features/contratos`
- [x] **F01-T6 — GREEN generación.** `generarProximoConsecutivo(tenantId, tipo)` con filtro tenant, dentro de la transacción de creación, con retry P2002 (máx. 3). Actualizar `validarFormatoNumeroContrato` para prefijos derivados de tipos custom (design CU-02).
- [x] **F01-T7 — Endurecer tipos custom.** `requireManagerRole` en creación de `TipoContratoCustom` + test de denegación. (La migración a por-tenant queda fuera de alcance — registrada en proposal/design.)
- [x] **F01-T8 — Cierre de fase.** Tests verdes, review, commit:
  `fix(contratos): aislar API REST por tenant y numeración por tenant (CU-01, CU-02)`

## F-02 — Ofertas: auth en exports, server-side y VentaItem

### CU-03 — Autenticar PDF/Excel de ofertas

- [x] **F02-T1 — RED exports.** Test en `src/features/ofertas/__tests__/` (o junto a handlers): sin sesión → 401; tenant B → 404 igual que inexistente; tenant A → 200 con bytes PDF y CSV. Hoy los dos primeros fallan.
  `pnpm exec vitest run src/features/ofertas`
- [x] **F02-T2 — GREEN handlers.** Añadir `authenticateUser` + `requireTenant` + `findFirst({ id, tenantId })` en los handlers `pdf` y `excel` de `src/features/ofertas/api/handlers.ts`. Verificar `src/app/api/ofertas/[id]/{pdf,excel}/route.ts` solo delegan.

### CU-05 (ofertas) — Precios y totales server-side

- [x] **F02-T3 — RED server-side.** Tests `createOfertaAction`: (a) payload con `precioUnitario` manipulado persiste precio de catálogo; (b) item con producto/servicio de otro tenant → error de validación; (c) `subtotal/total` del payload ignorados y recalculados.
- [x] **F02-T4 — GREEN ofertas.** En `createOfertaAction`: validar items contra tenant, resolver `precioUnitario` del catálogo (producto: resolución POS equivalente — lista del cliente si CU-08 ya existe, si no default/base; servicio: `precio`), recalcular `subtotal = Σ(cantidad×precio)` y `total = subtotal + impuestos` con `Prisma.Decimal`. Schemas `.strict()` actualizados. Ajustar el componente de creación si enviaba precios editables (pasar a solo-lectura informativa).
- Nota: si se ejecuta antes de CU-08, la resolución usa lista por defecto/`precioVenta`; CU-08 la mejora. Documentarlo en el commit.

### CU-06 — VentaItem + FIFO al facturar oferta

- [x] **F02-T5 — RED workflow.** Tests de `facturarOfertaAction` (con prisma mockeado por contrato): facturar oferta con 2 productos + 1 servicio crea `Venta` + `VentaItem`×2 + `VentaServicios`×1, descuenta stock, invoca la asignación FIFO y deja la venta visible para la query de reportes por producto. Oferta solo-servicios: sin `VentaItem` pero con `VentaServicios`. Oferta FACTURADA/RECHAZADA sigue rechazando.
  `pnpm exec vitest run src/features/ofertas`
- [x] **F02-T6 — GREEN workflow.** En `facturar-oferta-workflow.ts`, dentro de la transacción: crear `VentaItem` por línea de producto replica de la forma de `venta-mutation-service.ts`; crear `VentaServicios` por línea de servicio con los campos mínimos del dominio; invocar el mismo punto FIFO que la venta normal; rollback total ante fallo.
- [x] **F02-T7 — Cierre de fase.** Suite de ofertas verde + regressions del dashboard mockeados pasan; review; commit:
  `fix(ofertas): autenticar exports, totales server-side y VentaItem+FIFO al facturar (CU-03, CU-05, CU-06)`

## F-03 — Almacenes: anti-cascada

- [x] **F03-T1 — RED acción.** Test de `deleteAlmacenAction`: almacén con productos/stock/transferencias/mermas/PV → error tipado `ALMACEN_EN_USO` con desglose de conteos; almacén vacío → se borra.
  `pnpm exec vitest run src/features/almacenes`
- [x] **F03-T2 — GREEN acción.** Guarda previa con conteos y error tipado; UI traduce el código a mensaje neutral con el desglose.
- [x] **F03-T3 — Migración FK.** `prisma migrate dev --create-only --name restrict_almacen_delete`: `Producto.almacen` → `Restrict` y revisar las demás FKs a `Almacen` (Transferencia, Merma, PuntoDeVenta, StockUbicacion) a `Restrict`. Revisar SQL, aplicar y verificar:
  `pnpm exec prisma validate` + test de schema si existe convención.
- [x] **F03-T4 — Cierre.** Review + commit:
  `fix(almacenes): bloquear borrado con dependencias y FK Restrict (CU-04)`

## F-04 — Venta de servicios: precio del catálogo

- [x] **F04-T1 — RED precio.** Tests `createVentaServicioAction` (legacy y carrito): payload con `precioUnitario` manipulado persiste `Servicios.precio` y `total = cantidad × precio`; servicio de otro tenant ya cubierto por fase 1 — regresión.
  `pnpm exec vitest run src/features/venta-servicios`
- [x] **F04-T2 — GREEN.** Resolver precio y moneda del catálogo en servidor (misma transacción); quitar `precioUnitario` del schema de entrada (`.strict()`); ajustar UI del carrito a precio solo-lectura. Verificar que el path de anticipos y reconciliación (fxEvidence) sigue verde con sus tests existentes.
- [x] **F04-T3 — Cierre.** Review + commit:
  `fix(venta-servicios): precio unitario resuelto desde catálogo en servidor (CU-05)`

## F-05 — Mermas: trazabilidad y costo

- [x] **F05-T1 — RED acciones.** Tests: `createMermaAction` persiste `creadoPorId = usuario autenticado`; `updateMermaAction` recalcula `costoTotal = precioCosto × cantidad` al cambiar producto o cantidad.
  `pnpm exec vitest run src/features/mermas`
- [x] **F05-T2 — Migración + GREEN.** `Merma.creadoPorId String?` (nullable) + índice; migrate create-only → revisar → aplicar. Setear el campo al crear; recalcular costo al editar. UI de listado con columna "Registrado por" (`—` en históricos).
- [x] **F05-T3 — Cierre.** Review + commit:
  `fix(mermas): registrar autor y recalcular costoTotal en edición (CU-07)`

## F-06 — Cliente: listaPrecioId real

- [x] **F06-T1 — RED.** Tests `create/updateClienteAction`: persiste `listaPrecioId`, rechaza lista de otro tenant, exige feature `listas-precios`. Test del POS: `getPrecioEfectivo` con cliente con lista aplica su precio (hoy el campo no existe).
  `pnpm exec vitest run src/features/clientes src/features/ventas`
- [x] **F06-T2 — Migración + GREEN.** `Cliente.listaPrecioId String?` + relación `ListaPrecio` (`SetNull`) + índice; migrate create-only → revisar → aplicar. Schemas Zod + actions con validación tenant/feature. Formulario de cliente conectado al campo real. `pv-interface.tsx`: eliminar `(cliente as any)?.listaPrecioId` → campo tipado.
- [x] **F06-T3 — Cierre.** Review + commit:
  `fix(clientes): persistir listaPrecioId y usarlo en el POS (CU-08)`

## F-07 — Cierre del change

- [x] **F07-T1 — Regresión acotada.** Re-correr todas las rutas tocadas en el change:
  `pnpm exec vitest run src/features/contratos src/features/ofertas src/features/almacenes src/features/venta-servicios src/features/mermas src/features/clientes src/features/ventas`
  + `pnpm exec prisma validate` + typecheck.
- [x] **F07-T2 — Checklist de aceptación.** Verificar los 8 criterios de `proposal.md` y marcarlos.
- [x] **F07-T3 — Archivo OpenSpec.** Mover `openspec/changes/correcciones-urgentes/` a `openspec/changes/archive/2026-09-05-correcciones-urgentes/` (convención del repo) y commitear:
  `chore(openspec): archivar correcciones-urgentes completado`

## Estimación de esfuerzo (referencial)

| Fase | Producción | Tests | Schema | Contexto |
|---|---|---|---|---|
| F-01 | ~150 | ~250 | 0 | Muchos handlers, patrón repetitivo |
| F-02 | ~220 | ~300 | 0 | La más delicada (workflow + FIFO) |
| F-03 | ~80 | ~80 | ~60 | Migración + guarda |
| F-04 | ~60 | ~100 | 0 | Isolada y pequeña |
| F-05 | ~50 | ~80 | ~30 | Migración mínima |
| F-06 | ~90 | ~120 | ~40 | Toca schema + POS |
