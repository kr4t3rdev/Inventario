# ESPECIFICACIÓN: Tipos de Contratos y Numeración Consecutiva

**Fecha**: 15 de abril de 2026  
**Status**: En Especificación  
**Cambio**: Modificación del modelo `Contrato`

---

## 1. PROPÓSITO

Rediseñar la clasificación de contratos y agregar un sistema de numeración **consecutiva por tipo de contrato**, reemplazando los tipos genéricos actuales por categorías de negocio más claras. Además, permitir que clientes y proveedores guarden su propia referencia de contrato.

---

## 2. REQUISITOS FUNCIONALES

### 2.1 Cambio de Tipos de Contrato

| Tipo Actual | Tipo Nuevo | Descripción |
|-------------|-----------|------------|
| `VENTA` | `COMPRA_VENTA` | Contratos de compra y venta de productos |
| `SERVICIO` | `SERVICIO` | Contratos de prestación de servicios |
| `PROVEEDOR` | `SUMINISTROS` | Contratos de suministro continuo |

**Notas**:
- Los tipos son **mutuamente excluyentes**
- Se usa en reportes, filtros y categorización

### 2.2 Número Consecutivo por Tipo

Cada tipo de contrato debe tener su **propia secuencia** independiente:
- `COMPRA_VENTA`: CV-001, CV-002, CV-003...
- `SERVICIO`: SER-001, SER-002..
- `SUMINISTROS`: SUM-001, SUM-002...

**Campo nuevo**: `numeroConsecutivo` (Integer, autonumérico por tipo)

**Formato del número de contrato**:
```
{PREFIJO}-{NUMERO_CERO_RELLENO}
Ejemplos: CV-0001, SER-0042, SUM-0157
```

### 2.3 Número de Contrato del Cliente/Proveedor

**Campo nuevo**: `numeroContratoClienteProveedor` (String, opcional)

Permite guardar la referencia del contrato según cómo lo identifica el cliente o proveedor:
- Ejemplo: Cliente al enviar el contrato dice "Este es el contrato #PR-2026-04-001"
- Se almacena en `numeroContratoClienteProveedor` = "PR-2026-04-001"
- Útil para conciliación y auditoría

---

## 3. CAMBIOS EN EL SCHEMA

### 3.1 Enum `TipoContrato` (REEMPLAZO)

```prisma
enum TipoContrato {
  COMPRA_VENTA
  SERVICIO
  SUMINISTROS
}
```

### 3.2 Modelo `Contrato` (ADICIONES)

Campos nuevos:
```prisma
numeroConsecutivo        Int      // Secuencia autonumérica por tipo
numeroContratoClienteProveedor String?  // Referencia externa del cliente/proveedor
```

**Restricciones**:
- `numeroConsecutivo` + `tipo` debe ser **única** (composite unique)
- `numeroContrato` sigue siendo única y se genera automáticamente

### 3.3 Generación del Número de Contrato

En la capa de aplicación (API route):

```typescript
// Pseudocódigo
tipo: "COMPRA_VENTA"
numeroConsecutivo: 1  // Obtenido de MAX(numeroConsecutivo) WHERE tipo = "COMPRA_VENTA"
numeroContrato: "CV-0001"  // Generado como: prefijo(tipo) + numeroConsecutivo con ceros
```

**Prefijos por tipo**:
- `COMPRA_VENTA` → `CV`
- `SERVICIO` → `SER`
- `SUMINISTROS` → `SUM`

---

## 4. MIGRACIÓN DE DATOS

### 4.1 Contratos Existentes

Para los contratos ya creados:
1. Mantener `numeroContrato` como está
2. Asignar `numeroConsecutivo` secuencial dentro de su tipo (sortear por `createdAt`)
3. Dejar `numeroContratoClienteProveedor` como NULL

### 4.2 Conversión de Tipos

```sql
-- Mapeo de tipos antiguos a nuevos
UPDATE Contrato SET tipo = 'COMPRA_VENTA' WHERE tipo = 'VENTA';
UPDATE Contrato SET tipo = 'SERVICIO' WHERE tipo = 'SERVICIO';
UPDATE Contrato SET tipo = 'SUMINISTROS' WHERE tipo = 'PROVEEDOR';
```

---

## 5. RESTRICCIONES Y VALIDACIONES

| Regla | Descripción |
|-------|------------|
| Tipo Único | Cada contrato tiene UNO de los 3 tipos |
| Consecutivo Único por Tipo | No puede haber dos contratos con mismo tipo + consecutivo |
| Número Contrato Único | El numero completo (ej: CV-0001) es globalmente único |
| Referencia Opcional | El número del cliente/proveedor es textual y opcional |

---

## 6. ESCENARIOS DE PRUEBA

### Escenario 1: Crear Contrato COMPRA_VENTA
- Usuario crea contrato de tipo COMPRA_VENTA
- Sistema asigna `numeroConsecutivo = 1`
- Sistema genera `numeroContrato = "CV-0001"`
- Usuario ingresa (opcional) `numeroContratoClienteProveedor = "PR-2026-04-001"`

### Escenario 2: Crear Segundo SERVICIO
- Usuario crea contrato de tipo SERVICIO
- Sistema asigna `numeroConsecutivo = 2` (porque ya existe el primero)
- Sistema genera `numeroContrato = "SER-0002"`

### Escenario 3: Migración de Tipos
- Contrato antiguo con tipo VENTA se convierte a COMPRA_VENTA
- Se le asigna consecutivo según su fecha de creación

---

## 7. ARQUITECTURA Y PATRONES

### 7.1 Lógica de Generación de Consecutivo

**Ubicación**: `/src/app/api/contratos/lib/consecutivoGenerator.ts` (nueva)

```typescript
export async function generarProximoConsecutivo(tipo: TipoContrato): Promise<number> {
  const ultimoContrato = await prisma.contrato.findFirst({
    where: { tipo },
    orderBy: { numeroConsecutivo: 'desc' }
  });
  return (ultimoContrato?.numeroConsecutivo || 0) + 1;
}

export function formatearNumeroContrato(tipo: TipoContrato, consecutivo: number): string {
  const prefijos: Record<TipoContrato, string> = {
    COMPRA_VENTA: 'CV',
    SERVICIO: 'SER',
    SUMINISTROS: 'SUM'
  };
  return `${prefijos[tipo]}-${String(consecutivo).padStart(4, '0')}`;
}
```

### 7.2 API Route: POST /api/contratos

**Actualizar**: Validar tipo + generar numeroConsecutivo + formatear numeroContrato

### 7.3 Actualizar Tipos TypeScript

**Regenerar**: `pnpm run prisma:generate` después de migración

---

## 8. DEPENDENCIAS Y RIESGOS

| Aspecto | Riesgo | Mitigación |
|--------|--------|-----------|
| **Migración de Datos** | Pérdida de datos o inconsistencia | Crear migración reversible, hacer backup |
| **Unicidad** | Conflicto de composites keys | Validar antes de insertar |
| **Compatibilidad** | Componentes que usan enum antiguo | Buscar y reemplazar todos los imports |
| **Números Existentes** | ¿Reasignar o mantener? | Mantener numeroContrato, asignar nuevo consecutivo |

---

## 9. ESTADO DE APROBACIÓN

- [ ] Especificación revisada por Arquitecto
- [ ] Migración validada
- [ ] Impacto en UI mapeado
- [ ] Casos de prueba listos

---

## 10. PRÓXIMOS PASOS

→ **TASKS**: Desglose en subtareas implementables  
→ **DESIGN**: Pseudocódigo de funciones críticas  
→ **APPLY**: Implementación fase por fase
