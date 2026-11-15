# CDP y Segmentación

Customer Data Platform (CDP) para perfil unificado de clientes, segmentación inteligente y deduplicación.

## Visión General

El módulo CDP enriquece el modelo `Cliente` con datos de comportamiento, preferencias y segmentación. Permite agrupar clientes por reglas de negocio, detectar duplicados y mantener un perfil limpio y actualizado.

## Campos CDP del Modelo Cliente

| Campo | Tipo | Propósito |
|-------|------|-----------|
| `email` | `String? @unique` | Contacto principal para email marketing |
| `emailSecondary` | `String?` | Contacto secundario |
| `telefonoSecondary` | `String?` | Contacto alternativo |
| `fechaNacimiento` | `DateTime?` | Cumpleaños y promociones de edad |
| `genero` | `String?` | Personalización de recomendaciones |
| `preferenciasComunicacion` | `Json?` | `{ email: true, sms: false, push: true }` |
| `consentimientos` | `Json?` | GDPR/LOPD: `{ marketing: true, analytics: true, shared: false }` |
| `segmento` | `String?` | "VIP", "Mayorista", "Minorista", "Nuevo" |
| `tags` | `Json?` | Array de tags: `["frecuente", "nuevo", "churn-risk"]` |
| `canalPreferido` | `String?` | "POS", "Web", "App" — denormalizado |
| `ultimaCompra` | `DateTime?` | Denormalizado para RFM |
| `totalComprado` | `Int?` | Denormalizado para RFM (centavos) |
| `cantidadCompras` | `Int?` | Denormalizado para RFM |
| `clv` | `Float?` | Customer Lifetime Value calculado |
| `metadata` | `Json?` | Campos personalizados por tenant |

Los campos `ultimaCompra`, `totalComprado` y `cantidadCompras` se actualizan automáticamente tras cada venta exitosa.

## Segmentación Inteligente

### Modelo de Datos

```prisma
model SegmentoCliente {
  segmentoId    String   @id @default(cuid())
  tenantId      String
  nombre        String   // "VIP", "Churn Risk", "Nuevos"
  tipo          String   // "MANUAL", "AUTOMATICO", "RFM"
  reglas        Json     // { recencia: { max: 30 }, frecuencia: { min: 5 }, monto: { min: 50000 } }
  descripcion   String?
  activo        Boolean  @default(true)
  color         String?  // Para UI: "#FF6B6B"
  clientesCount Int      @default(0)
  createdAt     DateTime @default(now())
  updatedAt     DateTime @updatedAt
}

model ClienteSegmento {
  id            String         @id @default(cuid())
  tenantId      String
  clienteId     String
  segmentoId    String
  asignadoEn    DateTime       @default(now())
  asignadoPor   String         // "AUTO", "MANUAL", "RFM_JOB"
  segmento      SegmentoCliente @relation(fields: [segmentoId], references: [segmentoId])
  @@unique([clienteId, segmentoId])
}
```

### Tipos de Segmento

| Tipo | Descripción |
|------|-------------|
| `MANUAL` | Asignación manual por el operador |
| `AUTOMATICO` | Asignación automática basada en reglas definidas |
| `RFM` | Asignación automática basada en el algoritmo RFM |

### Motor de Segmentación

El servicio `segmento-engine.ts` proporciona:

```typescript
// Verifica si un cliente cumple las reglas de un segmento
export function cumpleSegmento(
  cliente: NormalizedCliente,
  reglas: Record<string, unknown>,
): boolean

// Normaliza los datos del cliente para evaluación de segmentos
export function normalizarClienteParaSegmento(cliente: any): NormalizedCliente
```

#### Ejemplo de reglas

```json
{
  "recencia": { "max": 30 },
  "frecuencia": { "min": 5 },
  "monto": { "min": 50000 }
}
```

Esto define un segmento de clientes que compraron en los últimos 30 días, con al menos 5 compras y un gasto mínimo de $500.

### Server Actions

| Action | Descripción |
|--------|-------------|
| `getSegmentosAction` | Lista todos los segmentos del tenant |
| `createSegmentoAction` | Crea un nuevo segmento |
| `updateSegmentoAction` | Actualiza un segmento existente |
| `deleteSegmentoAction` | Elimina un segmento |
| `asignarSegmentoAction` | Asigna un segmento a un cliente manualmente |
| `quitarSegmentoAction` | Quita un segmento de un cliente |
| `ejecutarSegmentacionAutoAction` | Ejecuta la segmentación automática para todos los clientes |

#### Ejemplo: Crear segmento

```typescript
const result = await createSegmentoAction({
  nombre: 'VIP',
  tipo: 'AUTOMATICO',
  reglas: {
    recencia: { max: 30 },
    frecuencia: { min: 10 },
    monto: { min: 100000 },
  },
  color: '#FFD700',
});

if (result.success) {
  console.log('Segmento creado:', result.data.segmentoId);
}
```

#### Ejemplo: Asignar segmento manualmente

```typescript
const result = await asignarSegmentoAction({
  clienteId: 'cliente123',
  segmentoId: 'segmento456',
});
```

## Deduplicación de Clientes

### Modelo de Datos

```prisma
model ClienteDuplicado {
  id               String   @id @default(cuid())
  tenantId         String
  clientePrincipal String   // El cliente "ganador" después de la fusión
  clientesFusionados String[] // Array de clienteIds fusionados
  criteriosMatch   Json     // { email: true, telefono: true, nombre: true }
  resueltoEn       DateTime @default(now())
  resueltoPor      String?  // userId o "AUTO"
}
```

### Servicio de Deduplicación

El servicio `deduplication-service.ts` proporciona:

```typescript
// Detecta si un cliente es duplicado de otro existente
export function detectarDuplicado(
  cliente: any,
  existentes: any[],
): DuplicadoInfo | null

// Encuentra todos los duplicados en una lista de clientes
export function encontrarDuplicados(
  clientes: any[],
): DuplicadoGroup[]

// Determina cuál cliente es el "principal" (el que se mantiene)
export function determinarClientePrincipal(grupo: any[]): any
```

#### Criterios de detección

- **Email coincidente** (exacto o normalizado)
- **Teléfono coincidente** (con normalización de formato)
- **Nombre similar** (comparación fuzzy)

#### Ejemplo: Buscar duplicados

```typescript
const result = await encontrarDuplicadosAction();
if (result.success) {
  result.data.duplicados.forEach((grupo) => {
    console.log(`Grupo: ${grupo.clientes.map(c => c.nombre).join(', ')}`);
    console.log(`Principal: ${grupo.clientePrincipal.nombre}`);
  });
}
```

## Actualización Automática

Los campos denormalizados del cliente se actualizan automáticamente en cada venta:

```typescript
// Dentro de la transacción de la venta:
await tx.cliente.update({
  where: { clienteId },
  data: {
    ultimaCompra: new Date(),
    totalComprado: { increment: venta.total },
    cantidadCompras: { increment: 1 },
    canalPreferido: venta.canal,
  },
});
```

## Consideraciones

- **Tenant isolation**: Todos los queries filtran por `tenantId`
- **Performance**: La segmentación automática puede ser costosa; ejecutarla como job nocturno para tenants con muchos clientes
- **Consentimientos**: Respetar las preferencias de comunicación del cliente antes de enviar marketing
- **GDPR/LOPD**: Los consentimientos se almacenan en formato JSON y deben ser verificados antes de cualquier comunicación
