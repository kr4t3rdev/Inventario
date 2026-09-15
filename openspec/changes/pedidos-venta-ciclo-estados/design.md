# Diseño — PVE Pedidos de venta con ciclo de estados

## Ciclo de vida

```
        create (UI pedidos / Oferta "Convertir a pedido")
                 │
                 ▼
             PEDIDO ──────────────┐
               │                  │  anular (sin efectos)
               │ entregarVenta    ▼
               ▼              ANULADA (estado + deletedAt, misma tx)
           ENTREGADA ────────────┤  anular (revierte stock/FIFO/kardex)
               │                 │
               │ facturarVenta   │  anular (reversión completa actual:
               ▼                 ▼  stock + FIFO + factura ANULADA + CxC)
           FACTURADA ────────────┘
```

- `PEDIDO`: venta persistida, sin movimiento de stock, sin FIFO, sin kardex, sin factura.
  Visible en listados con badge; excluible por filtro.
- `ENTREGADA`: mercancía entregada. Efectos inventario ya aplicados.
- `FACTURADA`: documento emitido con serie; cobro/CxC según método de pago, como hoy.
- `ANULADA`: terminal. `deletedAt` se mantiene como mecanismo de exclusión de lecturas
  existentes (reportes, cuadre, CxC); `estado` es el ciclo visible. Ambos se escriben en la
  misma transacción; nunca uno sin el otro.

## Transiciones y guardas

| Transición | Función | Guardas | Efectos (misma tx) |
|---|---|---|---|
| crear → `PEDIDO` | `create` (modo pedido) | auth + tenant + permiso `ventas.venta.registrar`; validación Zod actual; advertencia de stock insuficiente (no bloquea) | `venta.create` + `VentaItem`s |
| `PEDIDO → ENTREGADA` | `entregarVenta` | `ventas.pedido.gestionar`; estado==PEDIDO; stock suficiente (fail si no, sin efectos parciales); turno del PV abierto si la venta amarra a turno | `upsertStockUbicacion` (descuento), `allocateFifoForSale`, kardex |
| `ENTREGADA → FACTURADA` | `facturarVenta` | `ventas.pedido.gestionar`; estado==ENTREGADA; gate `ventas-factura` (como hoy en create) | `Factura` con serie, `applyFacturacionCobroWorkflow` (cobro, CxC, anticipos) |
| `* → ANULADA` | `anularVentaPorEstado` | `ventas.venta.anular`; turno no cerrado/con arqueo (regla vigente) | desde PEDIDO: marcar; desde ENTREGADA: reversión inventario; desde FACTURADA: reversión completa actual |
| POS/mobile clásico | `create` (orquestador) | igual que hoy | `PEDIDO`→`ENTREGADA`→(`FACTURADA` si aplica) en una sola tx; contrato externo intacto |

Toda transición usa un guard idempotente `updateMany({ ventaId, estado: desde }, { estado: hacia })`
y cuenta filas: 0 filas ⇒ la operación ya ocurrió o el estado es otro ⇒ `ActionError` de conflicto
(patrón ya usado en la anulación actual).

## Extracción en `create` (refactor sin cambio observable)

El cuerpo actual de `VentaMutationService.create` se divide en tres bloques internos
(`persistir`, `aplicarEntrega`, `aplicarFacturacion`) que orquesta en secuencia. Regla del
refactor: **primer PR = extracción pura**, mismas llamadas/mismos argumentos/mismo orden; las
suites actuales de `ventas` son la red de seguridad. Solo después se habilita crear detenido en
`PEDIDO`.

## Migración y backfill

- `ALTER TABLE` vía migración Prisma: `estado EstadoVenta NOT NULL DEFAULT 'ENTREGADA'`.
- Backfill SQL en la misma migración (orden importa):
  1. `UPDATE "Venta" SET estado='ANULADA' WHERE "deletedAt" IS NOT NULL`
  2. `UPDATE "Venta" v SET estado='FACTURADA' FROM "facturas" f WHERE f."ventaId"=v."ventaId" AND v."deletedAt" IS NULL`
  3. resto: queda `ENTREGADA` por el default.
- La relación `Factura.ventaId` es `unique`, así que el paso 2 es determinista.
- Rollout Railway: la migración corre en el arranque de producción (patrón vigente).

## TOCTOU y concurrencia

- Dos entregas concurrentes del mismo pedido: el guard de estado por `updateMany` garantiza una
  sola ganadora; la perdedora recibe conflicto (no doble descuento de stock).
- Stock competido entre dos pedidos distintos: como no hay reserva, el segundo `entregarVenta`
  puede fallar por stock; es comportamiento espejo de crear dos ventas hoy. Documentado como
  trade-off aceptado (ver proposal, no-goals).
- La comprobación de stock de `entregarVenta` y el descuento van en la misma transacción, igual
  que el `create` actual.

## Contabilidad

Sin semántica nueva: los asientos/partidas que hoy genera el flujo de cobro
(`applyFacturacionCobroWorkflow`) se disparan en la misma operación, solo diferida a
`facturarVenta`. Implicación operativa a documentar en la UI del pedido: un pedido en `PEDIDO`
o `ENTREGADA` sin facturar **aún no tiene asiento de venta** (igual que Odoo: el asiento nace
de la factura).

## Invariantes de cobro del pedido (decisión post-review T2)

- **El pedido nace sin pago**: campos de cobro (`metodoPago`, montos) se definen al facturar
  (`facturarVenta` los persiste). Ningún flujo crea un PEDIDO con montos ya seteados; si en el
  futuro se permite anticipo al crear el pedido, `facturarVenta` debe *fusionar* en lugar de
  sobrescribir (revisar el claim antes de habilitar eso).
- **`cargoTransporte` no se persiste en `Venta`**: la factura derivada lleva `subtotal =
  total + descuento` y cargo 0. Si un pedido requiere cargo por transporte, se añadirá la
  columna a `Venta` en un change separado (no en PVE).
- Cobro mixto: el invariante del POS (`suma de montos == total`) se exige también en
  `facturarVenta`.

## Coexistencia con `Oferta`

- Oferta = cotización (comercial). Pedido = compromiso operativo.
- Acción nueva `convertirOfertaAPedido`: valida estado `PENDIENTE|ACEPTADA`, crea venta `PEDIDO`
  con sus items/precios y marca la oferta `ACEPTADA` con vínculo (`ofertaId`, ya existe en
  `Venta` como unique).
- `facturarOfertaWorkflow` no cambia: crear + entregar + facturar en una pasada, ahora a través
  del orquestador.
