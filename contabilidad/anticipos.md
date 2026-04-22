# 📚 Sistema de Anticipos - Documentación Completa

## 🎯 Concepto General

Un **anticipo** es un pago adelantado o un cobro adelantado asociado a un **contrato** entre tu empresa y un cliente o proveedor. El sistema es bidireccional:

- **ANTICIPO DE PAGO**: Dinero que das adelantado a un proveedor
- **ANTICIPO DE COBRO**: Dinero que recibís adelantado de un cliente

---

## 📊 Modelo de Datos (Base de Datos)

En Prisma, los anticipos se componen de **dos modelos principales**:

### **Modelo: Anticipo**

```sql
anticipoId        → ID único (CUID)
tipo              → 'PAGO' | 'COBRO'
estado            → 'RESERVADO' | 'EJECUTADO' | 'ANULADO'
contratoId        → Vinculado a un contrato activo (FK)
proveedorId       → Vendor ID (si es PAGO)
clienteId         → Cliente ID (si es COBRO)
facturaId         → Factura vinculada (opcional, única)
compraProductoId  → Compra vinculada (opcional, única)
montoOriginal     → Decimal | Monto inicial reservado
saldoDisponible   → Decimal | Cuánto queda sin usar
moneda            → String | 'CUP' | 'USD' | etc
cuentaOrigenId    → ID de cuenta bancaria de origen (opcional)
tipoPagoOrigenId  → Tipo de pago origen (opcional)
referenciaExterna → String | Referencia externa (opcional)
vigenciaHasta     → DateTime | Fecha de vencimiento (opcional)
fechaReserva      → DateTime | Cuándo se creó (default: NOW)
fechaEjecucion    → DateTime | Cuándo se ejecutó totalmente
createdById       → User ID | Quién lo creó
createdAt         → DateTime (default: NOW)
updatedAt         → DateTime (auto-updated)

RELACIONES:
├─ contrato       → Contrato (obligatorio)
├─ proveedor      → Vendor (opcional)
├─ cliente        → Cliente (opcional)
├─ factura        → Factura (opcional)
├─ compraProducto → CompraProducto (opcional)
├─ creador        → User (quien lo creó)
└─ movimientos    → AnticipoMovimiento[] (historial)

ÍNDICES:
├─ contratoId
├─ proveedorId
├─ clienteId
├─ facturaId
├─ compraProductoId
├─ estado
└─ tipo
```

### **Modelo: AnticipoMovimiento**

Cada vez que se RESERVA, EJECUTA o se REVIERTE un anticipo, se registra un movimiento para auditoría:

```sql
movimientoId          → ID único (CUID)
anticipoId            → FK a Anticipo (con cascada DELETE)
tipoMovimiento        → String | 'CREACION_RESERVA' | 'EJECUCION' | 'REVERSO'
contexto              → ContextoAnticipo | enum
                      → 'COMPRA_PRODUCTO' | 'COMPRA_SERVICIO' 
                      → 'FACTURA_OFERTA' | 'FACTURA_DIRECTA'
documentoDestinoId    → String | ID del documento que usa el anticipo
reconciliacionVentaId → String | ID de reconciliación de venta (opcional)
reconciliacionGastoId → String | ID de reconciliación de gasto (opcional)
monto                 → Decimal | Cuánto se movió
moneda                → String | En qué moneda
tasaAplicada          → Decimal | Si hubo conversión (opcional)
montoConvertido       → Decimal | Monto después de conversión (opcional)
saldoAntes            → Decimal | Saldo anterior (para auditoría)
saldoDespues          → Decimal | Saldo posterior (para auditoría)
usuarioId             → User ID | Quién hizo el movimiento
idempotencyKey        → String | Clave de idempotencia (opcional)
observaciones         → String | Notas del movimiento (opcional)
createdAt             → DateTime (default: NOW)

RELACIONES:
└─ anticipo → Anticipo (obligatorio, cascada)

ÍNDICES:
├─ (anticipoId, createdAt)
├─ documentoDestinoId
└─ UNIQUE (anticipoId, idempotencyKey)
```

---

## 🔄 Ciclo de Vida de un Anticipo

### **Diagrama General**

```
┌─────────────────────────────────────────────────────────────┐
│                   ESTADO: RESERVADO                         │
│                                                              │
│  1. Se crea el anticipo con monto inicial                   │
│  2. Se bloquea el saldo en la cuenta de origen              │
│  3. Se registra movimiento: CREACION_RESERVA                │
│  4. saldoDisponible = montoOriginal                         │
└──────────────────────┬──────────────────────────────────────┘
                       │
                       ▼
                  ¿Qué acción?
                   /    |    \
                  /     |     \
                 /      |      \
                ▼       ▼       ▼
            EJE.    REVER.   ANULAR
            TOTAL   PARCIAL
            │       │        │
            ▼       ▼        ▼
```

