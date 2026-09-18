# Diseño técnico — Correcciones Urgentes

Convenciones comunes a todas las correcciones:

- **Respuesta no reveladora:** ante un ID que existe pero pertenece a otro tenant, responder exactamente igual que ante un ID inexistente (404 `NOT_FOUND` genérico en REST; `ActionError('...no encontrado', 'NOT_FOUND')` en actions). Nunca `FORBIDDEN` con mensaje que confirme existencia.
- **Tenant siempre del servidor:** el `tenantId` proviene de `requireTenant(user)` tras autenticación; jamás del body/query.
- **Migraciones aditivas:** campos nuevos nullable; los `onDelete` se endurecen (Restrict) sin tocar datos.
- **Mocks de tests:** respetar el contrato de mocks de contabilidad cuando el test toque reconciliación (`fxEvidence`, `tenantAccountingPolicy`, `$executeRaw` en transacciones; ver memoria `contabilidad-test-mocks-contract`).
- El schema `prisma/schema.prisma` se regenera con el flujo habitual del repo; la migración se crea con nombre descriptivo y se revisa antes de aplicar. En producción Railway corre `prisma migrate deploy` al arrancar (ver memoria `railway-deploy`).

## CU-01 — Contratos: aislamiento de tenant en API REST (IDOR)

**Diseño:** helper único `findContratoDelTenant(contratoId, tenantId)` (en `src/features/contratos/lib/` o dentro de `api/handlers.ts`) que ejecuta `prisma.contrato.findFirst({ where: { contratoId, tenantId } })` — nota: el filtro es por el identificador público del contrato (`contratoId`/slug propio del módulo), no por `id` de fila; verificar en el código cuál usa la ruta y filtrar por ese + tenant.

- Todo handler de `src/features/contratos/api/handlers.ts` que hoy haga `findUnique`/`update`/`delete` por identificador pasa por el helper. Si no hay fila → 404 genérico.
- Aplica a: get/update/delete individual, bulk status, firmas (crear/listar), aprobaciones, alertas, versiones (subir, descargar, check-diff), archivos.
- `createContratoFirmaHandler` valida el body con Zod (schema nuevo en `src/features/contratos/schemas*` coherente con los existentes).
- Las rutas mobile equivalentes (si existen en `src/app/api/mobile/...contratos...`) reciben el mismo tratamiento; verificar.
- Tests: para cada familia de rutas, un caso con contrato de tenant B → misma respuesta que ID inexistente; un caso happy path tenant A.

```
RED   → test: tenant B GET/PUT/DELETE/firma/aprueba/subre versión → 404/NOT_FOUND (hoy falla: 200/éxito)
GREEN → helper + reemplazo en todos los handlers
```

## CU-02 — Contratos: numeración por tenant

**Diseño:** `generarProximoConsecutivo(tenantId, tipo)` filtra por ambos. La generación queda dentro de la transacción de creación con reintento ante `P2002` del `@@unique([tenantId, tipo, numeroConsecutivo])` (patrón retry-on-conflict, máx. 3 intentos). Prefijos: `validarFormatoNumeroContrato` hoy solo admite CV/SER/SUM; para tipos custom se deriva el prefijo de forma determinista (3 letras mayúsculas del nombre normalizado sin acentos, con fallback `CUS`). Documentar la tabla de prefijos resultante.

- Actualizar firmas y llamadores (create handler/action).
- Backfill: NO se renumera lo existente (riesgo innecesario); la corrección es hacia adelante. Los tenants con huecos los conservan.
- **Decisión registrada:** `TipoContratoCustom` sigue global en este change; se endurece su creación a `requireManagerRole`. Migrarlo a por-tenant queda registrado como deuda en la sección Out-of-scope.

## CU-03 — Ofertas: autenticación en exportaciones PDF/Excel

**Diseño:** replicar el patrón del handler GET de oferta (que sí autentica): `authenticateUser` + `requireTenant` + `findFirst({ where: { id, tenantId } })`. Aplicar a `pdf` y `excel` en `src/features/ofertas/api/handlers.ts` y verificar que las rutas `src/app/api/ofertas/[id]/pdf/route.ts` y `.../excel/route.ts` no tengan nada que lo pase por alto (caché, middleware público).

