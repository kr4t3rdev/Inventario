# TASKS: Tipos de Contratos y Numeración Consecutiva

**Documento Referencia**: [SPEC_CONTRATOS_NUMERACION.md](SPEC_CONTRATOS_NUMERACION.md)  
**Última Actualización**: 15 de abril de 2026

---

## FASE 1: CAMBIOS EN SCHEMA Y DATOS

### TASK 1.1: Actualizar Enum `TipoContrato` en schema.prisma
**Estimated**: 15 minutos  
**Depende de**: Nada  
**Bloqueador para**: 1.2, 2.1, 2.2

**Descripción**:
- Reemplazar valores del enum `TipoContrato` en `prisma/schema.prisma`
- VENTA → COMPRA_VENTA
- SERVICIO → SERVICIO (sin cambio)
- PROVEEDOR → SUMINISTROS

**Checklist**:
- [ ] Abrir `prisma/schema.prisma`
- [ ] Localizar enum `TipoContrato` (línea ~1479)
- [ ] Reemplazar VENTA por COMPRA_VENTA
- [ ] Reemplazar PROVEEDOR por SUMINISTROS
- [ ] Mantener SERVICIO igual
- [ ] Guardar archivo

**Salida**:
```prisma
enum TipoContrato {
  COMPRA_VENTA
  SERVICIO
  SUMINISTROS
}
```

---

### TASK 1.2: Agregar Campos Nuevos al Modelo `Contrato`
**Estimated**: 20 minutos  
**Depende de**: TASK 1.1  
**Bloqueador para**: 1.3

**Descripción**:
- Agregar dos campos al modelo `Contrato` en schema.prisma
- Campo 1: `numeroConsecutivo` (Int, único por tipo)
- Campo 2: `numeroContratoClienteProveedor` (String?, opcional)

**Checklist**:
- [ ] Abrir `prisma/schema.prisma`
- [ ] Localizar modelo `Contrato` (línea ~932)
- [ ] Agregar después de `numeroContrato`:
  ```prisma
  numeroConsecutivo                  Int
  numeroContratoClienteProveedor     String?
  ```
- [ ] Agregar composite unique (después de @@unique o al final del modelo):
  ```prisma
  @@unique([tipo, numeroConsecutivo])
  ```
- [ ] Guardar

**Notas**:
- El campo `numeroConsecutivo` NO tiene default; se genera en la aplicación
- El composite unique asegura que no haya duplicados por tipo
- El campo `numeroContratoClienteProveedor` es para referencia externa (nullable)

**Salida**: Modelo modificado sin dependencias rotas

---

### TASK 1.3: Crear Migración Prisma
**Estimated**: 10 minutos  
**Depende de**: TASK 1.2  
**Bloqueador para**: 1.4

**Descripción**:
- Generar archivo de migración automático desde cambios en schema.prisma

**Checklist**:
- [ ] Terminal: `pnpm prisma migrate dev --name add_contrato_consecutivo_and_cliente_numero`
- [ ] Revisar el archivo `.sql` generado en `prisma/migrations/`
- [ ] Verificar que:
  - [ ] ALTER TABLE agrega `numeroConsecutivo` (INT, NOT NULL required temporalmente)
  - [ ] ALTER TABLE agrega `numeroContratoClienteProveedor` (VARCHAR, NULL)
  - [ ] Se crea constraint UNIQUE (tipo, numeroConsecutivo)
- [ ] Confirmar migración si sale bien

**Salida**: Archivo `.sql` en `prisma/migrations/YYYYMMDDHHMMSS_add_contrato_consecutivo_and_cliente_numero/`

---

### TASK 1.4: Migración de Datos Existentes (Backward-Compatible)
**Estimated**: 30 minutos  
**Depende de**: TASK 1.3  
**Bloqueador para**: APPLY

**Descripción**:
- Crear SQL/script que asigne `numeroConsecutivo` a contratos existentes
- Mantener `numeroContrato` como está
- Mapear tipos antiguos a nuevos

**Checklist**:
- [ ] Crear script en `prisma/seed-migrations/migrate-contrato-tipos.sql`
- [ ] **NO** correr automáticamente; ejecutar manualmente post-deploy
- [ ] El script debe:
  1. Asignar `numeroConsecutivo` secuencial POR TIPO, ordenado por `createdAt`
  2. Convertir tipos: VENTA→COMPRA_VENTA, PROVEEDOR→SUMINISTROS
  3. Dejar `numeroContratoClienteProveedor` como NULL
  4. Validar integridad después