### **Opción 1: Ejecución Total**

```
┌──────────────────────────────────────────────────────────────┐
│         EJECUCIÓN TOTAL (saldo = 0)                          │
│                                                              │
│  1. Se ingresa monto = saldoDisponible                      │
│  2. Se valida que anticipo esté en RESERVADO               │
│  3. Se valida que no esté vencido                           │
│  4. Se obtiene tasa de cambio (si aplica)                   │
│  5. Se ejecuta reconciliación contable                      │
│  6. Se crea movimiento: EJECUCION                           │
│  7. Se actualiza estado → EJECUTADO                         │
│  8. Se asigna fechaEjecucion                                │
│  9. Se vincula a documentoDestinoId (factura/compra)        │
│  10. saldoDisponible = 0                                     │
└──────────────────────┬───────────────────────────────────────┘
                       │
                       ▼
                 ✅ FINALIZADO
          (No puede haber más movimientos)
```

### **Opción 2: Ejecución Parcial**

```
┌──────────────────────────────────────────────────────────────┐
│         EJECUCIÓN PARCIAL (saldo > 0)                       │
│                                                              │
│  1. Se ingresa monto < saldoDisponible                      │
│  2. Se valida que esté permitida ejecución parcial          │
│  3. Se valida vigencia y estado RESERVADO                   │
│  4. Se crea movimiento: EJECUCION                           │
│  5. Estado sigue en RESERVADO (queda saldo)                 │
│  6. Se calcula:                                             │
│     nuevoSaldo = saldoDisponible - monto                    │
│     saldoDisponible = nuevoSaldo                            │
│  7. Se vincula a documentoDestinoId                         │
└──────────────────────┬───────────────────────────────────────┘
                       │
                       ▼
          Se puede ejecutar más veces
          hasta agotar el saldo
          (múltiples movimientos EJECUCION)
```

### **Opción 3: Reverso**

```
┌──────────────────────────────────────────────────────────────┐
│                   REVERSO DE EJECUCIÓN                       │
│                                                              │
│  1. Se identifica el movimiento a revertir                  │
│  2. Se valida que sea reversible                            │
│  3. Se deshace la reconciliación contable                   │
│  4. Se restaura: saldoDisponible += montoDelMovimiento      │
│  5. Se crea movimiento: REVERSO                             │
│  6. Si queda saldo, estado → RESERVADO                      │
│  7. Se desvincula del documentoDestinoId                    │
└──────────────────────┬───────────────────────────────────────┘
                       │
                       ▼
          El anticipo puede ejecutarse de nuevo
          (saldo disponible restaurado)
```

### **Opción 4: Anulación**

```
┌──────────────────────────────────────────────────────────────┐
│                   ANULACIÓN COMPLETA                         │
│                                                              │
│  1. Se marca estado → ANULADO                               │
│  2. Se registra movimiento final: ANULACION                 │
│  3. El anticipo no puede usarse más                         │
│  4. Se permite solo si está en RESERVADO sin ejecuciones    │
└──────────────────────┬───────────────────────────────────────┘
                       │
                       ▼
                  ❌ CANCELADO
          (No hay más movimientos posibles)
```

---

## ✅ Reglas de Negocio

### **Para CREAR un Anticipo**

```typescript
VALIDACIONES:
├─ ✅ El monto DEBE ser > 0
├─ ✅ El contrato DEBE existir y estar en estado ACTIVO
├─ ✅ Si tipo === 'PAGO':
│   └─ requiere proveedorId
│   └─ proveedorId DEBE coincidir con contrato.vendorId
├─ ✅ Si tipo === 'COBRO':
│   └─ requiere clienteId
│   └─ clienteId DEBE coincidir con contrato.clienteId
├─ ✅ Si vigenciaHasta se especifica:
│   ├─ NO puede estar en el pasado
│   ├─ NO puede ser anterior a contrato.fechaInicio
│   └─ NO puede ser posterior a contrato.fechaFin
└─ ✅ Se crea con estado = 'RESERVADO'

RESULTADO:
└─ Anticipo.saldoDisponible = montoOriginal
```

### **Para EJECUTAR un Anticipo**

