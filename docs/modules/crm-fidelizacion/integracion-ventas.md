# Integración con Ventas

Cómo el módulo CRM y Fidelización se integra con el flujo de ventas y el checkout del POS.

## Visión General

La integración con ventas ocurre en tres puntos del flujo de creación de venta:

1. **Validación de cupones** — Antes de la transacción, se valida el cupón si se proporcionó un código
2. **Registro de uso de cupón** — Dentro de la transacción, se registra el `CuponUso` y se incrementa `vecesUsado`
3. **Acumulación de puntos** — Después de confirmar la venta (fuera de la transacción), se acumulan puntos de lealtad y se actualizan los campos RFM del cliente

## Cambios en el Schema de Ventas

### `cuponCodigo` en `createVentaSchema`

Archivo: `src/features/ventas/schemas.ts`

```typescript
const createVentaSchema = z.object({
  // ... campos existentes ...
  /** Código de cupón opcional para aplicar descuento promocional (CRM/Fidelización). */
  cuponCodigo: z.string().optional().nullable(),
  items: z.array(ventaItemSchema).min(1, 'Debe tener al menos un producto'),
  // ...
});
```

## Flujo Completo de una Venta con CRM/Fidelización

```
┌─────────────────────────────────────────────────────────────────┐
│ 1. Recepción del pedido de venta                                │
│    - Incluye: clienteId, items, cuponCodigo (opcional)          │
└──────────────────────────────┬──────────────────────────────────┘
                               │
                               ▼
┌─────────────────────────────────────────────────────────────────┐
│ 2. Validación de cupón (si cuponCodigo está presente)           │
│    - Buscar cupón en BD                                         │
│    - Validar con cupon-validator.ts                              │
│    - Si es inválido → rechazar venta con CUPON_INVALIDO         │
│    - Si es válido → calcular descuento                          │
└──────────────────────────────┬──────────────────────────────────┘
                               │
                               ▼
┌─────────────────────────────────────────────────────────────────┐
│ 3. Transacción de venta (Prisma.$transaction)                   │
│    - Crear Venta                                                │
│    - Crear VentaItem[]                                          │
│    - Actualizar stock                                           │
│    - Registrar CuponUso (si aplica)                              │
│    - Incrementar Cupon.vecesUsado (si aplica)                    │
│    - Actualizar Cliente.ultimaCompra, totalComprado,             │
│      cantidadCompras, canalPreferido                             │
└──────────────────────────────┬──────────────────────────────────┘
                               │
                               ▼
┌─────────────────────────────────────────────────────────────────┐
│ 4. Post-venta: Lealtad (fuera de la transacción)                │
│    - Acumular puntos de lealtad                                 │
│    - Evaluar tier del cliente                                   │
│    - Evaluar progreso de misiones                               │
│    - Si hay error → loguear, pero NO fallar la venta            │
└─────────────────────────────────────────────────────────────────┘
```

## Implementación en `venta-mutation-service.ts`

### Paso 1: Validación de Cupón

```typescript
// Antes de la transacción
import { validarCupon } from '@/features/cupones/services/cupon-validator';

let cuponDescuento = 0;
let cuponIdAplicado: string | null = null;

if (parsed.cuponCodigo && parsed.cuponCodigo.trim()) {
  const cupon = await prisma.cupon.findFirst({
    where: { tenantId, codigo: parsed.cuponCodigo.trim(), activo: true },
  });

  if (cupon) {
    // Contar usos por cliente si aplica
    let usosPorCliente = 0;
    if (parsed.clienteId) {
      usosPorCliente = await prisma.cuponUso.count({
        where: { cuponId: cupon.cuponId, clienteId: parsed.clienteId },
      });
    }

    const validacion = validarCupon({
      cupon: { /* mapear campos del cupón */ },
      totalCompra: subtotalVenta,
      canal: 'POS',
      clienteId: parsed.clienteId || null,
      productoIds: parsed.items.map((it) => it.productoId),
      usosPorCliente,
    });

    if (!validacion.valido) {
      throw new ActionError(validacion.motivoRechazo, 'CUPON_INVALIDO');
    }

    if (validacion.descuento && validacion.descuento > 0) {
      cuponDescuento = validacion.descuento;
      cuponIdAplicado = cupon.cuponId;
    }
  } else {
    throw new ActionError('El código de cupón no existe o no está activo', 'CUPON_NO_ENCONTRADO');
  }
}

// Calcular total con descuento de cupón
const totalVenta = subtotalVenta - (parsed.descuento ?? 0) - cuponDescuento + cargoTransporte;
```