**Ejemplo de lógica**:
```sql
-- Asignar consecutivos a COMPRA_VENTA
UPDATE Contrato c
SET numeroConsecutivo = (
  SELECT ROW_NUMBER() OVER (ORDER BY createdAt ASC)
  FROM Contrato c2
  WHERE c2.tipo = 'VENTA' AND c2.createdAt <= c.createdAt
)
WHERE tipo = 'VENTA';

-- Cambiar tipo
UPDATE Contrato SET tipo = 'COMPRA_VENTA' WHERE tipo = 'VENTA';
UPDATE Contrato SET tipo = 'SUMINISTROS' WHERE tipo = 'PROVEEDOR';
```

**Salida**: Script validado, documentado y listo para ejecutar

---

## FASE 2: LÓGICA DE APLICACIÓN

### TASK 2.1: Crear Utilidad de Generación de Consecutivo
**Estimated**: 25 minutos  
**Depende de**: TASK 1.2  
**Bloqueador para**: 2.2, 2.3

**Descripción**:
- Archivo nuevo: `/src/app/api/contratos/lib/numeroContratoGenerator.ts`
- Exportar dos funciones:
  1. `generarProximoConsecutivo(tipo)` → número siguiente
  2. `formatearNumeroContrato(tipo, consecutivo)` → string formateado

**Checklist**:
- [ ] Crear archivo `src/app/api/contratos/lib/numeroContratoGenerator.ts`
- [ ] Implementar `generarProximoConsecutivo()`:
  - Buscar MAX(numeroConsecutivo) WHERE tipo = X
  - Retornar +1
  - Manejar caso donde no hay contratos (retornar 1)
- [ ] Implementar `formatearNumeroContrato()`:
  - Mapeo de tipos a prefijos (CV, SER, SUM)
  - Retornar "${prefijo}-${String(num).padStart(4, '0')}"
- [ ] Agregar JSDoc a ambas funciones
- [ ] Escribir tests en `src/app/api/contratos/lib/numeroContratoGenerator.test.ts`

**Tests a cubrir**:
- [ ] Primo consecutivo de tipo COMPRA_VENTA es 1
- [ ] Segundo consecutivo es 2
- [ ] Formato CV-0001, SER-0042, SUM-0157
- [ ] Manejo de NULL/undefined

**Salida**: Utilidad completa y testeada

---

### TASK 2.2: Actualizar API Route POST /api/contratos
**Estimated**: 30 minutos  
**Depende de**: TASK 2.1  
**Bloqueador para**: 2.3

**Descripción**:
- Modificar `src/app/api/contratos/route.ts` (POST handler)
- Agregar lógica para:
  1. Validar que `tipo` sea uno de los 3 nuevos
  2. Generar `numeroConsecutivo` usando TASK 2.1
  3. Generar `numeroContrato` formateado usando TASK 2.1
  4. Guardar `numeroContratoClienteProveedor` si se envía

**Checklist**:
- [ ] Localizar POST handler en `src/app/api/contratos/route.ts`
- [ ] Importar utilidades de 2.1
- [ ] Antes de `prisma.contrato.create()`:
  ```typescript
  const numeroConsecutivo = await generarProximoConsecutivo(tipo);
  const numeroContrato = formatearNumeroContrato(tipo, numeroConsecutivo);
  ```
- [ ] Pasar ambos al create:
  ```typescript
  numeroConsecutivo,
  numeroContrato,
  numeroContratoClienteProveedor: body.numeroContratoClienteProveedor || null,
  ```
- [ ] Validar input con Zod (schema debe incluir `numeroContratoClienteProveedor?`)

**Salida**: API route funcionando con numeración automática

---

### TASK 2.3: Actualizar Validación Zod si existe
**Estimated**: 15 minutos  
**Depende de**: TASK 2.1  
**Bloqueador para**: Tests

**Descripción**:
- Buscar schema Zod que valida POST /api/contratos
- Actualizar enum de `tipo` con nuevos valores
- Agregar campo opcional `numeroContratoClienteProveedor`

**Checklist**:
- [ ] Buscar `createContratoSchema` o similar en `src/lib/validations/` o `src/app/api/contratos/`
- [ ] Actualizar:
  ```typescript
  tipo: z.enum(['COMPRA_VENTA', 'SERVICIO', 'SUMINISTROS']),
  numeroContratoClienteProveedor: z.string().optional(),
  ```
- [ ] Confirmar que el resto del schema sigue válido

**Salida**: Schema validado para nuevos campos

---

## FASE 3: COMPONENTES Y UI

### TASK 3.1: Actualizar Select/Dropdown de Tipo Contrato
**Estimated**: 25 minutos  
**Depende de**: TASK 1.1  
**Bloqueador para**: Testing

**Descripción**:
- Buscar todos los lugares donde se muestra un select de tipo contrato
- Reemplazar opciones VENTA/SERVICIO/PROVEEDOR por COMPRA_VENTA/SERVICIO/SUMINISTROS

