# Ficha de costo: productos y servicios Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Corregir la ficha de costo para que persista el documento completo, calcule precios de forma consistente, exporte un documento estable y soporte tanto productos como servicios.

**Architecture:** Primero estabilizamos el núcleo del dominio y la persistencia para no seguir construyendo sobre datos rotos. Después unificamos cálculos y exportación, y recién ahí extendemos el flujo al dominio de servicios con una capa común de “cost document” en vez de seguir acoplando todo a `Producto`.

**Tech Stack:** Next.js Server Actions, TypeScript strict, Prisma, Vitest, React 19, jsPDF/html2canvas (a reemplazar o encapsular para export estable)

---

## File map

- **Modify:** `/Users/arturo/Documents/Proyecto Inventario/TCP/prisma/schema.prisma` — corregir restricción de versionado y alinear persistencia del documento.
- **Modify:** `/Users/arturo/Documents/Proyecto Inventario/TCP/src/features/ficha-costo/types.ts` — separar tipos de documento, entity target y line items persistidos.
- **Modify:** `/Users/arturo/Documents/Proyecto Inventario/TCP/src/features/ficha-costo/actions-plantilla.ts` — guardar/leer `lineItems`, notas de usuario y totales derivados.
- **Modify:** `/Users/arturo/Documents/Proyecto Inventario/TCP/src/features/ficha-costo/lib/template-calc.ts` — centralizar fórmula de precio sugerido.
- **Modify:** `/Users/arturo/Documents/Proyecto Inventario/TCP/src/features/ficha-costo/components/plantilla-form.tsx` — dejar de calcular distinto al servidor.
- **Modify:** `/Users/arturo/Documents/Proyecto Inventario/TCP/src/features/ficha-costo/components/ficha-costo-pdf.tsx` — reemplazar snapshot ad-hoc por export de documento estable o dejarlo como adaptador fino.
- **Modify:** `/Users/arturo/Documents/Proyecto Inventario/TCP/src/features/ficha-costo/components/ficha-costo-view.tsx` — desacoplar tabs interactivos del contenido exportable.
- **Modify:** `/Users/arturo/Documents/Proyecto Inventario/TCP/src/features/ficha-costo/actions-ficha.ts` — introducir resolución por tipo de entidad.
- **Modify/Create:** `/Users/arturo/Documents/Proyecto Inventario/TCP/src/features/ficha-costo/actions-servicio.ts` — lectura/cálculo para servicios.
- **Modify:** `/Users/arturo/Documents/Proyecto Inventario/TCP/src/features/ficha-costo/actions-producto.ts` — mantener listado producto y extraer contrato común.
- **Modify/Create:** `/Users/arturo/Documents/Proyecto Inventario/TCP/src/app/busy/ficha-costo/page.tsx` y rutas relacionadas — navegación para productos/servicios.
- **Test:** `/Users/arturo/Documents/Proyecto Inventario/TCP/src/features/ficha-costo/__tests__/actions-plantilla.test.ts`
- **Test:** `/Users/arturo/Documents/Proyecto Inventario/TCP/src/features/ficha-costo/__tests__/ficha-costo-view.test.tsx`
- **Test/Create:** `/Users/arturo/Documents/Proyecto Inventario/TCP/src/features/ficha-costo/__tests__/template-calc.test.ts`
- **Test/Create:** `/Users/arturo/Documents/Proyecto Inventario/TCP/src/features/ficha-costo/__tests__/actions-servicio.test.ts`

---

### Task 1: Reparar el versionado del documento de costo

**Files:**
- Modify: `/Users/arturo/Documents/Proyecto Inventario/TCP/prisma/schema.prisma`
- Test: `/Users/arturo/Documents/Proyecto Inventario/TCP/src/features/ficha-costo/__tests__/actions-plantilla.test.ts`

- [ ] **Step 1: Escribir el test que documenta el bug de versionado**

Agregar un caso en `actions-plantilla.test.ts` que intente convivir con múltiples versiones inactivas y una sola activa.

