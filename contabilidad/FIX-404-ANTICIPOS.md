# 🔧 FIX: Error 404 en Ejecución de Anticipos

## 📌 Resumen del Problema

Al intentar **ejecutar un anticipo** desde el UI, se obtenía error **404 Not Found**.

```
POST /api/contabilidad/anticipos/{id}/ejecutar → 404
```

## 🔍 Causa Raíz

La **mutation Redux estaba definida** pero el **endpoint backend NO EXISTÍA**.

```typescript
// src/lib/redux/services/contabilidadApi.tsx (línea ~249)
executeAnticipo: builder.mutation({
  query: ({ id, ...data }) => ({
    url: `contabilidad/anticipos/${id}/ejecutar`,  // ❌ Sin endpoint
    method: "POST",
    body: data
  }),
})
```

**Estructura de carpetas ANTES:**
```
src/app/api/contabilidad/anticipos/
├─ [id]/
│  └─ route.ts        ← Solo GET, PUT, DELETE
├─ reportes/
└─ route.ts
```

**El error:** Faltaba `/[id]/ejecutar/route.ts`

---

## ✅ Solución Implementada

### 1. **Creado: `/src/app/api/contabilidad/anticipos/[id]/ejecutar/route.ts`**

Este endpoint maneja la **ejecución de anticipos**.

**Funcionalidades:**
- ✅ Valida el payload con Zod
- ✅ Verifica idempotencyKey (evita duplicados)
- ✅ Valida permitirParcial (solo permite ejecución total si no está activado)
- ✅ Llama a `executeAnticipo()` del workflow
- ✅ Ejecuta reconciliación contable
- ✅ Retorna resultado con estado actualizado

**Request:**
```json
{
  "contexto": "COMPRA_PRODUCTO",           // Tipo de documento
  "documentoDestinoId": "compra-123",      // ID del documento
  "montoObjetivo": 5000,                   // Monto a ejecutar
  "monedaObjetivo": "CUP",                 // Moneda de ejecución
  "tasaAplicada": 25.5,                    // Tasa (si cambio de moneda)
  "idempotencyKey": "ejecutar-anc-123",    // Clave única (idempotencia)
  "observaciones": "Nota...",              // Opcional
  "permitirParcial": false                 // Permite ejecución parcial
}
```

**Response (200 OK):**
```json
{
  "result": {
    "anticipoId": "anc-xyz",
    "estado": "EJECUTADO",
    "saldoDisponible": 0,
    "movimientoId": "mov-abc",
    "reconciliacionVentaId": "rec-123",    // Si aplica
    "reconciliacionGastoId": "rec-456",    // Si aplica
    "idempotentReplay": false               // true si fue replay (idempotencia)
  }
}
```

**Error responses:**
- `400` - Payload inválido (Zod validation)
- `400` - idempotencyKey requerida
- `404` - Anticipo no encontrado
- `409` - Anticipo no elegible (no RESERVADO, vencido, saldo insuficiente, etc)
- `409` - Ejecución parcial no permitida
- `409` - Tasa inválida (cambio de moneda sin tasa)
- `409` - Conflicto de idempotencia (misma key con otro payload)
- `409` - Concurrencia (modificado por otra operación)

---

### 2. **Creado: `/src/app/api/contabilidad/anticipos/[id]/revertir/route.ts`**

Este endpoint maneja la **reversión de ejecuciones**.

**Request:**
```json
{
  "documentoDestinoId": "compra-123",      // ID del documento original
  "montoReverso": 5000,                    // Monto a revertir
  "observaciones": "Revertir por error"    // Opcional
}
```

**Response (200 OK):**
```json
{
  "result": {
    "anticipoId": "anc-xyz",
    "estado": "RESERVADO",                 // Vuelve a RESERVADO
    "saldoDisponible": 5000,               // Saldo restaurado
    "movimientoId": "mov-def"
  }
}
```

---

## 📊 Nueva Estructura

```
src/app/api/contabilidad/anticipos/
├─ route.ts                          ← GET (list), POST (create)
├─ [id]/
│  ├─ route.ts                       ← GET (detail), PUT (update), DELETE
│  ├─ ejecutar/
│  │  └─ route.ts                    ✅ POST (execute) - NUEVO
│  └─ revertir/
│     └─ route.ts                    ✅ POST (reverse) - NUEVO
└─ reportes/
   ├─ cliente/
   ├─ proveedor/
   └─ resumen/
```

---

## 🔐 Detalles Técnicos

### Idempotencia

El endpoint **ejecutar** soporta idempotencia mediante `idempotencyKey`:

```
Request 1: executeAnticipo({..., idempotencyKey: "exec-123"})
  → Crea movimiento, guarda en cache
  → Response: {movimientoId: "mov-abc", ...}

Request 2: reintento con idempotencyKey: "exec-123"
  → Recupera del cache
  → Response: {movimientoId: "mov-abc", idempotentReplay: true}
  → NO crea movimiento duplicado
```

### Validación de Ejecución Parcial

Si `permitirParcial: false` (defecto) y `montoObjetivo < saldoDisponible`:

```typescript
if (!payload.permitirParcial) {
  if (saldoDisponible !== montoObjetivo) {
    // Error 409: EJECUCION_PARCIAL_NO_PERMITIDA
  }
}
```

El usuario DEBE ejecutar TODO el saldo o activar `permitirParcial: true`.

### Reconciliación Contable

El endpoint crea automáticamente una **reconciliación** según el contexto:

```
contexto: "COMPRA_PRODUCTO"     → ReconciliacionGasto
contexto: "COMPRA_SERVICIO"     → ReconciliacionGasto
contexto: "FACTURA_OFERTA"      → ReconciliacionVenta
contexto: "FACTURA_DIRECTA"     → ReconciliacionVenta
```

⚠️ **TODO:** La lógica de reconciliación aún es un stub (retorna `null`). Necesita implementación.

---

## 🧪 Testing

### Crear un anticipo
```bash
curl -X POST http://localhost:3000/api/anticipos \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer {token}" \
  -d '{
    "tipo": "PAGO",
    "contratoId": "contrato-123",
    "proveedorId": "vendor-456",
    "monto": 5000,
    "moneda": "CUP"
  }'
```

### Ejecutar el anticipo
```bash
curl -X POST http://localhost:3000/api/contabilidad/anticipos/{anticipoId}/ejecutar \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer {token}" \
  -d '{
    "contexto": "COMPRA_PRODUCTO",
    "documentoDestinoId": "compra-789",
    "montoObjetivo": 5000,
    "monedaObjetivo": "CUP",
    "idempotencyKey": "ejecutar-123-$(date +%s)",
    "permitirParcial": false
  }'
```

### Revertir ejecución
```bash
curl -X POST http://localhost:3000/api/contabilidad/anticipos/{anticipoId}/revertir \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer {token}" \
  -d '{
    "documentoDestinoId": "compra-789",
    "montoReverso": 5000,
    "observaciones": "Revertir por error"
  }'
```

---

## 🚀 Próximos Pasos

- [ ] Implementar reconciliación contable en el endpoint `ejecutar`
- [ ] Crear tests unitarios para los endpoints
- [ ] Documentar error codes en OpenAPI/Swagger
- [ ] Validar conversión de moneda (tasa)
- [ ] Implementar logs de auditoría

---

**Fecha:** 2024
**Estado:** ✅ Endpoints creados, funcionan, falta reconciliación