```
RED   → sin auth → 401; de otro tenant → 404; propio → 200 con contenido PDF/CSV
GREEN → autenticación + filtro tenant en ambos handlers
```

## CU-04 — Almacenes: eliminar cascada destructiva

**Diseño:** dos líneas de defensa.

1. **Base de datos:** cambiar la relación `Producto.almacen` de `onDelete: Cascade` a `onDelete: Restrict` (+ migración). Revisar en el mismo pase el resto de relaciones que apuntan a `Almacen` (`Transferencia`, `Merma`, `PuntoDeVenta`, `StockUbicacion`) y fijar todas a `Restrict` salvo evidencia de que otra semántica sea intencional.
2. **Aplicación:** `deleteAlmacenAction` ejecuta antes de borrar un conteo de dependencias (productos, stockUbicacion con cantidad > 0 o cualquier fila, transferencias, mermas, puntosDeVenta) y devuelve `ActionError` tipado `ALMACEN_EN_USO` con el desglose (`{ productos, transferencias, mermas, puntosVenta }`) para que la UI explique por qué no se puede eliminar. La ruta de "vaciar" queda como trabajo futuro explícito (no en este change).

Nota de prudencia: auditar también `Vendor` (delete con Cascade sobre compras) queda registrado como hallazgo separado; NO entra en este change salvo que el usuario lo pida.

## CU-05 — Precios y totales server-side (venta de servicios y ofertas)

**Diseño:** el servidor es la única autoridad de precios de catálogo. El request del cliente aporta: qué ítem, cuántos, y decisiones comerciales (impuestos de oferta, anticipo). Nunca el precio del catálogo.

- **Venta de servicios** (`createVentaServicioAction`, modo legacy y carrito):
  - Para cada línea, `precioUnitario = servicio.precio` leído en el servidor (snapshot de la fila del catálogo en la misma transacción) y `moneda = servicio.moneda` (ya es snapshot desde fase MM — verificar que no se regresione).
  - El campo `precioUnitario` del payload se elimina del schema de entrada (o se tolera ignórandolo, con `.strict()` lo rechaza — preferido: quitarlo).
  - Actualizar el schema Zod y la UI (el carrito muestra el precio como lectura desde el catálogo).
- **Ofertas** (`createOfertaAction`):
  - Cada `OfertaItem` valida pertenencia al tenant (`productoId` o `servicioId` `findFirst({ where: { id, tenantId } })`).
  - `precioUnitario` server-side: producto → resolución equivalente a la del POS (`getPrecioEfectivo` con la lista del cliente si CU-08 ya existe, si no la lista por defecto / `precioVenta`); servicio → `precio` del catálogo.
  - `subtotal = Σ(cantidad × precioUnitario)`, `total = subtotal + impuestos` (impuestos sigue siendo captura manual; fuera de alcance calcularlos).
  - Tipos: los montos de oferta viven en `Decimal`; mantener la aritmética con Prisma.Decimal como hoy.

Parseados estrictos (`.strict()`) en ambos schemas.

```
RED   → test: payload con precio manipulado (mitad del catálogo) persiste el precio de catálogo y el total correcto; producto/servicio de otro tenant → rechazo
```

## CU-06 — Facturar oferta genera VentaItem (+ FIFO)

**Diseño:** en `facturar-oferta-workflow.ts`, dentro de la misma transacción existente:

