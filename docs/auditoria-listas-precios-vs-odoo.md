# Auditoría: Listas de precios — TCP vs Odoo (verificación + plan de integración)

**Fecha**: 2026-09-12 · **Última revisión de estado**: 2026-10-18
**Origen**: análisis comparativo hecho en otra sesión, verificado línea por línea contra el código.
**Estado general**: LP-0 ✅ y LP-1 ✅ implementados · LP-2 a LP-6 ❌ pendientes. Las referencias verificadas en esta revisión se actualizaron; el resto de números de línea pueden haberse desplazado con el schema.

---

## 1. Veredicto sobre el análisis original

| # | Claim del análisis | Veredicto | Evidencia |
|---|---|---|---|
| 1 | Listas múltiples + por punto de venta, con fallback a precio base | ✅ Correcto | `PuntoDeVenta.listaPrecioId`; resolución LISTA→BASE en `src/lib/api/productos-ubicacion.ts:127-144` |
| 2 | Lista por cliente: el POS la prioriza pero `listaPrecioId` no existe en `Cliente` — bug latente, código roto a nivel schema | ❌ **Desactualizado** | El bug se corrigió en CU-08: commit `6dd6552f` + migración `20260906000002_cliente_lista_precio`. `Cliente.listaPrecioId` existe en `prisma/schema.prisma:139` con relación `SetNull`. **Nota 2026-10-18**: H2 resuelto y LP-1 completo (esDefault como fallback + resolver unificado); no queda fondo abierto de este claim |
| 3 | Reglas por cantidad/volumen: no existen, precio único por (lista, producto) | ✅ Correcto | `PrecioProducto` = `@@unique([listaPrecioId, productoId])` + `precio Int`, sin `cantidadMinima` (`schema.prisma:2842-2853`) |
| 4 | Fórmulas: solo sugerencia margen sobre costo, manual y por lote | ✅ Correcto, con matiz | `src/features/ficha-costo/actions-sugerencias.ts`: `precioCosto × (1 + margenObjetivo)` con default 30%. **Matiz**: aplica sobre `Producto.precioVenta` (precio base), **no** sobre precios de listas |
| 5 | Vigencias (fecha inicio/fin): no existen | ✅ Correcto | Ni `ListaPrecio` ni `PrecioProducto` tienen campos de fecha de vigencia |
| 6 | Precios por moneda: las listas no tienen moneda | ✅ Correcto | `ListaPrecio` no tiene campo moneda (`schema.prisma:2826-2840`). Multimoneda existe a nivel contable/transacciones, no en listas |
| 7 | Descuentos: solo monto manual por venta; nada por línea, cupones ni promos | ✅ Correcto | `Venta.descuento Int?` (monto fijo por venta); `VentaItem` sin descuento (`schema.prisma:722-737`); sin cupones |
| 8 | Impuestos: monto manual en factura; sin tasas por producto ni incluido/excluido | ✅ Correcto | `Factura.impuestos Decimal` manual; sin modelo de tasas |
| 9 | Gestión de margen: ficha de costo versionada + alertas de margen bajo con notificaciones | ✅ Correcto | `ProductoCostSheetTemplate` versionada (`esActiva`), alertas con umbral 10% y notificaciones en `src/features/ficha-costo/actions-alertas.ts`, dashboard en `margen-bajo-table.tsx` |
| 10 | Auditoría de cambios de precio: ProductoCostHistory con razón, usuario, timestamp | ✅ Correcto | `schema.prisma:2855` (`reason`, `changedBy`, `changedAt`, `notes`); usado también por sugerencias (`recordCostChange`) |

### Hallazgos nuevos (no estaban en el análisis)

- **H1 — El servidor confía en el precio del cliente (seguridad).** `ventaItemSchema.precioUnitario` se acepta del payload con solo `int().min(0)` (`src/features/ventas/schemas.ts:11`) y `venta-mutation-service.ts:126` lo persiste tal cual. No hay re-resolución server-side contra la lista del PV ni del cliente: un cliente HTTP manipulado puede vender a cualquier precio ≥ 0. Odoo resuelve precios en servidor. **Esto es más urgente que cualquier feature de paridad.**
  - ✅ **RESUELTO (2026-09-12, LP-0)**: `VentaMutationService` re-resuelve con `resolvePrecioVenta` (`src/features/ventas/services/precio-venta-resolver.ts`); la desviación se rechaza con `PRICE_MISMATCH` salvo permiso `ventas.precio.override`, auditado con `AuditLogService` dentro de la transacción. Tests: `src/features/ventas/__tests__/venta-price-integrity.test.ts` y `precio-venta-resolver.test.ts`. Detalle operativo: `content/docs/modules/ventas/integridad-precios.md`.
