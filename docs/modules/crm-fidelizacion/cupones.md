# Motor de Cupones y Promociones

Sistema de cupones con validación completa, distribución segmentada y A/B testing.

## Visión General

El motor de cupones permite crear códigos promocionales con múltiples tipos de descuento, reglas de validación avanzadas y distribución segmentada. Incluye soporte para A/B testing para optimizar las tasas de redención.

## Tipos de Cupones

| Tipo | Descripción | Ejemplo |
|------|-------------|---------|
| `PORCENTAJE` | Descuento porcentual sobre el total | 10% de descuento |
| `FIJO` | Descuento fijo en moneda | $50 de descuento |
| `2X1` | Dos por uno en productos seleccionados | 2x1 en bebidas |
| `ENVIO_GRATIS` | Envío gratis | Envío sin costo |
| `PRODUCTO_GRATIS` | Producto gratis al cumplir condiciones | Regala un snack |
| `CASHBACK_PUNTOS` | Cashback en puntos de lealtad | 5% en puntos |

## Modelo de Datos

### Cupón

```prisma
model Cupon {
  cuponId           String   @id @default(cuid())
  tenantId          String
  codigo            String   // "VERANO2026", "BIENVENIDO10"
  tipo              String   // Tipo de descuento
  valor             Float    // 10.5 = 10.5% o $10.50
  descripcion       String?
  usoMinimo         Int?     // Monto mínimo de compra (centavos)
  usoMaximo         Int?     // Monto máximo de descuento
  vecesMaximo       Int?     // Límite total de usos
  vecesPorCliente   Int?     // Límite por cliente
  validoDesde       DateTime
  validoHasta       DateTime?
  activo            Boolean  @default(true)
  aplicableA        String?  // "TODOS", "CATEGORIA", "PRODUCTO", "SEGMENTO"
  filtros           Json?    // { categoriaIds: [...], productoIds: [...] }
  canalAplicacion   String?  // "POS", "WEB", "APP", "TODOS"
  segmentoTarget    String?  // "VIP", "NUEVO", "CHURN_RISK"
  canalTarget       String?  // Canal donde se envió el cupón
  vecesUsado        Int      @default(0)
  tasaRedencion     Float    @default(0)
  impactoAov        Float?
  createdAt         DateTime @default(now())
  updatedAt         DateTime @updatedAt
  usos              CuponUso[]
  abTests           CuponABTest[]
  @@unique([tenantId, codigo])
}
```

### Uso de Cupón

```prisma
model CuponUso {
  usoId             String   @id @default(cuid())
  tenantId          String
  cuponId           String
  clienteId         String?  // Null = uso anónimo
  ventaId           String
  descuentoAplicado Int      // Centavos
  canal             String   // "POS", "WEB", "APP"
  createdAt         DateTime @default(now())
  cupon             Cupon    @relation(fields: [cuponId], references: [cuponId])
}
```

### A/B Testing

```prisma
model CuponABTest {
  abTestId          String   @id @default(cuid())
  tenantId          String
  nombre            String   // "Test descuento vs envío gratis"
  cuponId           String
  variante          String   // "A", "B"
  segmentoTarget    String?
  enviadoA          Int      @default(0)
  redimidoPor       Int      @default(0)
  activo            Boolean  @default(true)
  cupon             Cupon    @relation(fields: [cuponId], references: [cuponId])
}
```

## Validación de Cupones

El servicio `cupon-validator.ts` valida un cupón contra todas las reglas de negocio:

### Reglas de Validación (en orden)

1. **¿Está activo?** — El cupón debe tener `activo: true`
2. **¿Está en rango de fechas?** — `ahora >= validoDesde` y `ahora <= validoHasta`
3. **¿Se excedió el límite total de usos?** — `vecesUsado < vecesMaximo`
4. **¿Se excedió el límite por cliente?** — `usosPorCliente < vecesPorCliente`
5. **¿Cumple el monto mínimo de compra?** — `totalCompra >= usoMinimo`
6. **¿Es aplicable al canal?** — `canalAplicacion` coincide con el canal de la venta
7. **¿Es aplicable al segmento del cliente?** — `segmentoTarget` coincide con el segmento
8. **¿Es aplicable a los productos del carrito?** — Si `aplicableA` es "PRODUCTO" o "CATEGORIA"

### API del Validador

```typescript
export interface CuponInfo {
  cuponId: string;
  codigo: string;
  tipo: 'PORCENTAJE' | 'FIJO' | '2X1' | 'ENVIO_GRATIS' | 'PRODUCTO_GRATIS' | 'CASHBACK_PUNTOS';
  valor: number;
  usoMinimo: number | null;
  usoMaximo: number | null;
  vecesMaximo: number | null;
  vecesPorCliente: number | null;
  validoDesde: Date;
  validoHasta: Date | null;
  activo: boolean;
  aplicableA: string | null;
  filtros: Record<string, unknown> | null;
  canalAplicacion: string | null;
  segmentoTarget: string | null;
  vecesUsado: number;
}

export interface ValidacionParams {
  cupon: CuponInfo;
  totalCompra: number;
  canal: string;
  clienteId?: string | null;
  segmentoCliente?: string | null;
  productoIds?: string[];
  usosPorCliente?: number;
  ahora?: Date;
}

export interface ValidacionResultado {
  valido: boolean;
  motivoRechazo?: string;
  descuento?: number;
}

export function validarCupon(params: ValidacionParams): ValidacionResultado
```

