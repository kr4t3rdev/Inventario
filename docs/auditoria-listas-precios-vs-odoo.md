# Auditoría: Listas de precios — TCP vs Odoo (verificación + plan de integración)

**Fecha**: 2026-09-12
**Origen**: análisis comparativo hecho en otra sesión, verificado línea por línea contra el código.

---

## 1. Veredicto sobre el análisis original

| # | Claim del análisis | Veredicto | Evidencia |
|---|---|---|---|
| 1 | Listas múltiples + por punto de venta, con fallback a precio base | ✅ Correcto | `PuntoDeVenta.listaPrecioId`; resolución LISTA→BASE en `src/lib/api/productos-ubicacion.ts:127-144` |
| 2 | Lista por cliente: el POS la prioriza pero `listaPrecioId` no existe en `Cliente` — bug latente, código roto a nivel schema | ❌ **Desactualizado** | El bug se corrigió en CU-08: commit `6dd6552f` + migración `20260906000002_cliente_lista_precio`. `Cliente.listaPrecioId` existe en `prisma/schema.prisma:138` con relación `SetNull`. **Pero** el fondo sigue vigente: la funcionalidad está medio construida (ver H2 abajo) |
| 3 | Reglas por cantidad/volumen: no existen, precio único por (lista, producto) | ✅ Correcto | `PrecioProducto` = `@@unique([listaPrecioId, productoId])` + `precio Int`, sin `cantidadMinima` (`schema.prisma:2776-2787`) |
| 4 | Fórmulas: solo sugerencia margen sobre costo, manual y por lote | ✅ Correcto, con matiz | `src/features/ficha-costo/actions-sugerencias.ts`: `precioCosto × (1 + margenObjetivo)` con default 30%. **Matiz**: aplica sobre `Producto.precioVenta` (precio base), **no** sobre precios de listas |
| 5 | Vigencias (fecha inicio/fin): no existen | ✅ Correcto | Ni `ListaPrecio` ni `PrecioProducto` tienen campos de fecha de vigencia |
| 6 | Precios por moneda: las listas no tienen moneda | ✅ Correcto | `ListaPrecio` no tiene campo moneda (`schema.prisma:2760-2774`). Multimoneda existe a nivel contable/transacciones, no en listas |
| 7 | Descuentos: solo monto manual por venta; nada por línea, cupones ni promos | ✅ Correcto | `Venta.descuento Int?` (monto fijo por venta); `VentaItem` sin descuento (`schema.prisma:698-712`); sin cupones |
| 8 | Impuestos: monto manual en factura; sin tasas por producto ni incluido/excluido | ✅ Correcto | `Factura.impuestos Decimal` manual; sin modelo de tasas |
| 9 | Gestión de margen: ficha de costo versionada + alertas de margen bajo con notificaciones | ✅ Correcto | `ProductoCostSheetTemplate` versionada (`esActiva`), alertas con umbral 10% y notificaciones en `src/features/ficha-costo/actions-alertas.ts`, dashboard en `margen-bajo-table.tsx` |
| 10 | Auditoría de cambios de precio: ProductoCostHistory con razón, usuario, timestamp | ✅ Correcto | `schema.prisma:2789-2806` (`reason`, `changedBy`, `changedAt`, `notes`); usado también por sugerencias (`recordCostChange`) |

### Hallazgos nuevos (no estaban en el análisis)

- **H1 — El servidor confía en el precio del cliente (seguridad).** `ventaItemSchema.precioUnitario` se acepta del payload con solo `int().min(0)` (`src/features/ventas/schemas.ts:11`) y `venta-mutation-service.ts:126` lo persiste tal cual. No hay re-resolución server-side contra la lista del PV ni del cliente: un cliente HTTP manipulado puede vender a cualquier precio ≥ 0. Odoo resuelve precios en servidor. **Esto es más urgente que cualquier feature de paridad.**
- **H2 — La lista del cliente nunca llega al POS web.** `pv-interface.tsx` llama `getPrecioEfectivo(producto, clienteListaPrecioId)`, pero los productos vienen de `GET /api/ventas/punto-venta/[id]/productos` (`ProductoConStock`), que **no incluye el array `precios`**. La rama cliente de `getPrecioEfectivo` (`src/lib/types/pricing.ts:22-27`) es código muerto en el POS; la lista del cliente solo aplica en Ofertas (`src/features/ofertas/actions.ts:58-64`, que sí hace `include: { precios: true }`). O sea: CU-08 arregló el schema; el flujo POS sigue roto.
- **H3 — `esDefault` no participa en la resolución.** La lista marcada como default solo sirve para administración (unicidad); si un PV no tiene lista asignada se usa el precio base, nunca la lista default.
- **H4 — Todos los precios son `Int`.** `Producto.precioVenta`, `PrecioProducto.precio`, `VentaItem.precioUnitario` son enteros. Cualquier fórmula (%, escalones) tendrá que decidir política de redondeo; no hay soporte de decimales.

---

## 2. Plan de integración