```typescript
VALIDACIONES:
├─ ✅ anticipoId debe existir
├─ ✅ estado === 'RESERVADO' (no puede estar EJECUTADO o ANULADO)
├─ ✅ NO puede estar vencido (vigenciaHasta < NOW)
├─ ✅ montoObjetivo > 0
├─ ✅ montoObjetivo <= saldoDisponible
├─ ✅ Ejecución TOTAL o PARCIAL:
│   ├─ TOTAL: montoObjetivo === saldoDisponible (saldo se agota)
│   └─ PARCIAL: montoObjetivo < saldoDisponible (requiere permitirParcial)
├─ ✅ idempotencyKey DEBE ser única y no vacía
│   └─ Se usa para evitar duplicados en reintentos
├─ ✅ Si monedaObjetivo !== anticipo.moneda:
│   ├─ tasaAplicada DEBE ser proporcionada
│   ├─ tasaAplicada > 0
│   └─ Se calcula: montoConvertido = montoObjetivo * tasaAplicada
├─ ✅ contexto DEBE ser válido:
│   ├─ 'COMPRA_PRODUCTO'
│   ├─ 'COMPRA_SERVICIO'
│   ├─ 'FACTURA_OFERTA'
│   └─ 'FACTURA_DIRECTA'
└─ ✅ documentoDestinoId DEBE ser válido (ID del documento que lo usa)

OPERACIÓN ATÓMICA:
├─ Validar idempotencia (no ejecutado antes)
├─ Ejecutar reconciliación contable
├─ Crear movimiento EJECUCION
├─ Actualizar saldoDisponible
├─ Cambiar estado (EJECUTADO si saldo=0, RESERVADO si saldo>0)
├─ Asignar fechaEjecucion (si EJECUTADO)
└─ Guardar en cache para idempotencia

RESULTADO:
├─ saldoDisponible actualizado
├─ estado potencialmente cambiado
└─ movimientoId creado
```

### **Para REVERTIR una Ejecución**

```typescript
VALIDACIONES:
├─ ✅ El movimiento a revertir debe existir
├─ ✅ SOLO se pueden revertir movimientos de tipo 'EJECUCION'
├─ ✅ El anticipo debe tener estado EJECUTADO o RESERVADO
├─ ✅ montoReverso > 0
└─ ✅ montoReverso <= monto del movimiento original

OPERACIÓN ATÓMICA:
├─ Deshace la reconciliación contable
├─ Crea movimiento REVERSO
├─ Restaura: saldoDisponible += montoReverso
├─ Actualiza estado (a RESERVADO si queda saldo)
└─ Desvincula del documentoDestinoId

RESULTADO:
└─ saldoDisponible restaurado
```

---

## 🔧 Flujo Técnico (Backend)

### **1. CREATE ANTICIPO**

**Endpoint:** `POST /api/anticipos`

```typescript
REQUEST BODY:
{
  tipo: 'PAGO' | 'COBRO',
  contratoId: string,
  proveedorId?: string,        // obligatorio si tipo = PAGO
  clienteId?: string,          // obligatorio si tipo = COBRO
  monto: number,               // > 0
  moneda: string,              // 'CUP', 'USD', etc
  cuentaOrigenId?: string,
  tipoPagoOrigenId?: string,
  referenciaExterna?: string,
  vigenciaHasta?: string       // ISO date string
}

VALIDACIÓN:
└─ Zod CreateAnticipoSchema

FLUJO:
├─ withAuthPost (valida usuario)
├─ prisma.$transaction() {
│   ├─ Validar contrato activo
│   ├─ Validar tipo/proveedor/cliente
│   ├─ Validar vigencia
│   ├─ tx.anticipo.create({
│   │   ├─ estado: 'RESERVADO'
│   │   ├─ montoOriginal: monto
│   │   ├─ saldoDisponible: monto
│   │   └─ createdById: userId
│   │ })
│   └─ tx.anticipoMovimiento.create({
│       ├─ tipoMovimiento: 'CREACION_RESERVA'
│       ├─ saldoAntes: 0
│       └─ saldoDespues: monto
│     })
│ }
└─ return { anticipo }

RESPONSE 201:
{
  anticipo: {
    anticipoId: string,
    tipo: 'PAGO' | 'COBRO',
    estado: 'RESERVADO',
    montoOriginal: Decimal,
    saldoDisponible: Decimal,
    fechaReserva: DateTime,
    createdAt: DateTime
  }
}

ERROR CODES:
├─ 400 MONTO_INVALIDO
├─ 400 PROVEEDOR_REQUERIDO / CLIENTE_REQUERIDO
├─ 400 CONTRATO_INVALIDO
├─ 400 PROVEEDOR_NO_COMPATIBLE / CLIENTE_NO_COMPATIBLE
├─ 400 VIGENCIA_INVALIDA
├─ 400 VIGENCIA_FUERA_DE_CONTRATO
└─ 400 Zod validation errors
```