### Cálculo de Descuento

```typescript
export function calcularDescuento(params: {
  tipo: string;
  valor: number;
  totalCompra: number;
  usoMaximo: number | null;
}): number
```

| Tipo | Fórmula |
|------|---------|
| `PORCENTAJE` | `floor(totalCompra * valor / 100)` |
| `FIJO` | `floor(valor * 100)` (valor en pesos → centavos) |
| `ENVIO_GRATIS` | `floor(valor)` (costo de envío en centavos) |
| `CASHBACK_PUNTOS` | `0` (no genera descuento directo) |
| `2X1` / `PRODUCTO_GRATIS` | `0` (requiere lógica especial en el carrito) |

El descuento nunca excede el total de la compra ni el `usoMaximo` si está definido.

### Ejemplo de Uso

```typescript
import { validarCupon } from '@/features/cupones/services/cupon-validator';

const resultado = validarCupon({
  cupon: {
    cuponId: 'cupon123',
    codigo: 'VERANO2026',
    tipo: 'PORCENTAJE',
    valor: 15,
    usoMinimo: 10000,
    usoMaximo: 5000,
    vecesMaximo: 100,
    vecesPorCliente: 1,
    validoDesde: new Date('2026-06-01'),
    validoHasta: new Date('2026-08-31'),
    activo: true,
    aplicableA: 'TODOS',
    filtros: null,
    canalAplicacion: 'TODOS',
    segmentoTarget: null,
    vecesUsado: 45,
  },
  totalCompra: 50000,  // $500.00
  canal: 'POS',
  clienteId: 'cliente456',
  usosPorCliente: 0,
});

if (resultado.valido) {
  console.log('Descuento:', resultado.descuento); // 5000 (limitado por usoMaximo)
} else {
  console.log('Rechazado:', resultado.motivoRechazo);
}
```

## Server Actions

| Action | Descripción |
|--------|-------------|
| `getCuponesAction` | Lista cupones activos del tenant |
| `getCuponAction` | Obtiene un cupón por ID |
| `createCuponAction` | Crea un nuevo cupón |
| `updateCuponAction` | Actualiza un cupón existente |
| `deleteCuponAction` | Elimina un cupón |
| `aplicarCuponAction` | Valida y aplica un cupón en el checkout |

### Ejemplo: Crear cupón

```typescript
const result = await createCuponAction({
  codigo: 'BIENVENIDO10',
  tipo: 'PORCENTAJE',
  valor: 10,
  usoMinimo: 5000,
  usoMaximo: 2000,
  vecesMaximo: 500,
  vecesPorCliente: 1,
  validoDesde: new Date(),
  validoHasta: new Date('2026-12-31'),
  aplicableA: 'TODOS',
  canalAplicacion: 'TODOS',
});
```

### Ejemplo: Aplicar cupón en checkout

```typescript
const result = await aplicarCuponAction({
  codigo: 'BIENVENIDO10',
  clienteId: 'cliente456',
  totalCompra: 50000,
  canal: 'POS',
  productoIds: ['prod1', 'prod2'],
});

if (result.success) {
  console.log('Descuento aplicado:', result.data.descuento);
}
```

## A/B Testing

El modelo `CuponABTest` permite comparar variantes de cupones:

```typescript
// Crear un experimento A/B
const experimento = await createABTestAction({
  nombre: 'Test: 10% vs envío gratis',
  varianteA: {
    tipo: 'PORCENTAJE',
    valor: 10,
  },
  varianteB: {
    tipo: 'ENVIO_GRATIS',
    valor: 150, // $1.50 de envío
  },
  segmentoTarget: 'NUEVO',
});

// Los resultados se actualizan automáticamente al redimir cupones
const resultados = await getABTestResultsAction(experimento.abTestId);
// { varianteA: { enviadoA: 100, redimidoPor: 15 }, varianteB: { enviadoA: 100, redimidoPor: 22 } }
```

## Integración con Checkout

El cupón se valida antes de la transacción de venta. Si es válido, el descuento se aplica al total y se registra dentro de la transacción:

```typescript
// 1. Validar cupón antes de la transacción
const validacion = validarCupon({ cupon, totalCompra, canal, clienteId, ... });
if (!validacion.valido) {
  throw new ActionError(validacion.motivoRechazo, 'CUPON_INVALIDO');
}

// 2. Dentro de la transacción, registrar el uso
await tx.cuponUso.create({
  data: {
    tenantId,
    cuponId: cupon.cuponId,
    clienteId,
    ventaId: venta.ventaId,
    descuentoAplicado: validacion.descuento,
    canal: 'POS',
  },
});

// 3. Incrementar contador de usos
await tx.cupon.update({
  where: { cuponId: cupon.cuponId },
  data: { vecesUsado: { increment: 1 } },
});
```

## Consideraciones

- **Tenant isolation**: Todos los queries filtran por `tenantId`
- **Códigos únicos**: El código de cupón es único por tenant (`@@unique([tenantId, codigo])`)
- **Performance**: La validación es rápida (sin queries adicionales si los datos ya están cargados)
- **Tipos especiales**: `2X1` y `PRODUCTO_GRATIS` requieren lógica adicional en el carrito que no está implementada en el validador base
