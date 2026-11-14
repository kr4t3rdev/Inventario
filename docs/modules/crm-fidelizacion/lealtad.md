# Loyalty Engine

Motor de lealtad con puntos, tiers, gamificación y programa de referidos.

## Visión General

El Loyalty Engine permite crear programas de fidelización donde los clientes acumulan puntos por compras, los canjean por descuentos o beneficios, y progresan entre niveles (tiers). Incluye gamificación con misiones y un programa de referidos con incentivos bidireccionales.

## Modelo de Datos

### Programa de Lealtad

```prisma
model ProgramaLealtad {
  programaId        String   @id @default(cuid())
  tenantId          String
  nombre            String   // "Programa Fidelización TCP"
  activo            Boolean  @default(true)
  puntosPorPeso     Float    @default(1) // 1 punto por $1 gastado
  puntosMinimos     Int      @default(1000) // Para canjear
  valorCanje        Int      @default(100) // $100 por 1000 puntos
  reglas            Json?    // Reglas personalizadas por categoría, canal, periodo
  createdAt         DateTime @default(now())
  updatedAt         DateTime @updatedAt
  @@unique([tenantId, nombre])
}
```

### Tiers (Niveles)

```prisma
model TierLealtad {
  tierId            String           @id @default(cuid())
  programaId        String
  nombre            String           // "Bronce", "Plata", "Oro", "VIP"
  orden             Int              // 1=Bronce, 2=Plata, 3=Oro, 4=VIP
  umbralGasto       Int              // Gasto anual mínimo (centavos)
  umbralFrecuencia  Int?             // Compras anuales mínimas
  beneficios        Json             // { descuento: 0.1, envioGratis: true }
  color             String?          // UI: "#CD7F32"
  icono             String?          // Emoji o icono
  activo            Boolean          @default(true)
  programa          ProgramaLealtad  @relation(fields: [programaId], references: [programaId])
  @@unique([programaId, nombre])
}
```

### Historial de Puntos

```prisma
model HistorialPuntos {
  historialId       String           @id @default(cuid())
  tenantId          String
  clienteId         String
  programaId        String
  puntos            Int              // Positivo = ganados, negativo = canjeados
  tipo              String           // "COMPRA", "CANJE", "BONUS", "CUMPLEANOS", "REFERIDO", "MISION", "MANUAL"
  referenciaId      String?          // ventaId, cuponId, misionId
  saldoAcumulado    Int              // Snapshot del saldo después de esta operación
  idempotenciaKey   String?          // Para prevenir duplicados
  createdAt         DateTime         @default(now())
  @@unique([tenantId, idempotenciaKey])
}
```

### Perfil de Lealtad del Cliente

```prisma
model ClienteLealtad {
  clienteLealtadId  String           @id @default(cuid())
  tenantId          String
  clienteId         String           @unique
  programaId        String
  tierId            String?
  saldoPuntos       Int              @default(0)
  puntosGanados     Int              @default(0)
  puntosCanjeados   Int              @default(0)
  puntosExpirados   Int              @default(0)
  tierActual        String?          // Denormalizado: "Bronce", "Plata"
  updatedAt          DateTime         @updatedAt
}
```

## Motor de Puntos

### Cálculo de Puntos

El servicio `puntos-calculo.ts` proporciona funciones puras:

```typescript
// Calcula puntos ganados por una compra
export function calcularPuntosPorCompra(params: {
  totalCompra: number;        // Total en centavos
  puntosPorPeso: number;      // Ratio del programa
  reglas: Record<string, unknown> | null;
  categoriaId?: string;
}): number

// Calcula el valor monetario de un canje
export function calcularValorCanje(params: {
  puntos: number;
  puntosMinimos: number;
  valorCanje: number;
}): number

// Verifica si un cliente puede canjear
export function verificarCanje(params: {
  saldoActual: number;
  puntosSolicitados: number;
  puntosMinimos: number;
}): { aprobado: boolean; motivo?: string }
```

#### Ejemplo: Calcular puntos

```typescript
const puntos = calcularPuntosPorCompra({
  totalCompra: 50000,      // $500.00 en centavos
  puntosPorPeso: 1,        // 1 punto por $1
  reglas: null,
});
// Resultado: 50000 puntos
```

#### Ejemplo: Verificar canje

```typescript
const resultado = verificarCanje({
  saldoActual: 1500,
  puntosSolicitados: 1000,
  puntosMinimos: 1000,
});
// { aprobado: true }
```

### Canje de Puntos

El servicio `canje-service.ts` maneja la lógica de canje:

```typescript
// Procesa un canje de puntos
export async function procesarCanje(tx: PrismaTransaction, params: {
  tenantId: string;
  clienteId: string;
  puntosACanjar: number;
  programa: ProgramaLealtad;
}): Promise<{ exito: boolean; descuento: number; motivo?: string }>
```

## Sistema de Tiers

### Cálculo de Tier

El servicio `tier-engine.ts` determina el tier actual del cliente:

```typescript
// Evalúa el tier del cliente según gasto y frecuencia
export function evaluarTier(params: {
  clienteLealtad: ClienteLealtad;
  tiers: TierLealtad[];
  gastoAnual: number;      // Gasto del último año (centavos)
  frecuenciaAnual: number; // Compras del último año
}): { tierId: string; tierNombre: string }
```

#### Ejemplo de configuración de tiers

| Tier | Orden | Umbral gasto | Umbral frecuencia | Beneficios |
|------|-------|-------------|-------------------|------------|
| Bronce | 1 | $0 | 0 | Sin beneficios especiales |
| Plata | 2 | $50,000 | 5 | 5% descuento |
| Oro | 3 | $150,000 | 15 | 10% descuento + envío gratis |
| VIP | 4 | $500,000 | 30 | 15% descuento + envío gratis + acceso anticipado |