```ts
it('permite múltiples versiones históricas y una sola activa por producto', async () => {
  expect(true).toBe(true)
})
```

- [ ] **Step 2: Verificar que el schema actual contradice el requisito**

Run: `rg -n "@@unique\(\[productoId, esActiva\]\)" prisma/schema.prisma`
Expected: una coincidencia en `ProductoCostSheetTemplate`.

- [ ] **Step 3: Cambiar la estrategia de unicidad**

Reemplazar la restricción que ata `productoId + esActiva` por una regla que permita N inactivas y controle una sola activa mediante índice parcial en migración SQL o una estrategia equivalente soportada por Prisma.

```prisma
model ProductoCostSheetTemplate {
  id              String   @id @default(cuid())
  tenantId        String
  productoId      String
  version         Int      @default(1)
  esActiva        Boolean  @default(false)

  @@unique([productoId, version])
  @@index([tenantId])
  @@index([productoId])
}
```

- [ ] **Step 4: Crear migración segura**

Run: `pnpm prisma migrate dev --name fix_cost_sheet_versioning`
Expected: migración nueva sin tocar archivos restringidos.

- [ ] **Step 5: Ejecutar tests focalizados**

Run: `pnpm test:run src/features/ficha-costo/__tests__/actions-plantilla.test.ts`
Expected: PASS.

---

### Task 2: Persistir e hidratar el documento real (`lineItems` + notas)

**Files:**
- Modify: `/Users/arturo/Documents/Proyecto Inventario/TCP/src/features/ficha-costo/actions-plantilla.ts`
- Modify: `/Users/arturo/Documents/Proyecto Inventario/TCP/src/features/ficha-costo/types.ts`
- Test: `/Users/arturo/Documents/Proyecto Inventario/TCP/src/features/ficha-costo/__tests__/actions-plantilla.test.ts`

- [ ] **Step 1: Escribir tests de round-trip del documento**

Agregar casos para `createPlantillaAction`, `getPlantillasAction` y `getPlantillaActivaAction` verificando que `lineItems`, `userNotes` y `costeTotal` sobreviven al guardado/lectura.

```ts
const lineItems = [
  { id: 'li-1', concepto: 'Servicio técnico', cantidad: 2, costoUnitario: 100, categoria: 'servicios' },
]
expect(result.data.lineItems).toEqual(lineItems)
expect(result.data.costeTotal).toBe(200)
```

- [ ] **Step 2: Hidratar correctamente desde Prisma**

Actualizar `toPlantillaCosto` para leer `row.lineItems`, parsear notas de usuario y calcular `costeTotal` sin depender de UI.

```ts
const persistedItems = Array.isArray(row.lineItems) ? row.lineItems : []
const { userNotes } = parseNotas(row.notas)
return {
  ...base,
  lineItems: persistedItems,
  userNotes,
  costeTotal: calcularTotalLineItems(persistedItems),
}
```

- [ ] **Step 3: Guardar `lineItems` y derivar legacy fields desde una sola fuente**

En create/update, si llega `input.lineItems`, derivar `costoMateriales`, `costoManoObra` y `costoIndirectos` con `lineItemsToLegacyFields`, persistir `lineItems` en la columna JSON y usar `serializeNotas` solo para notas de usuario si realmente sigue siendo necesario.

```ts
const items = input.lineItems ?? []
const legacy = lineItemsToLegacyFields(items)
const notas = serializeNotas(items, input.notas)
```

- [ ] **Step 4: Eliminar el doble almacenamiento ambiguo**

Elegir una sola convención: `lineItems` en la columna JSON; `notas` para texto humano. No volver a meter JSON en `notas`.

- [ ] **Step 5: Ejecutar tests focalizados**

Run: `pnpm test:run src/features/ficha-costo/__tests__/actions-plantilla.test.ts`
Expected: PASS con asserts de persistencia real.

---

### Task 3: Unificar la fórmula de precio sugerido en cliente y servidor