### **2. EXECUTE ANTICIPO**

**Endpoint:** `POST /api/anticipos/[id]/execute`

```typescript
REQUEST BODY:
{
  contexto: 'COMPRA_PRODUCTO' | 'COMPRA_SERVICIO' | 'FACTURA_OFERTA' | 'FACTURA_DIRECTA',
  documentoDestinoId: string,
  montoObjetivo: number,       // > 0
  monedaObjetivo: string,
  tasaAplicada?: number,       // obligatorio si cambio moneda
  idempotencyKey: string,      // única
  observaciones?: string,
  permitirParcial?: boolean
}

IDEMPOTENCIA:
├─ Clave: anticipos:execute:{anticipoId}:{idempotencyKey}
├─ Fingerprint: JSON.stringify({anticipoId, contexto, documentoDestinoId, ...})
├─ Si existe en cache:
│   ├─ Validar fingerprint coincida
│   └─ return cached result
└─ Si NO existe:
    └─ Proceder a ejecución y guardar en cache

FLUJO:
├─ withAuthPost (valida usuario)
├─ Validar idempotencyKey
├─ Verificar cache (¿ya se ejecutó?)
├─ prisma.$transaction() {
│   ├─ Obtener anticipo
│   ├─ Validar estado RESERVADO
│   ├─ Validar vigencia
│   ├─ Validar saldo >= montoObjetivo
│   ├─ Validar conversión moneda
│   ├─ Calcular:
│   │   └─ nuevoSaldo = saldoDisponible - montoObjetivo
│   ├─ tx.anticipo.updateMany({
│   │   ├─ where: {
│   │   │   anticipoId,
│   │   │   estado: 'RESERVADO',
│   │   │   saldoDisponible (optimistic lock)
│   │   │ }
│   │   └─ data: {
│   │       ├─ saldoDisponible: nuevoSaldo
│   │       ├─ estado: nuevoSaldo <= 0 ? 'EJECUTADO' : 'RESERVADO'
│   │       └─ fechaEjecucion: nuevoSaldo <= 0 ? NOW : null
│   │     }
│   │ })
│   ├─ Ejecutar reconciliación (crea entries contables)
│   ├─ tx.anticipoMovimiento.create({
│   │   ├─ tipoMovimiento: 'EJECUCION'
│   │   ├─ contexto
│   │   ├─ documentoDestinoId
│   │   ├─ monto: montoObjetivo
│   │   ├─ tasaAplicada (si aplica)
│   │   ├─ montoConvertido (si aplica)
│   │   ├─ saldoAntes: saldoDisponible
│   │   ├─ saldoDespues: nuevoSaldo
│   │   └─ idempotencyKey
│   │ })
│   └─ Guardar en cache
│ }
└─ return { anticipoId, estado, saldoDisponible, movimientoId, idempotentReplay }

RESPONSE 200:
{
  anticipoId: string,
  estado: 'RESERVADO' | 'EJECUTADO',
  saldoDisponible: Decimal,
  movimientoId: string,
  reconciliacionVentaId?: string,
  reconciliacionGastoId?: string,
  idempotentReplay: boolean
}

ERROR CODES:
├─ 400 IDEMPOTENCY_KEY_REQUERIDA
├─ 400 MONTO_OBJETIVO_INVALIDO
├─ 404 ANTICIPO_NO_ENCONTRADO
├─ 409 ANTICIPO_NO_ELEGIBLE (no está RESERVADO)
├─ 409 ANTICIPO_VENCIDO
├─ 409 COBERTURA_INSUFICIENTE (saldo < monto)
├─ 409 EJECUCION_PARCIAL_NO_PERMITIDA
├─ 409 TASA_INVALIDA (cambio moneda sin tasa)
├─ 409 CONCURRENCIA (actualización simultánea)
└─ 400 Zod validation errors
```

### **3. REVERSE ANTICIPO**

**Endpoint:** `POST /api/anticipos/[id]/reverse`