1. Por cada `OfertaItem` con `productoId`, crear `VentaItem` con los datos resueltos por CU-05 (cantidad, precioUnitario, total). Replicar la forma exacta que usa `venta-mutation-service.ts` para que los consumidores (reportes, FIFO, dashboard) no distingan origen.
2. Tras crear los items, invocar el mismo punto de asignación FIFO que usa la venta normal (`allocateFifoForSale`) — el objetivo es que el costo asignado no dependa del canal.
3. **Líneas de servicio:** no generan `VentaItem` (el modelo es de productos). Decisión: crear además sus filas `VentaServicios` para que el ingreso por servicio ofertado exista en el mismo dominio que una venta de servicio directa y entre a reconciliación/reportes. Es la opción coherente con el resto del sistema; se implementa con los campos mínimos (servicioId, clienteId, cantidad, precioUnitario, moneda, total) reutilizando la lógica de CU-05.
4. Si la oferta mezcla productos y servicios, ambos efectos ocurren en la misma transacción; rollback total ante fallo.

Tests de regresión obligatorios: oferta con 2 productos + 1 servicio → `Venta`, `VentaItem`×2, `VentaServicios`×1, stock descontado, FIFO asignado, y la venta visible en la query del dashboard por producto (mockeando prisma según contrato).

## CU-07 — Mermas: trazabilidad y costo coherente

**Diseño:**

- Schema: `Merma.creadoPorId String?` (nullable, aditivo) + índice `(tenantId, createdAt)` si no existe ya uno equivalente. Migración revisada (P-gate).
- `createMermaAction`: `creadoPorId = user.id` (o el campo de usuario que provea `withAction`); el costoTotal ya se calcula — mantener.
- `updateMermaAction`: recalcular `costoTotal = producto.precioCosto × cantidad` siempre que cambien `productoId` o `cantidad`, usando el precio de costo vigente al momento de la edición (consistente con el resto del sistema, que reevalúa al escribir).
- UI: columna "Registrado por" en el listado de mermas (nombre del usuario, `—` para registros históricos).

## CU-08 — Cliente.listaPrecioId

**Diseño:**

- Schema: `Cliente.listaPrecioId String?` + relación a `ListaPrecio` (`onDelete: SetNull`). Migración aditiva.
- `src/features/clientes/`: schemas Zod de create/update aceptan `listaPrecioId` opcional; la action valida que la lista pertenezca al tenant y exige el feature `listas-precios` (patrón usado en `puntos-venta/actions.ts`).
- El formulario de cliente ya referencia el campo (auditoría: `clientes-form.tsx` líneas ~36 y ~363) — conectar al campo real y ajustar lo que falte.
- `pv-interface.tsx`: eliminar el cast `(cliente as any)?.listaPrecioId` por el campo tipado; `getPrecioEfectivo` pasa a operar sobre un dato real. Sin cambios funcionales en la resolución (prioridad lista del cliente > lista del PV > precio base), solo deja de ser código muerto.

## Orden de ejecución y dependencias

```
F-01 Contratos (CU-01 → CU-02)
F-02 Ofertas   (CU-03 → CU-05[ofertas] → CU-06)
F-03 Almacenes (CU-04)
F-04 Venta de servicios (CU-05[servicios])
F-05 Mermas    (CU-07)
F-06 Cliente   (CU-08)
```

Dependencias reales: CU-06 depende de CU-05-ofertas (los VentaItem usan precios server-side). CU-08 es idealmente anterior a CU-05-ofertas para que la resolución de precio use la lista del cliente; si se ejecuta después, CU-05 queda con lista por defecto y se mejora en CU-08 — aceptable. Migraciones (CU-04, CU-07, CU-08) cada una con su gate de revisión de SQL antes de aplicar.

## Riesgos y mitigación

| Riesgo | Mitigación |
|---|---|
| Romper clientes externos que consumen las API de contratos | Las rutas ya exigían auth; solo se añade el filtro tenant. Ningún consumidor legítimo cambia de comportamiento. |
| Ventas históricas por oferta sin VentaItem | Fuera de alcance reparar histórico; se registra como decisión (no backfill de VentaItems pasados — se evaluará aparte si hace falta). |
| Cambiar resolución de precios en ofertas puede alterar totales guardados | Solo afecta creaciones nuevas/ediciones; ofertas existentes intactas. |
| Migraciones en producción Railway | Aditivas o Restrict (no requieren rewrite de datos); `migrate deploy` en arranque; revisión de SQL en el gate de cada fase. |