## Gamificación

### Misiones y Desafíos

```prisma
model MisionLealtad {
  misionId          String           @id @default(cuid())
  tenantId          String
  programaId        String
  nombre            String           // "Compra 3 productos de la línea X"
  descripcion       String?
  tipo              String           // "COMPRA_CATEGORIA", "FRECUENCIA", "AOV", "PRIMERA_COMPRA"
  reglas            Json             // { categoriaId, cantidad: 3, periodo: "mes" }
  recompensaPuntos  Int              // Puntos al completar
  validoDesde       DateTime
  validoHasta       DateTime?
  activo            Boolean          @default(true)
  vecesMaximo       Int?             // Límite total de completados
  progresos         ProgresoMision[]
}

model ProgresoMision {
  progresoId        String         @id @default(cuid())
  tenantId          String
  clienteId         String
  misionId          String
  progreso          Int            @default(0)
  completado        Boolean        @default(false)
  completadoEn      DateTime?
  mision            MisionLealtad  @relation(fields: [misionId], references: [misionId])
  @@unique([clienteId, misionId])
}
```

### Motor de Misiones

El servicio `mision-engine.ts` evalúa el progreso:

```typescript
// Evalúa el progreso de misiones tras una compra
export async function evaluarProgresoMisiones(tx: PrismaTransaction, params: {
  tenantId: string;
  clienteId: string;
  venta: any;
}): Promise<{ misionesCompletadas: string[]; puntosGanados: number }>
```

## Programa de Referidos

### Modelo de Datos

```prisma
model ReferidoLealtad {
  referidoId        String   @id @default(cuid())
  tenantId          String
  codigoReferral    String   // Código único del refiriente
  refirienteId      String   // clienteId del que refiere
  referidoClienteId String?  // clienteId del referido
  estado            String   // "PENDIENTE", "REGISTRADO", "COMPRA_COMPLETADA"
  incentivoRefiriente Int    // Puntos para el refiriente
  incentivoReferido   Int    // Puntos para el referido
  puntosRefiriente    Boolean @default(false)
  puntosReferido      Boolean @default(false)
  createdAt         DateTime @default(now())
  @@unique([tenantId, codigoReferral])
}
```

### Motor de Referidos

El servicio `referido-engine.ts` maneja el tracking:

```typescript
// Genera un código de referido para un cliente
export function generarCodigoReferral(clienteId: string): string

// Registra un referido con un código
export async function registrarReferido(tx: PrismaTransaction, params: {
  tenantId: string;
  codigoReferral: string;
  nuevoClienteId: string;
}): Promise<{ exito: boolean; motivo?: string }>

// Otorga incentivos cuando el referido completa su primera compra
export async function otorgarIncentivosReferido(tx: PrismaTransaction, params: {
  tenantId: string;
  referidoId: string;
}): Promise<void>
```

## Idempotencia

El servicio `idempotency-service.ts` previene duplicados:

```typescript
// Genera una clave de idempotencia
export function crearIdempotenciaKey(tipo: string, referenciaId: string): string
// Ejemplo: crearIdempotenciaKey('COMPRA', 'venta123') → 'COMPRA-venta123'
```

La clave se usa en `HistorialPuntos.idempotenciaKey` con un índice único en `(tenantId, idempotenciaKey)`. Si una operación se reejecuta, la base de datos rechaza el duplicado.

## Server Actions

### Actions de Lealtad

| Action | Descripción |
|--------|-------------|
| `getProgramaAction` | Obtiene el programa de lealtad activo |
| `getClienteLealtadAction` | Obtiene el perfil de lealtad de un cliente |
| `canjePuntosAction` | Canjea puntos por descuento |
| `addPuntosManualesAction` | Agrega puntos manualmente (bonus) |
| `acumularPuntosPorCompraAction` | Acumula puntos por una compra |

### Actions de Admin

| Action | Descripción |
|--------|-------------|
| `createProgramaAction` | Crea un programa de lealtad |
| `updateProgramaAction` | Actualiza el programa |
| `toggleProgramaAction` | Activa/desactiva el programa |
| `createTierAction` | Crea un nuevo tier |
| `updateTierAction` | Actualiza un tier |
| `deleteTierAction` | Elimina un tier |
| `createMisionAction` | Crea una misión |
| `updateMisionAction` | Actualiza una misión |
| `getMisionesActivasAction` | Lista misiones activas |
| `generarCodigoReferralAction` | Genera código de referido |

## Flujo de Acumulación Automática

Cuando se crea una venta exitosa:

1. Se verifica que exista un programa de lealtad activo
2. Se calculan los puntos: `floor(totalCompra * puntosPorPeso)`
3. Se verifica la idempotencia con la clave `venta-{ventaId}`
4. Se crea el registro en `HistorialPuntos`
5. Se actualiza el saldo en `ClienteLealtad`
6. Se evalúa si el cliente subió de tier
7. Se evalúa el progreso de misiones activas

Todo esto ocurre fuera de la transacción principal de la venta para no bloquear el checkout.

## Consideraciones

- **Idempotencia**: Siempre usar `idempotenciaKey` para evitar duplicados de puntos
- **Tenant isolation**: Todos los queries filtran por `tenantId`
- **Performance**: La evaluación de tiers y misiones es rápida; no afecta el checkout
- **Errores silenciosos**: Los errores de lealtad no fallan la venta; se loguean pero la venta se completa