```typescript
REQUEST BODY:
{
  documentoDestinoId: string,
  montoReverso: number,
  observaciones?: string
}

FLUJO:
├─ withAuthPost (valida usuario)
├─ prisma.$transaction() {
│   ├─ Obtener movimiento EJECUCION
│   ├─ Validar que sea reversible
│   ├─ Deshacer reconciliación
│   ├─ tx.anticipoMovimiento.create({
│   │   ├─ tipoMovimiento: 'REVERSO'
│   │   ├─ monto: montoReverso
│   │   └─ saldoAntes, saldoDespues
│   │ })
│   ├─ Restaurar saldoDisponible += montoReverso
│   └─ Actualizar estado (si queda saldo, RESERVADO)
│ }
└─ return { anticipoId, nuevoSaldo }

RESPONSE 200:
{
  anticipoId: string,
  saldoDisponible: Decimal,
  movimientoId: string
}

ERROR CODES:
├─ 404 ANTICIPO_NO_ENCONTRADO
├─ 404 MOVIMIENTO_NO_ENCONTRADO
├─ 409 MOVIMIENTO_NO_REVERSIBLE
├─ 409 MONTO_REVERSO_INVALIDO
└─ 500 Error al deshacer reconciliación
```

---

## 🎨 Frontend (React Components)

### **AnticipoForm**

Componente para **crear** un nuevo anticipo.

**Ubicación:** `src/components/contabilidad/anticipos/anticipo-form.tsx`

```typescript
PROPS:
├─ open: boolean
├─ onOpenChange: (open: boolean) => void
├─ contratos?: Array<{nombre, contratoId, clienteId, vendorId}>
├─ clientes?: Array<{clienteId, nombre}>
├─ proveedores?: Array<{vendorId, nombre}>
├─ cuentasBancarias?: Array<{cuentaId, nombreBanco, numeroCuenta}>
├─ tiposPago?: Array<{tipoId, nombre}>
└─ onSuccess?: () => void

CAMPOS DEL FORMULARIO:
├─ tipo (select) → PAGO | COBRO (requerido)
├─ contratoId (select) → Filtrado según tipo
├─ proveedorId/clienteId (auto-populated desde contrato)
├─ monto (number) → > 0
├─ moneda (select) → CUP, USD, etc
├─ cuentaOrigenId (select) → opcional
├─ tipoPagoOrigenId (select) → opcional
├─ referenciaExterna (text) → opcional
└─ vigenciaHasta (date) → opcional

VALIDACIÓN:
└─ Zod schema (anticipoSchema)

COMPORTAMIENTO:
├─ Cuando cambia tipo → reset de contratoId
├─ Filtra contratos según tipo
├─ Auto-populate cliente/proveedor desde contrato
└─ Llama a useCreateAnticipoMutation() del Redux

ESTADOS:
├─ isLoading (mientras se crea)
├─ success toast
└─ error toast
```

### **AnticipoDTable**

Componente para **listar** anticipos.

**Ubicación:** `src/components/contabilidad/anticipos/anticipos-table.tsx`

```typescript
PROPS:
├─ data: Anticipo[]
├─ isLoading: boolean
└─ onRowClick?: (anticipo: Anticipo) => void

COLUMNAS:
├─ ID (anticipoId)
├─ Tipo (PAGO/COBRO)
├─ Estado (RESERVADO/EJECUTADO/ANULADO) → con badge color
├─ Monto Original
├─ Saldo Disponible
├─ Moneda
├─ Proveedor/Cliente
├─ Fecha Reserva
├─ Vigencia Hasta
├─ Acciones (ejecutar, revertir, detalles)

FILTROS:
├─ Por estado
├─ Por tipo
├─ Por fecha
└─ Por cliente/proveedor

ORDENAMIENTO:
└─ Por createdAt DESC (defecto)
```

### **AnticipoEjecutarDialog**

Componente para **ejecutar** un anticipo.

**Ubicación:** `src/components/contabilidad/anticipos/anticipo-ejecutar-dialog.tsx`

```typescript
PROPS:
├─ anticipo: Anticipo | null
├─ open: boolean
├─ onOpenChange: (open: boolean) => void
└─ onSuccess?: () => void

CAMPOS:
├─ monto (number)
│   └─ Validación: 0 < monto <= saldoDisponible
├─ permitirParcial (checkbox)
│   └─ Permite ejecutar menos del saldo total

VALIDACIONES:
├─ Monto > 0
├─ Monto <= saldoDisponible
├─ Si ejecución parcial sin permitir → confirmación
└─ Vigencia del anticipo

FLUJO:
├─ Input monto
├─ Si monto < saldo:
│   ├─ Si permitirParcial desactivado:
│   │   └─ Mostrar dialog de confirmación
│   └─ Si permitirParcial activado:
│       └─ Proceder directamente
├─ Llamar useExecuteAnticipoMutation()
├─ Mostrar toast (éxito/error)
└─ Cerrar dialog y refrescar tabla

INFORMACIÓN MOSTRADA:
├─ Tipo (PAGO/COBRO)
├─ Saldo disponible
├─ Moneda
└─ Fecha de vigencia
```