Ordenado por valor/riesgo. LP-0 es precondición de seguridad; LP-1/LP-2 completan lo medio construido; LP-3 a LP-6 son paridad con Odoo en orden de impacto para el negocio (Cuba: CUP/MLC/USD hacen moneda más valiosa que cupones).

### LP-0 — Integridad de precios server-side (P0, seguridad)

**Problema**: H1. El servidor persiste el `precioUnitario` que manda el cliente.

**Solución**: resolver precio en servidor al crear venta.
1. En `VentaMutationService.create`, cargar `producto.precios` + `puntoDeVenta.listaPrecioId` + `cliente.listaPrecioId` y re-resolver con `getPrecioEfectivo` (mover de `lib/types/pricing.ts` a un servicio compartido server-side si hace falta).
2. Política de desviación: si el `precioUnitario` enviado difiere del resuelto, rechazar con `PRICE_MISMATCH` o aceptar solo si el usuario tiene permiso nuevo `ventas.precio.override` (recomendado: rechazar por defecto; el override ya existe de facto vía edición manual en el carrito, así que conviene formalizarlo con permiso + audit log).
3. Tests: unitarios del resolver (cliente > PV > base) + test de integración que venta con precio manipulado se rechaza.

**Dependencias**: ninguna. Bloquea nada; destraba confianza para todo lo demás.

### LP-1 — Completar lista por cliente en el POS (P1, terminar lo medio construido)

**Problema**: H2 (+ H3 como opción de diseño).

**Solución**:
1. Incluir `precios` (lista, precio) de las listas relevantes en `getProductosPorUbicacion`: la del PV + la del cliente si el POS envía `clienteId` (agregar query param opcional) — o incluir todas las listas del tenant si el volumen lo permite (productos × listas puede crecer; mejor filtrado por cliente).
2. Decidir el rol de `esDefault`: o se usa como fallback intermedio (cliente > PV > default > base) o se elimina el campo para no mentir. Recomendado: usarlo como fallback — es lo que un usuario espera del label "default".
3. Unificar la cadena en un solo `resolvePrecioVenta({ producto, pvListaId, clienteListaId, defaultListaId })` usado por POS, Ofertas y VentaMutationService.
4. E2E: venta en POS con cliente con lista asignada cobra precio de lista de cliente.

### LP-2 — Vigencias en reglas de precio (P1)

**Problema**: sin vigencias no hay promociones temporales ni cambios de precio programados (caso real: cambio de tarifa fin de mes).

**Solución**:
1. Migración: `PrecioProducto` += `fechaInicio DateTime?`, `fechaFin DateTime?`.
2. Resolver filtra por `now` dentro de vigencia (los registros sin fechas = siempre vigentes).
3. UI: en la edición de precios por lista (hoy dentro del form de producto, `actions-crud.ts:415`) agregar fechas opcionales.
4. `ProductoCostHistory` ya cubre auditoría del cambio; agregar razón `SCHEDULED` si se programa.

### LP-3 — Reglas por cantidad / escalones (P2)

**Solución**: convertir `PrecioProducto` en reglas: += `cantidadMinima Int @default(1)`, relajar el unique a `@@unique([listaPrecioId, productoId, cantidadMinima])`. El resolver elige la regla con mayor `cantidadMinima` ≤ cantidad del ítem. El carrito POS debe re-resolver al cambiar cantidad. Mantener compatibilidad: regla con `cantidadMinima = 1` ≡ comportamiento actual.

### LP-4 — Listas en otra moneda (P2, alto valor local)

**Contexto**: multimoneda ya existe a nivel contable/transacciones; las listas son implícitamente en la moneda base.

**Solución**:
1. `ListaPrecio` += `moneda String?` (null = moneda base del tenant).
2. Al vender en un PV cuya lista tiene otra moneda, registrar la conversión con la infra existente de tasas (TransaccionMoneda) — no inventar conversión paralela.
3. `ProductoCostHistory` sigue auditando en moneda base.

**Riesgo**: alto acoplamiento con contabilidad; hacer después de LP-0/LP-1.

### LP-5 — Descuentos por línea (P3)

`VentaItem` += `descuento Int @default(0)` (monto por línea, consistente con `Venta.descuento`). UI del carrito: descuento por ítem además del global. Cupones/promos quedan fuera de alcance (Enterprise de Odoo; bajo ROI hoy).

### LP-6 — Impuestos por producto (P3, separado)

Motor de impuestos real es un proyecto propio (tasas, incluido/excluido, posición fiscal). Hereda lo decidido en la auditoría de facturación fiscal. No mezclar con este plan más que dejando el hook: resolver precio y luego aplicar impuesto como capa posterior.

---

## 3. Secuencia recomendada

```
LP-0 (integridad server-side)
  └─ LP-1 (lista cliente en POS + resolver unificado + esDefault)
       ├─ LP-2 (vigencias)
       └─ LP-3 (escalones)
            └─ LP-4 (moneda) ── LP-5 (descuento línea)
LP-6 (impuestos): track aparte con facturación fiscal
```

Cada LP es un change openspec propio con TDD (tests primero), code-review y commit por fase, siguiendo el protocolo del proyecto.