- **H2 — La lista del cliente nunca llega al POS web.** `pv-interface.tsx` llama `getPrecioEfectivo(producto, clienteListaPrecioId)`, pero los productos vienen de `GET /api/ventas/punto-venta/[id]/productos` (`ProductoConStock`), que **no incluye el array `precios`**. La rama cliente de `getPrecioEfectivo` (`src/lib/types/pricing.ts:22-27`) es código muerto en el POS; la lista del cliente solo aplica en Ofertas (`src/features/ofertas/actions.ts:58-64`, que sí hace `include: { precios: true }`). O sea: CU-08 arregló el schema; el flujo POS sigue roto.
  - ✅ **RESUELTO (LP-1, punto 1)**: `pv-client.ts` solicita `GET /api/ventas/punto-venta/[id]/productos?clienteId=`, `getProductosPorUbicacion` (`src/lib/api/productos-ubicacion.ts`) incluye el array `precios` (listas del PV + del cliente) y la UI del POS vuelve a usar la rama cliente de `getPrecioEfectivo`. El punto 3 también quedó resuelto (2026-10-18): `getPrecioEfectivo` es ahora un adaptador puro que delega en `resolvePrecioVenta`.
- **H3 — `esDefault` no participa en la resolución.** La lista marcada como default solo sirve para administración (unicidad); si un PV no tiene lista asignada se usa el precio base, nunca la lista default.
  - ✅ **RESUELTO (2026-10-18, LP-1.2)**: `esDefault` es fallback intermedio de la cadena cliente > PV > default > base en `resolvePrecioVenta` (`precio-venta-resolver.ts`), aplicado por `venta-mutation-service`, expuesto en el payload del POS (`listaPrecioDefaultId` + entradas de la default en `precios`) y usado también por Ofertas. En almacén no participa (sin contexto de venta).
- **H4 — Todos los precios son `Int`.** `Producto.precioVenta`, `PrecioProducto.precio`, `VentaItem.precioUnitario` son enteros. Cualquier fórmula (%, escalones) tendrá que decidir política de redondeo; no hay soporte de decimales. **Sigue abierto (2026-10-18)**; decidir la política de redondeo es condición previa de LP-2/LP-3/LP-4.

---

## 2. Plan de integración

Ordenado por valor/riesgo. LP-0 es precondición de seguridad; LP-1/LP-2 completan lo medio construido; LP-3 a LP-6 son paridad con Odoo en orden de impacto para el negocio (Cuba: CUP/MLC/USD hacen moneda más valiosa que cupones).

### LP-0 — Integridad de precios server-side (P0, seguridad)

> ✅ **IMPLEMENTADO (2026-09-12, verificado 2026-10-18).** Resolver puro en `src/features/ventas/services/precio-venta-resolver.ts` (cliente > PV > base); re-resolución server-side en `venta-mutation-service.ts` con rechazo `PRICE_MISMATCH`; desviación permitida solo con permiso `ventas.precio.override` y auditada en `AuditLog` dentro de la transacción. Tests unitarios y de integridad en `src/features/ventas/__tests__/`. Doc operativa: `content/docs/modules/ventas/integridad-precios.md`. El texto siguiente se conserva como diseño original.

**Problema**: H1. El servidor persiste el `precioUnitario` que manda el cliente.

**Solución**: resolver precio en servidor al crear venta.
1. En `VentaMutationService.create`, cargar `producto.precios` + `puntoDeVenta.listaPrecioId` + `cliente.listaPrecioId` y re-resolver con `getPrecioEfectivo` (mover de `lib/types/pricing.ts` a un servicio compartido server-side si hace falta).
2. Política de desviación: si el `precioUnitario` enviado difiere del resuelto, rechazar con `PRICE_MISMATCH` o aceptar solo si el usuario tiene permiso nuevo `ventas.precio.override` (recomendado: rechazar por defecto; el override ya existe de facto vía edición manual en el carrito, así que conviene formalizarlo con permiso + audit log).
3. Tests: unitarios del resolver (cliente > PV > base) + test de integración que venta con precio manipulado se rechaza.

**Dependencias**: ninguna. Bloquea nada; destraba confianza para todo lo demás.

### LP-1 — Completar lista por cliente en el POS (P1, terminar lo medio construido)

> ✅ **IMPLEMENTADO COMPLETO (2026-10-18)**: los 4 puntos hechos. Commits `f1be2cbf` (esDefault), `5be46fe4` (resolver unificado) y `633e2c4e` (E2E + fixtures). La cadena vive solo en `resolvePrecioVenta`; el POS la hereda vía un adaptador puro, Ofertas y `VentaMutationService` llaman al resolver directo, y el E2E `e2e/pos-lista-precio-cliente.spec.ts` valida el ciclo completo en el navegador.

**Problema**: H2 (+ H3 como opción de diseño).