### **AnticipoRevertirDialog**

Componente para **revertir** una ejecución.

**Ubicación:** `src/components/contabilidad/anticipos/anticipo-revertir-dialog.tsx`

```typescript
PROPS:
├─ anticipo: Anticipo | null
├─ open: boolean
├─ onOpenChange: (open: boolean) => void
└─ onSuccess?: () => void

LISTA DE MOVIMIENTOS:
└─ Mostrar solo movimientos EJECUCION reversibles
    ├─ Movimiento ID
    ├─ Fecha
    ├─ Monto
    ├─ Contexto
    └─ Botón "Revertir"

SELECCIONAR MOVIMIENTO:
├─ Input: monto a revertir
├─ Validar: monto <= monto original del movimiento
└─ Textarea: observaciones

FLUJO:
├─ Seleccionar movimiento de la lista
├─ Ingresar monto a revertir
├─ Confirmar reversión
├─ Llamar API reverse
├─ Toast (éxito/error)
└─ Refrescar tabla
```

### **ReportesAnticipos**

Componente para **reportes** de anticipos.

**Ubicación:** `src/components/contabilidad/anticipos/reportes-anticipos.tsx`

```typescript
SECCIONES:
├─ Resumen General
│   ├─ Total anticipos reservados
│   ├─ Total anticipos ejecutados
│   ├─ Total saldo disponible
│   └─ Por moneda
├─ Por Cliente/Proveedor
│   ├─ Nombre
│   ├─ Cantidad anticipos
│   ├─ Monto total
│   └─ Saldo disponible
├─ Próximos a Vencer
│   ├─ Lista de anticipos con vigencia < 30 días
│   └─ Alerta si vencido
└─ Historial de Movimientos
    ├─ Gráfico timeline
    └─ Tabla de movimientos
```

---

## 🔐 Idempotencia (Crítico)

El sistema usa **`idempotencyKey`** para evitar duplicados en ejecuciones:

### **¿Por qué es importante?**

Si un cliente reintenta ejecutar un anticipo dos veces (por timeout, error de red, etc.), sin idempotencia:

```
❌ SIN IDEMPOTENCIA:
Request 1: execute anticipo → crea movimiento, actualiza saldo
Request 2: reintento → crea OTRO movimiento, actualiza saldo OTRA VEZ
Resultado: movimientos duplicados, contabilidad inconsistente
```

### **¿Cómo funciona?**

```
✅ CON IDEMPOTENCIA:
Request 1: execute con idempotencyKey = "exec-abc-123"
  ↓
  ├─ Ejecutar anticipo
  ├─ Guardar en cache:
  │   └─ Key: "anticipos:execute:{id}:exec-abc-123"
  │   └─ Value: {resultado de la ejecución}
  └─ Response: movimientoId, saldoDisponible, ...

Request 2: reintento con la MISMA idempotencyKey
  ↓
  ├─ Buscar en cache
  ├─ Encontrado: recuperar resultado anterior
  └─ Response: MISMO resultado (sin duplicar movimiento)
```

### **Validaciones de Idempotencia**

```typescript
// En executeAnticipo():

1. Validar que idempotencyKey no esté vacía
   └─ Error: IDEMPOTENCY_KEY_REQUERIDA

2. Calcular fingerprint (hash del payload)
   └─ JSON.stringify({ anticipoId, contexto, documentoDestinoId, monto... })

3. Buscar en cache: anticipos:execute:{id}:{idempotencyKey}
   ├─ Si encontrado:
   │   ├─ Verificar que fingerprint coincida
   │   ├─ Si NO coincide: Error 409 IDEMPOTENCIA_CONFLICTO
   │   │   (mismo idempotencyKey con OTRO payload)
   │   └─ Si coincide: return resultado cacheado
   └─ Si NOT encontrado:
       └─ Proceder a ejecución normal

4. Después de ejecutar, guardar en cache:
   └─ anticipos:execute:{id}:{idempotencyKey} = resultado
```

### **Generación de idempotencyKey en Frontend**

```typescript
// Desde AnticipoEjecutarDialog:

const idempotencyKey = `ejecutar-${anticipo.anticipoId}-${Date.now()}`

// IMPORTANTE: usar Date.now() para asegurar unicidad
// Permitir que sea generado por el frontend es seguro porque:
// 1. No se puede falsificar (servidor valida)
// 2. Cada intento tiene timestamp único
// 3. Si se reintenta con la MISMA key, se recupera del cache
```

