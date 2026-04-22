# 🧪 CÓMO PROBAR LA SOLUCIÓN

## ¿Qué problema había?
```
❌ POST /api/contabilidad/anticipos/{id}/ejecutar → Error 404
❌ POST /api/contabilidad/anticipos/{id}/revertir → Error 404
```

## ¿Qué se arregló?
```
✅ POST /api/contabilidad/anticipos/{id}/ejecutar → Funciona
✅ POST /api/contabilidad/anticipos/{id}/revertir → Funciona
```

## 🚀 PASOS PARA PROBAR

### 1. Asegurate de tener los archivos creados

```bash
ls -la src/app/api/contabilidad/anticipos/[id]/ejecutar/route.ts
ls -la src/app/api/contabilidad/anticipos/[id]/revertir/route.ts
```

Ambos deben existir.

### 2. Inicia el servidor de desarrollo

```bash
npm run dev
```

Espera a que Turbopack compile.

### 3. En el navegador o postman

#### A) Crear un anticipo (si no tenés uno)

**Endpoint:**
```
POST http://localhost:3000/api/anticipos
```

**Headers:**
```
Content-Type: application/json
Authorization: Bearer {tu-token}
```

**Body:**
```json
{
  "tipo": "PAGO",
  "contratoId": "contrato-123",
  "proveedorId": "vendor-456",
  "monto": 5000,
  "moneda": "CUP"
}
```

**Response (201):**
```json
{
  "anticipo": {
    "anticipoId": "anc-xyz",
    "tipo": "PAGO",
    "estado": "RESERVADO",
    "montoOriginal": 5000,
    "saldoDisponible": 5000,
    "moneda": "CUP",
    "createdAt": "2024-04-19T..."
  }
}
```

**Guardar el `anticipoId` para los próximos tests.**

---

#### B) Ejecutar el anticipo ✨ (NUEVO - ANTES DABA 404)

**Endpoint:**
```
POST http://localhost:3000/api/contabilidad/anticipos/{anticipoId}/ejecutar
```

**Headers:**
```
Content-Type: application/json
Authorization: Bearer {tu-token}
```

**Body:**
```json
{
  "contexto": "COMPRA_PRODUCTO",
  "documentoDestinoId": "compra-999",
  "montoObjetivo": 5000,
  "monedaObjetivo": "CUP",
  "idempotencyKey": "ejecutar-anc-xyz-1234567890",
  "permitirParcial": false
}
```

**Response (200) - ¡AHORA FUNCIONA!:**
```json
{
  "result": {
    "anticipoId": "anc-xyz",
    "estado": "EJECUTADO",
    "saldoDisponible": 0,
    "movimientoId": "mov-abc",
    "idempotentReplay": false
  }
}
```

✅ **Si llegaste acá sin error 404, ¡FUNCIONA!**

---

#### C) Probar idempotencia

**Repite el MISMO request de ejecutar:**

```json
{
  "contexto": "COMPRA_PRODUCTO",
  "documentoDestinoId": "compra-999",
  "montoObjetivo": 5000,
  "monedaObjetivo": "CUP",
  "idempotencyKey": "ejecutar-anc-xyz-1234567890",  // LA MISMA KEY
  "permitirParcial": false
}
```

**Response (200) - MISMO resultado, sin duplicar:**
```json
{
  "result": {
    "anticipoId": "anc-xyz",
    "estado": "EJECUTADO",
    "saldoDisponible": 0,
    "movimientoId": "mov-abc",
    "idempotentReplay": true  // ← Indica que fue un replay
  }
}
```

✅ **No crea movimiento duplicado. La idempotencia funciona.**

---

#### D) Revertir la ejecución ✨ (NUEVO - ANTES DABA 404)

**Endpoint:**
```
POST http://localhost:3000/api/contabilidad/anticipos/{anticipoId}/revertir
```

**Headers:**
```
Content-Type: application/json
Authorization: Bearer {tu-token}
```

**Body:**
```json
{
  "documentoDestinoId": "compra-999",
  "montoReverso": 5000,
  "observaciones": "Revertir por error"
}
```

**Response (200) - ¡AHORA FUNCIONA!:**
```json
{
  "result": {
    "anticipoId": "anc-xyz",
    "estado": "RESERVADO",
    "saldoDisponible": 5000,
    "movimientoId": "mov-def"
  }
}
```

✅ **El saldo se restauró. El anticipo está de nuevo RESERVADO.**

---

### 4. Probar desde el UI

**En la interfaz web:**

1. Ve a **Contabilidad → Anticipos**
2. Crea un nuevo anticipo (o usa uno existente)
3. Click en el botón "Ejecutar" (o el ícono de play)
4. Ingresa el monto y confirma
5. **Antes:** ❌ Error 404
   **Ahora:** ✅ Éxito, se ejecuta correctamente

---

## 🔍 TROUBLESHOOTING

### Error: "Payload inválido"
```json
{ "error": "Payload inválido", "issues": {...} }
```
**Solución:** Verifica que todos los campos requeridos estén presentes:
- `contexto` (enum)
- `documentoDestinoId` (string)
- `montoObjetivo` (number > 0)
- `monedaObjetivo` (string)
- `idempotencyKey` (string)

### Error: "ANTICIPO_NO_ENCONTRADO"
```json
{ "error": "Anticipo no encontrado", "code": "ANTICIPO_NO_ENCONTRADO" }
```
**Solución:** Verifica que el `anticipoId` sea válido.

### Error: "ANTICIPO_NO_ELEGIBLE"
```json
{ "error": "El anticipo no está en estado reservado", "code": "ANTICIPO_NO_ELEGIBLE" }
```
**Solución:** El anticipo ya fue ejecutado. No se puede ejecutar dos veces.

### Error: "EJECUCION_PARCIAL_NO_PERMITIDA"
```json
{
  "error": "La ejecución parcial del anticipo no está permitida...",
  "code": "EJECUCION_PARCIAL_NO_PERMITIDA",
  "saldoDisponible": 5000,
  "montoObjetivo": 3000
}
```
**Solución:** O bien:
- Ejecuta TODO el saldo (3000 → 5000)
- O agrega `"permitirParcial": true`

### Error: "ANTICIPO_VENCIDO"
```json
{ "error": "El anticipo está vencido", "code": "ANTICIPO_VENCIDO" }
```
**Solución:** El anticipo superó su `vigenciaHasta`. Crea un nuevo anticipo.

---

## ✅ CHECKLIST

- [ ] Los archivos existen: `/[id]/ejecutar/route.ts` y `/[id]/revertir/route.ts`
- [ ] El servidor de desarrollo está corriendo (`npm run dev`)
- [ ] Puedo crear un anticipo sin errores
- [ ] Puedo ejecutar un anticipo SIN error 404 ✨
- [ ] La ejecución cambia el estado a EJECUTADO
- [ ] La ejecución actualiza saldoDisponible
- [ ] Puedo revertir SIN error 404 ✨
- [ ] La reversión restaura el saldo y estado

---

**¿Completaste todos los checks? ¡Entonces está todo listo! 🎉**

Si hay errores, revisa los logs del servidor y el código en:
- `src/app/api/contabilidad/anticipos/[id]/ejecutar/route.ts`
- `src/app/api/contabilidad/anticipos/[id]/revertir/route.ts`

¿Problemas? Preguntá.