**Checklist**:
- [ ] Buscar archivos con "VENTA\|SERVICIO\|PROVEEDOR" en componentes
- [ ] Actualizar:
  - [ ] Componentes de formulario de contrato
  - [ ] Dropdowns de filtro
  - [ ] Opciones hardcodeadas
  - [ ] Constantes

**Archivos típicos a revisar**:
- `src/app/(dashboard)/contratos/**/form.tsx`
- `src/components/**/*-form.tsx`
- `src/lib/constants.ts`

**Salida**: UI reflejando nuevos tipos

---

### TASK 3.2: Agregar Campo de Entrada: Número Contrato Cliente/Proveedor
**Estimated**: 20 minutos  
**Depende de**: TASK 2.3  
**Bloqueador para**: Testing

**Descripción**:
- En formulario de creación de contrato, agregar campo optional:
  - Label: "Número de Contrato (Cliente/Proveedor)"
  - Placeholder: "Ej: PR-2026-04-001"
  - Help text: "Referencia con la cual el cliente/proveedor identifica este contrato"

**Checklist**:
- [ ] Localizar formulario de creación/edición de contrato
- [ ] Agregar Input field después del número de contrato actual:
  ```typescript
  <FormField
    control={form.control}
    name="numeroContratoClienteProveedor"
    render={({ field }) => (
      <FormItem>
        <FormLabel>Número de Contrato (Cliente/Proveedor)</FormLabel>
        <FormControl>
          <Input {...field} placeholder="Ej: PR-2026-04-001" />
        </FormControl>
        <FormDescription>Referencia del cliente/proveedor</FormDescription>
      </FormItem>
    )}
  />
  ```
- [ ] Validar que el tipo está en el hook del formulario

**Salida**: Nuevo campo visible y funcional en formulario

---

## FASE 4: REGENERACIÓN Y TIPOS TYPESCRIPT

### TASK 4.1: Regenerar Tipos Prisma
**Estimated**: 5 minutos  
**Depende de**: TASK 1.3  
**Bloqueador para**: APPLY

**Descripción**:
- Regenerar tipos TypeScript desde schema.prisma

**Checklist**:
- [ ] Terminal: `pnpm prisma generate`
- [ ] Verificar que `node_modules/.prisma/client/` se actualizó
- [ ] Commit de cambios en `prisma.d.ts` si existe

**Salida**: Tipos TypeScript actualizados

---

### TASK 4.2: Buscar y Reemplazar Referencias Antiguas de Tipos
**Estimated**: 30 minutos  
**Depende de**: TASK 4.1  
**Bloqueador para**: Testing

**Descripción**:
- Buscar en el código cualquier hardcode de los tipos viejos
- Reemplazar VENTA → COMPRA_VENTA, PROVEEDOR → SUMINISTROS

**Checklist**:
- [ ] Terminal: `rg "tipo.*VENTA|tipo.*PROVEEDOR" src/ --type ts --type tsx`
- [ ] Revisar cada match
- [ ] Reemplazar según contexto:
  - Si es enum/tipo: actualizar a nuevo
  - Si es string literal: cambiar
  - Si es comentario o doc: actualizar también
- [ ] Asegurar que no haya valores hardcodeados en arrays/objetos

**Búsquedas típicas**:
```
TipoContrato.VENTA
'VENTA'
tipo === 'VENTA'
tipo === 'PROVEEDOR'
```

**Salida**: Codebase limpio sin referencias antiguas

---

## FASE 5: TESTING Y VALIDACIÓN

### TASK 5.1: Escribir Tests Unitarios (Utilidades)
**Estimated**: 25 minutos  
**Depende de**: TASK 2.1  
**Bloqueador para**: VERIFY

**Descripción**:
- Tests para `numeroContratoGenerator.ts`
- Mock de Prisma
- Cubrir casos edge

**Checklist**:
- [ ] Archivo: `src/app/api/contratos/lib/numeroContratoGenerator.test.ts`
- [ ] Tests:
  - [ ] `generarProximoConsecutivo()` cuando no hay contratos (retorna 1)
  - [ ] `generarProximoConsecutivo()` cuando hay N contratos (retorna N+1)
  - [ ] `formatearNumeroContrato()` formula correcta
  - [ ] `formatearNumeroContrato()` padding ceros
  - [ ] Todos los 3 tipos (COMPRA_VENTA, SERVICIO, SUMINISTROS)

**Comando**: `pnpm test -- numeroContratoGenerator.test.ts`

**Salida**: Tests passing ✅

---

### TASK 5.2: Test de Integración: POST /api/contratos
**Estimated**: 30 minutos  
**Depende de**: TASK 2.2, TASK 2.3  
**Bloqueador para**: VERIFY

**Descripción**:
- Test E2E o integración del endpoint POST
- Validar que consecutivo se asigna automáticamente
- Validar que numero se formatea correctamente