---

## 💱 Conversión de Moneda

Si el anticipo está en una moneda pero se ejecuta en otra:

### **Ejemplo**

```
Anticipo:
├─ montoOriginal: 1000 CUP
├─ moneda: 'CUP'
└─ saldoDisponible: 1000 CUP

Ejecución:
├─ montoObjetivo: 1000
├─ monedaObjetivo: 'USD'
├─ tasaAplicada: 25.5 (CUP/USD en el momento)
└─ Cálculo:
    montoConvertido = 1000 * 25.5 = 25,500 USD

Movimiento registra:
├─ monto: 1000 (en moneda original)
├─ moneda: 'CUP'
├─ tasaAplicada: 25.5
├─ montoConvertido: 25,500 (en moneda destino)
└─ Nota: saldoDisponible se reduce en moneda original
```

### **Validaciones**

```typescript
if (anticipo.moneda !== monedaObjetivo) {
  // REQUIERE tasa
  if (!tasaAplicada || !isFinite(tasaAplicada) || tasaAplicada <= 0) {
    throw error: 'TASA_INVALIDA'
  }
  
  // Calcular convertido
  montoConvertido = montoObjetivo * tasaAplicada
}
```

---

## 📚 Reconciliación Contable

Cuando se **ejecuta** un anticipo, se crea una **reconciliación** para registrar dónde se aplicó el dinero:

### **Tipos de Reconciliación**

```typescript
SI contexto === 'COMPRA_PRODUCTO':
  ├─ Se vincula a CompraProducto (por documentoDestinoId)
  └─ Se crea ReconciliacionGasto
      ├─ Registra: "Anticipo aplicado a compra #XXX"
      ├─ Afecta: saldo de gasto
      └─ Impacto contable: débito a gasto pendiente

SI contexto === 'COMPRA_SERVICIO':
  ├─ Se vincula a CompraServicio
  └─ Se crea ReconciliacionGasto
      ├─ Registra: "Anticipo aplicado a servicio #XXX"
      ├─ Afecta: saldo de gasto
      └─ Impacto contable: débito a gasto pendiente

SI contexto === 'FACTURA_OFERTA':
  ├─ Se vincula a Factura
  └─ Se crea ReconciliacionVenta
      ├─ Registra: "Anticipo aplicado a factura oferta #XXX"
      ├─ Afecta: ingresos pendientes
      └─ Impacto contable: débito a cuenta por cobrar

SI contexto === 'FACTURA_DIRECTA':
  ├─ Se vincula a Factura
  └─ Se crea ReconciliacionVenta
      ├─ Registra: "Anticipo aplicado a factura #XXX"
      ├─ Afecta: ingresos
      └─ Impacto contable: débito a cuenta por cobrar
```

### **Al Revertir**

```typescript
SI se revierte un movimiento EJECUCION:
  ├─ Se deshace la ReconciliacionVenta/Gasto creada
  ├─ Se desvincula del Factura/CompraProducto/CompraServicio
  └─ El anticipo vuelve a estado RESERVADO (saldo disponible restaurado)
```

---

## 🧪 Testing

### **Unit Tests**

**Ubicación:** `src/lib/services/__tests__/anticipos-workflow.test.ts`

```typescript
describe('createAnticipo', () => {
  it('debe crear un anticipo válido', async () => {
    // Arrange
    const params = {
      tipo: 'PAGO',
      contratoId: validContrato.id,
      proveedorId: vendor.id,
      monto: 1000,
      moneda: 'CUP',
      usuarioId: user.id
    }
    
    // Act
    const anticipo = await createAnticipo(tx, params)
    
    // Assert
    expect(anticipo.estado).toBe('RESERVADO')
    expect(anticipo.saldoDisponible).toBe(1000)
  })
  
  it('debe validar contrato activo', async () => {
    // Arrange
    const params = {
      tipo: 'PAGO',
      contratoId: inactiveContrato.id, // contrato inactivo
      ...
    }
    
    // Act & Assert
    expect(() => createAnticipo(tx, params))
      .rejects.toThrow('CONTRATO_INVALIDO')
  })
})

describe('executeAnticipo', () => {
  it('debe ejecutar anticipo totalmente', async () => {
    // ...
  })
  
  it('debe evitar duplicados (idempotencia)', async () => {
    // ...
  })
  
  it('debe validar vigencia vencida', async () => {
    // ...
  })
})

describe('reverseAnticipo', () => {
  it('debe revertir movimiento de ejecución', async () => {
    // ...
  })
})
```