**Solución**:
1. ✅ **Hecho** (junto a LP-0): incluir `precios` (lista, precio) de las listas relevantes en `getProductosPorUbicacion`: la del PV + la del cliente si el POS envía `clienteId` (agregar query param opcional) — o incluir todas las listas del tenant si el volumen lo permite (productos × listas puede crecer; mejor filtrado por cliente). Implementado en `src/lib/api/productos-ubicacion.ts` + `GET /api/ventas/punto-venta/[puntoDeVentaId]/productos?clienteId=`; el POS lo solicita vía `src/features/ventas/lib/pv-client.ts`.
2. ✅ **Hecho (2026-10-18)**: decidir el rol de `esDefault`: se usa como fallback intermedio (cliente > PV > default > base), la opción recomendada — es lo que un usuario espera del label "default". Implementado en `resolvePrecioVenta` + `venta-mutation-service` + payload del POS (`listaPrecioDefaultId`).
3. ✅ **Hecho (2026-10-18)**: la cadena está unificada en un solo `resolvePrecioVenta({ precioBase, precios, pvListaId, clienteListaId, defaultListaId })` usado por POS, Ofertas y VentaMutationService. `getPrecioEfectivo` (`src/lib/types/pricing.ts`) quedó como adaptador puro de wiring (el POS hereda la cadena completa sin tocar sus call sites) y `createOfertaAction` llama directo al resolver con la default del tenant; la rama muerta de `precioVentaResuelto` en `nuevo-pedido-dialog` se eliminó.
4. ✅ **Hecho (2026-10-18)**: E2E `e2e/pos-lista-precio-cliente.spec.ts` — venta en POS con cliente con lista asignada cobra 150 (su lista) sobre 165 (default del tenant) y 180 (base); fixtures sembradas por `scripts/seed-e2e-user.ts` (`seedPrecioListaCatalog`). Corre con `pnpm run test:e2e`: global setup crea el tenant/usuario desechable local, el spec inicia sesión con esas credenciales y usa el `baseURL` local de Playwright.

### LP-2 — Vigencias en reglas de precio (P1)

> ❌ **PENDIENTE (2026-10-18)**: `PrecioProducto` sigue sin `fechaInicio`/`fechaFin` (`prisma/schema.prisma:2842`).

**Problema**: sin vigencias no hay promociones temporales ni cambios de precio programados (caso real: cambio de tarifa fin de mes).

**Solución**:
1. Migración: `PrecioProducto` += `fechaInicio DateTime?`, `fechaFin DateTime?`.
2. Resolver filtra por `now` dentro de vigencia (los registros sin fechas = siempre vigentes).
3. UI: en la edición de precios por lista (hoy dentro del form de producto, `actions-crud.ts:415`) agregar fechas opcionales.
4. `ProductoCostHistory` ya cubre auditoría del cambio; agregar razón `SCHEDULED` si se programa.

### LP-3 — Reglas por cantidad / escalones (P2)

> ❌ **PENDIENTE (2026-10-18)**: sin `cantidadMinima`; el unique sigue `@@unique([listaPrecioId, productoId])`. Requiere política de redondeo (H4).

**Solución**: convertir `PrecioProducto` en reglas: += `cantidadMinima Int @default(1)`, relajar el unique a `@@unique([listaPrecioId, productoId, cantidadMinima])`. El resolver elige la regla con mayor `cantidadMinima` ≤ cantidad del ítem. El carrito POS debe re-resolver al cambiar cantidad. Mantener compatibilidad: regla con `cantidadMinima = 1` ≡ comportamiento actual.

### LP-4 — Listas en otra moneda (P2, alto valor local)

> ❌ **PENDIENTE (2026-10-18)**: `ListaPrecio` sigue sin campo `moneda` (`prisma/schema.prisma:2826`).

**Contexto**: multimoneda ya existe a nivel contable/transacciones; las listas son implícitamente en la moneda base.

**Solución**:
1. `ListaPrecio` += `moneda String?` (null = moneda base del tenant).
2. Al vender en un PV cuya lista tiene otra moneda, registrar la conversión con la infra existente de tasas (TransaccionMoneda) — no inventar conversión paralela.
3. `ProductoCostHistory` sigue auditando en moneda base.

**Riesgo**: alto acoplamiento con contabilidad; hacer después de LP-0/LP-1.

### LP-5 — Descuentos por línea (P3)

> ❌ **PENDIENTE (2026-10-18)**: `VentaItem` sigue sin `descuento` (`prisma/schema.prisma:722`).

`VentaItem` += `descuento Int @default(0)` (monto por línea, consistente con `Venta.descuento`). UI del carrito: descuento por ítem además del global. Cupones/promos quedan fuera de alcance (Enterprise de Odoo; bajo ROI hoy).

### LP-6 — Impuestos por producto (P3, separado)

> ❌ **PENDIENTE (2026-10-18)**: sin modelos de tasas/impuestos en el schema.

Motor de impuestos real es un proyecto propio (tasas, incluido/excluido, posición fiscal). Hereda lo decidido en la auditoría de facturación fiscal. No mezclar con este plan más que dejando el hook: resolver precio y luego aplicar impuesto como capa posterior.

---

## 3. Secuencia recomendada

```
LP-0 (integridad server-side) ✅
  └─ LP-1 (lista cliente en POS + resolver unificado + esDefault) ✅ completo (2026-10-18)
       ├─ LP-2 (vigencias) ❌
       └─ LP-3 (escalones) ❌
            └─ LP-4 (moneda) ❌ ── LP-5 (descuento línea) ❌
LP-6 (impuestos) ❌: track aparte con facturación fiscal
```

Cada LP es un change openspec propio con TDD (tests primero), code-review y commit por fase, siguiendo el protocolo del proyecto. Aplica a lo pendiente: LP-2 en adelante.