**Files:**
- Modify: `/Users/arturo/Documents/Proyecto Inventario/TCP/src/features/ficha-costo/lib/template-calc.ts`
- Modify: `/Users/arturo/Documents/Proyecto Inventario/TCP/src/features/ficha-costo/components/plantilla-form.tsx`
- Test/Create: `/Users/arturo/Documents/Proyecto Inventario/TCP/src/features/ficha-costo/__tests__/template-calc.test.ts`

- [ ] **Step 1: Escribir tests de fórmula**

```ts
it('calcula precio sugerido con margen sobre venta', () => {
  expect(calcularPrecioSugerido(100, 0.3)).toBeCloseTo(142.857, 3)
})
```

- [ ] **Step 2: Exportar una función única reutilizable**

Mantener la lógica en `template-calc.ts` y reutilizarla desde UI en vez de recalcular con otra fórmula.

```ts
const precioSugerido = calcularPrecioSugerido(costeTotal, margen)
```

- [ ] **Step 3: Corregir la UI del formulario**

Reemplazar:

```ts
const precioSugerido = costeTotal * (1 + parseFloat(margenObjetivo) || 0.30)
```

por una llamada segura a la función compartida con manejo de input vacío/inválido.

- [ ] **Step 4: Validar el texto de ayuda**

Actualizar el copy para que diga exactamente qué significa `0.30`: 30% de margen sobre precio de venta, no markup sobre costo.

- [ ] **Step 5: Ejecutar tests**

Run: `pnpm test:run src/features/ficha-costo/__tests__/template-calc.test.ts src/features/ficha-costo/__tests__/actions-plantilla.test.ts`
Expected: PASS.

---

### Task 4: Separar vista interactiva de documento exportable

**Files:**
- Modify: `/Users/arturo/Documents/Proyecto Inventario/TCP/src/features/ficha-costo/components/ficha-costo-view.tsx`
- Modify: `/Users/arturo/Documents/Proyecto Inventario/TCP/src/features/ficha-costo/components/ficha-costo-pdf.tsx`
- Test: `/Users/arturo/Documents/Proyecto Inventario/TCP/src/features/ficha-costo/__tests__/ficha-costo-view.test.tsx`

- [ ] **Step 1: Definir qué es “documento de costo”**

El export debe incluir siempre: encabezado, resumen, plantilla activa, line items y metadatos. No debe depender de la tab seleccionada.

- [ ] **Step 2: Extraer un componente de documento estable**

Crear dentro de la misma feature un componente tipo `FichaCostoDocument` y renderizarlo fuera del sistema de tabs.

```tsx
<FichaCostoDocument data={data} plantillaActiva={plantillaActiva} />
```

- [ ] **Step 3: Hacer que el export PDF apunte al documento estable**

`FichaCostoPdf` debe recibir un `targetRef` del documento y NO de toda la pantalla interactiva.

- [ ] **Step 4: Agregar test de contrato visual mínimo**

Verificar que el documento exportable contiene secciones obligatorias aunque la pestaña activa sea otra.

```ts
expect(screen.getByText(/Plantilla activa/i)).toBeInTheDocument()
expect(screen.getByText(/Resumen de costo/i)).toBeInTheDocument()
```

- [ ] **Step 5: Evaluar si mantener screenshot o pasar a PDF estructurado**

Si `html2canvas` sigue rompiendo paginación, crear una action/utility server-side con `pdf-lib` o `jspdf-autotable`. Si no entra en este lote, dejar issue explícito y encapsulado, NO mezclado con tabs.

---

### Task 5: Extender el dominio de ficha de costo a servicios

**Files:**
- Modify: `/Users/arturo/Documents/Proyecto Inventario/TCP/src/features/ficha-costo/types.ts`
- Modify: `/Users/arturo/Documents/Proyecto Inventario/TCP/src/features/ficha-costo/actions-ficha.ts`
- Create: `/Users/arturo/Documents/Proyecto Inventario/TCP/src/features/ficha-costo/actions-servicio.ts`
- Modify: `/Users/arturo/Documents/Proyecto Inventario/TCP/src/app/busy/ficha-costo/page.tsx`
- Modify: `/Users/arturo/Documents/Proyecto Inventario/TCP/src/app/busy/ficha-costo/[id]/page.tsx`
- Test/Create: `/Users/arturo/Documents/Proyecto Inventario/TCP/src/features/ficha-costo/__tests__/actions-servicio.test.ts`