### Paso 2: Registro de CuponUso (dentro de la transacción)

```typescript
// Dentro de prisma.$transaction
if (cuponIdAplicado) {
  await tx.cuponUso.create({
    data: {
      tenantId,
      cuponId: cuponIdAplicado,
      clienteId: parsed.clienteId || null,
      ventaId: venta.ventaId,
      descuentoAplicado: cuponDescuento,
      canal: 'POS',
    },
  });

  await tx.cupon.update({
    where: { cuponId: cuponIdAplicado },
    data: { vecesUsado: { increment: 1 } },
  });
}
```

### Paso 3: Acumulación de Puntos (fuera de la transacción)

```typescript
// Después de prisma.$transaction
import { acumularPuntosPorCompraVenta } from '@/features/ventas/services/lealtad-integration';

if (!esPedido && parsed.clienteId) {
  try {
    await acumularPuntosPorCompraVenta({
      clienteId: parsed.clienteId,
      ventaId: venta.ventaId,
      totalCompra: Math.max(totalVenta, 0),
      tenantId,
    });
  } catch (error) {
    // Error en lealtad no debe fallar la venta; solo se loguea
    console.error('[VentaMutationService] Error acumulando puntos de lealtad:', error);
  }
}
```

## `lealtad-integration.ts` — Puente entre Ventas y Lealtad

Archivo: `src/features/ventas/services/lealtad-integration.ts`

Esta función es el puente entre el módulo de ventas y el de lealtad. Se llama fuera de la transacción principal para no bloquear el checkout.

```typescript
export async function acumularPuntosPorCompraVenta(params: {
  clienteId: string;
  ventaId: string;
  totalCompra: number;
  tenantId: string;
}): Promise<{ puntos: number; motivo: string }>
```

### Qué hace internamente

1. Busca el programa de lealtad activo del tenant
2. Verifica la idempotencia con la clave `COMPRA-{ventaId}`
3. Calcula los puntos: `floor(totalCompra * puntosPorPeso)`
4. Obtiene o crea el perfil `ClienteLealtad`
5. Crea el registro en `HistorialPuntos`
6. Actualiza el saldo en `ClienteLealtad`
7. Actualiza los campos denormalizados de `Cliente`:
   - `ultimaCompra` → fecha actual
   - `totalComprado` → incrementa con el total de la compra
   - `cantidadCompras` → incrementa en 1

### Por qué está fuera de la transacción

La acumulación de puntos ocurre **después** de que la venta se confirma, en una transacción separada. Esto garantiza que:

- **La venta no se bloquea** por operaciones de lealtad lentas
- **El checkout es rápido** — el usuario no espera a que se procesen los puntos
- **Si falla la lealtad, la venta sigue siendo válida** — solo se loguea el error

## Consideraciones de Performance

| Operación | Ubicación | Impacto en checkout |
|-----------|-----------|---------------------|
| Validación de cupón | Antes de la transacción | Bajo (~1-2ms) |
| Registro de CuponUso | Dentro de la transacción | Bajo (~1ms) |
| Acumulación de puntos | Fuera de la transacción | Nulo (async) |
| Evaluación de tier | Fuera de la transacción | Nulo (async) |
| Evaluación de misiones | Fuera de la transacción | Nulo (async) |

## Manejo de Errores

| Escenario | Comportamiento |
|-----------|---------------|
| Cupón inválido | Se rechaza la venta con `CUPON_INVALIDO` |
| Cupón no encontrado | Se rechaza la venta con `CUPON_NO_ENCONTRADO` |
| Error acumulando puntos | Se loguea, la venta se completa normalmente |
| Sin programa de lealtad activo | Se loguea silenciosamente, la venta se completa |
| Puntos ya procesados (idempotencia) | Se retorna el resultado existente sin duplicar |

## Pruebas

Para probar la integración:

1. Crear un programa de lealtad activo
2. Crear un cupón activo
3. Crear una venta con `cuponCodigo`
4. Verificar que:
   - El descuento se aplicó correctamente
   - Se registró el `CuponUso`
   - Se incrementó `vecesUsado`
   - Se acumularon puntos en `HistorialPuntos`
   - Se actualizó `ClienteLealtad.saldoPuntos`
   - Se actualizaron `Cliente.ultimaCompra`, `totalComprado`, `cantidadCompras`