**Checklist**:
- [ ] Crear o actualizar `src/app/api/contratos/__tests__/post.test.ts`
- [ ] Tests:
  - [ ] POST con tipo COMPRA_VENTA genera CV-0001
  - [ ] POST segundo COMPRA_VENTA genera CV-0002
  - [ ] POST con tipo SERVICIO genera SER-0001 (independiente de COMPRA_VENTA)
  - [ ] POST con numeroContratoClienteProveedor se guarda
  - [ ] Validación rechaza tipo inválido
  - [ ] Validación requiere tipo
  
**Comando**: `pnpm test -- contratos.*post`

**Salida**: Tests passing ✅

---

### TASK 5.3: Validación Manual en Base de Datos
**Estimated**: 20 minutos  
**Depende de**: TASK 1.4  
**Bloqueador para**: DEPLOY

**Descripción**:
- Verificar que:
  1. Esquema está correcto (nuevos campos visibles)
  2. Datos migrados tienen consecutivos asignados
  3. Constraint unique funciona (intento de duplicado falla)

**Checklist**:
- [ ] `pnpm prisma studio` abre interfaz gráfica
- [ ] Verificar tabla `Contrato`:
  - [ ] Columna `numeroConsecutivo` existe y tiene valores
  - [ ] Columna `numeroContratoClienteProveedor` existe (nullable)
  - [ ] Tipos mostrados son los nuevos
- [ ] Intentar insertar contrato con mismo (tipo, numeroConsecutivo) → debe fallar
- [ ] Crear nuevo contrato vía UI → debe recibir consecutivo automático

**Salida**: Base de datos validada ✅

---

### TASK 5.4: Testing Manual de Componentes
**Estimated**: 20 minutos  
**Depende de**: TASK 3.1, TASK 3.2  
**Bloqueador para**: DEPLOY

**Descripción**:
- Probar en navegador:
  1. Crear contrato → dropdowns muestran nuevos tipos
  2. Seleccionar tipo → crear → número se genera automático
  3. Nuevo campo de "número cliente" aparece y se guarda
  4. Editar contrato → tipos correctos en dropdown
  5. Listar contratos → filtros por tipo funcionan

**Checklist**:
- [ ] Abrir `/contratos/crear`
- [ ] Verificar dropdown de tipo tiene: COMPRA_VENTA, SERVICIO, SUMINISTROS
- [ ] Verificar campo "Número de Contrato (Cliente/Proveedor)" existe
- [ ] Crear contrato tipo COMPRA_VENTA:
  - [ ] numeroContrato generado como CV-0001
  - [ ] numeroConsecutivo guardado como 1
  - [ ] Puede dejar vacío o completar número cliente
- [ ] Crear segundo COMPRA_VENTA:
  - [ ] numeroContrato es CV-0002 ✅
- [ ] Crear SERVICIO:
  - [ ] numeroContrato es SER-0001 (nueva secuencia) ✅
- [ ] Filtrar por tipo → sin errores

**Salida**: Funcionalidad testeada y aprobada ✅

---

## RESUMEN DE FLUJO

```
FASE 1: Schema + Datos
  ↓
  ├─ TASK 1.1: Enum (15m)
  ├─ TASK 1.2: Campos (20m)
  ├─ TASK 1.3: Migración (10m)
  └─ TASK 1.4: Datos históricos (30m)

FASE 2: Lógica
  ↓
  ├─ TASK 2.1: Generador (25m)
  ├─ TASK 2.2: API Route (30m)
  └─ TASK 2.3: Validación Zod (15m)

FASE 3: UI
  ↓
  ├─ TASK 3.1: Select tipo (25m)
  └─ TASK 3.2: Campo cliente número (20m)

FASE 4: TypeScript
  ↓
  ├─ TASK 4.1: Prisma generate (5m)
  └─ TASK 4.2: Reemplazar refs (30m)

FASE 5: Testing
  ↓
  ├─ TASK 5.1: Unit tests (25m)
  ├─ TASK 5.2: Integration tests (30m)
  ├─ TASK 5.3: DB validation (20m)
  └─ TASK 5.4: Manual testing (20m)

TOTAL: ~5.5 horas estimadas
```

---

## NOTAS IMPORTANTES

1. **Reversibilidad**: Cada task genera salida que se puede validar
2. **Orden**: Respetar dependencias; no saltarse tasks
3. **Comunicación**: Si algo falla, reportar en qué task
4. **Rollback**: Para revertir, ejecutar `pnpm prisma migrate resolve --rolled-back` si es necesario
5. **Backup**: Hacer backup DE BASE DE DATOS antes de TASK 1.3 en prod

---

## ESTADO

- [ ] Fase 1: Completada
- [ ] Fase 2: Completada
- [ ] Fase 3: Completada
- [ ] Fase 4: Completada
- [ ] Fase 5: Completada
- [ ] READY FOR DEPLOY