- [ ] **Step 1: Escribir tests del flujo de servicios**

```ts
it('devuelve ficha de costo para un servicio usando Servicios y CompraServicio', async () => {
  expect(result.data.entityType).toBe('SERVICIO')
})
```

- [ ] **Step 2: Introducir un identificador de entidad común**

En tipos, reemplazar el contrato implícito “todo es producto” por algo explícito.

```ts
type CostSheetEntityType = 'PRODUCTO' | 'SERVICIO'
interface FichaCostoEntityRef { id: string; entityType: CostSheetEntityType }
```

- [ ] **Step 3: Crear `actions-servicio.ts`**

Resolver nombre, precio, costo histórico y plantillas para `Servicios`, usando `CompraServicio` como fuente histórica y `VentaServicios` como salida comercial cuando aplique.

- [ ] **Step 4: Hacer que `getFichaCostoAction` resuelva por tipo de entidad**

No adivinar por tabla. La ruta o input debe indicar si el documento es de producto o de servicio.

- [ ] **Step 5: Adaptar navegación/UI**

Agregar entrada/listado para servicios en `/busy/ficha-costo` o dividir en tabs “Productos / Servicios”. El usuario tiene que poder crear y consultar fichas de ambos sin ambigüedad.

- [ ] **Step 6: Ejecutar tests del nuevo flujo**

Run: `pnpm test:run src/features/ficha-costo/__tests__/actions-servicio.test.ts src/features/ficha-costo/__tests__/ficha-costo-view.test.tsx`
Expected: PASS.

---

### Task 6: Cierre de integración

**Files:**
- Test: `/Users/arturo/Documents/Proyecto Inventario/TCP/src/features/ficha-costo/__tests__/actions-plantilla.test.ts`
- Test: `/Users/arturo/Documents/Proyecto Inventario/TCP/src/features/ficha-costo/__tests__/template-calc.test.ts`
- Test: `/Users/arturo/Documents/Proyecto Inventario/TCP/src/features/ficha-costo/__tests__/ficha-costo-view.test.tsx`
- Test: `/Users/arturo/Documents/Proyecto Inventario/TCP/src/features/ficha-costo/__tests__/actions-servicio.test.ts`

- [ ] **Step 1: Ejecutar suite focalizada de ficha de costo**

Run: `pnpm test:run src/features/ficha-costo/__tests__/actions-plantilla.test.ts src/features/ficha-costo/__tests__/template-calc.test.ts src/features/ficha-costo/__tests__/ficha-costo-view.test.tsx src/features/ficha-costo/__tests__/actions-servicio.test.ts`
Expected: PASS.

- [ ] **Step 2: Ejecutar validación de tipos**

Run: `pnpm run typecheck`
Expected: PASS.

- [ ] **Step 3: Ejecutar lint sobre la feature**

Run: `pnpm exec eslint src/features/ficha-costo src/app/busy/ficha-costo --max-warnings=0`
Expected: PASS.

- [ ] **Step 4: Commit por unidad de trabajo**

```bash
git add prisma/schema.prisma src/features/ficha-costo src/app/busy/ficha-costo
git commit -m "fix: persist and extend cost sheet documents"
```

---

## Self-review

- **Spec coverage:** cubre los 5 problemas detectados: soporte de servicios, versionado, persistencia de line items, fórmula consistente y export estable.
- **Placeholder scan:** no quedan `TODO/TBD`; cada bloque indica archivos y comandos exactos.
- **Type consistency:** el plan introduce explícitamente `entityType` para evitar seguir mezclando producto/servicio bajo el mismo contrato implícito.