### **Integration Tests**

**Ubicación:** `src/lib/services/__tests__/anticipos-workflow.test.ts`

```typescript
describe('Flujo completo de anticipos', () => {
  it('debe crear, ejecutar y revertir un anticipo', async () => {
    // 1. Crear
    const anticipo = await createAnticipo(tx, params)
    
    // 2. Ejecutar
    const resultado = await executeAnticipo(tx, {...}, handler)
    
    // 3. Verificar
    expect(resultado.estado).toBe('EJECUTADO')
    
    // 4. Revertir
    const reverso = await reverseAnticipo(tx, {...})
    
    // 5. Verificar reversión
    expect(reverso.saldoDisponible).toBe(anticipo.montoOriginal)
  })
})
```

---

## 📝 Ejemplos de Uso

### **Crear Anticipo de Pago**

```typescript
// Frontend
const response = await createAnticipo({
  tipo: 'PAGO',
  contratoId: 'contrato-001',
  proveedorId: 'vendor-123',
  monto: 5000,
  moneda: 'CUP',
  vigenciaHasta: '2024-12-31'
})

// Response
{
  anticipo: {
    anticipoId: 'anc-xyz',
    tipo: 'PAGO',
    estado: 'RESERVADO',
    montoOriginal: 5000,
    saldoDisponible: 5000,
    moneda: 'CUP',
    fechaReserva: '2024-01-15T10:00:00Z'
  }
}
```

### **Ejecutar Anticipo Totalmente**

```typescript
// Frontend
const resultado = await executeAnticipo({
  anticipoId: 'anc-xyz',
  contexto: 'COMPRA_PRODUCTO',
  documentoDestinoId: 'compra-999',
  montoObjetivo: 5000,
  monedaObjetivo: 'CUP',
  idempotencyKey: 'ejecutar-anc-xyz-1234567890'
})

// Response
{
  anticipoId: 'anc-xyz',
  estado: 'EJECUTADO',           // cambió porque saldo = 0
  saldoDisponible: 0,
  movimientoId: 'mov-abc',
  idempotentReplay: false
}
```

### **Revertir Anticipo**

```typescript
// Frontend
const reverso = await reverseAnticipo({
  anticipoId: 'anc-xyz',
  documentoDestinoId: 'compra-999',
  montoReverso: 5000
})

// Response
{
  anticipoId: 'anc-xyz',
  saldoDisponible: 5000,  // restaurado
  movimientoId: 'mov-def'
}
```

---

## 🐛 Troubleshooting

### **Error: ANTICIPO_NO_ENCONTRADO**

```
Status: 404
Causa: El anticipoId no existe

Solución:
├─ Verificar que anticipoId sea válido
├─ Confirmar que existe en la BD
└─ Revisar logs de creación
```

### **Error: ANTICIPO_VENCIDO**

```
Status: 409
Causa: vigenciaHasta < NOW

Solución:
├─ Extender vigenciaHasta si es necesario
├─ O revertir y crear nuevo anticipo
└─ O acelerar la ejecución
```

### **Error: COBERTURA_INSUFICIENTE**

```
Status: 409
Causa: montoObjetivo > saldoDisponible

Solución:
├─ Ejecutar solo el saldo disponible
├─ O permitir ejecución parcial
└─ O crear nuevo anticipo adicional
```

### **Error: IDEMPOTENCIA_CONFLICTO**

```
Status: 409
Causa: Se usó la misma idempotencyKey con otro payload

Solución:
├─ Generar nuevo idempotencyKey
├─ Usar timestamp para asegurar unicidad
└─ NO reutilizar keys
```

### **Error: CONCURRENCIA**

```
Status: 409
Causa: El anticipo fue modificado por otra operación simultánea

Solución:
├─ Reintento automático (retry logic)
├─ Refrescar datos y validar estado
└─ Usuario debe reintentar acción
```

---

## 📖 Referencias

- **Archivos de código:**
  - `src/lib/services/anticipos-workflow.ts` - Lógica principal
  - `src/app/api/anticipos/route.ts` - Endpoints API
  - `src/components/contabilidad/anticipos/` - Componentes UI

- **Tests:**
  - `src/lib/services/__tests__/anticipos-workflow.test.ts`
  - `src/components/contabilidad/anticipos/__tests__/`

- **Modelos:**
  - `prisma/schema.prisma` - Definición de BD

---

**Última actualización:** 2024
**Estado:** Completo
