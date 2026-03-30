# Migración de Sonner a Sileo - Especificación Completa

## Propósito

Este documento establece la especificación para migrar todas las notificaciones `toast` de la biblioteca **Sonner** a la biblioteca **Sileo** en todo el proyecto TCP. El objetivo es unificar el sistema de notificaciones y aprovechar las ventajas de Sileo.

## Contexto

El proyecto actualmente utiliza `sonner` para notificaciones toast en **45 archivos** con **451 llamadas** a métodos toast (success, error, warning, info). Esta migración debe realizarse de forma sistemática para no introducir regresiones.

## Requisitos del Sistema

### Requisito: Reemplazo de Importaciones

El sistema DEBE reemplazar todas las importaciones de `sonner` por `sileo`.

**Cambio requerido:**
```typescript
// Antes (Sonner)
import { toast } from 'sonner'

// Después (Sileo)
import { sileo } from 'sileo'
```

**Casos especiales:**
- Si el archivo tiene `Toaster` de sonner: eliminarlo (Sileo maneja su propio Provider)
- Si el archivo tiene `sonner` en comentarios: actualizar si es relevante

#### Escenario: Reemplazo básico de importación

- GIVEN un archivo con `import { toast } from 'sonner'`
- WHEN se ejecuta la migración
- THEN el import se cambia a `import { sileo } from 'sileo'`

---

### Requisito: Reemplazo de Métodos Toast

El sistema DEBE reemplazar todas las llamadas a métodos de toast por los equivalentes en Sileo.

**Mapeo de métodos:**

| Sonner | Sileo | Uso |
|--------|-------|-----|
| `toast.success('mensaje')` | `sileo.success({ title: 'mensaje' })` | Operaciones exitosas |
| `toast.error('mensaje')` | `sileo.error({ title: 'mensaje' })` | Errores |
| `toast.warning('mensaje')` | `sileo.warning({ title: 'mensaje' })` | Advertencias |
| `toast.info('mensaje')` | `sileo.info({ title: 'mensaje' })` | Información |
| `toast('mensaje')` | `sileo.info({ title: 'mensaje' })` | Notificación genérica |

**Casos con opciones:**
```typescript
// Antes (Sonner)
toast.success('Mensaje', { duration: 5000 })
toast.error('Error', { id: 'unique' })

// Después (Sileo)
sileo.success({ title: 'Mensaje' })
sileo.error({ title: 'Error' })
```

**Nota:** Sileo no acepta opciones como duration o id en el primer nivel del objeto. Estas opciones se ignoran o se manejan internamente.

#### Escenario: Reemplazo de toast.success

- GIVEN un archivo con `toast.success('Producto guardado exitosamente')`
- WHEN se ejecuta la migración
- THEN se convierte a `sileo.success({ title: 'Producto guardado exitosamente' })`

#### Escenario: Reemplazo de toast.error

- GIVEN un archivo con `toast.error('Error al guardar el producto')`
- WHEN se ejecuta la migración
- THEN se convierte a `sileo.error({ title: 'Error al guardar el producto' })`

#### Escenario: Reemplazo de toast.info

- GIVEN un archivo con `toast.info('Procesando...')`
- WHEN se ejecuta la migración
- THEN se convierte a `sileo.info({ title: 'Procesando...' })`

---

### Requisito: Verificación Post-Migración

El sistema DEBE verificar que no queden importaciones o usos de Sonner después de la migración.

**Comandos de verificación:**
```bash
# Buscar importaciones de sonner
grep -r "from 'sonner'" src/

# Buscar usos de toast.
grep -r "toast\." src/
```

---

## Inventario de Archivos por Módulo

### Módulo: Productos (5 archivos)

| # | Archivo | Estado | Prioridad |
|---|--------|--------|----------|
| 1 | `src/components/productos/productos-form.tsx` | ❌ Por migrar | Alta |
| 2 | `src/components/productos/restock-form.tsx` | ❌ Por migrar | Alta |
| 3 | `src/components/productos/bulk-stock-minimo-manager.tsx` | ❌ Por migrar | Media |
| 4 | `src/components/productos/product-photo-upload.tsx` | ❌ Por migrar | Baja |
| 5 | `src/components/productos/__tests__/productos-form.test.tsx` | ⏸️ Tests | - |

### Módulo: Servicios (4 archivos)

| # | Archivo | Estado | Prioridad |
|---|--------|--------|----------|
| 1 | `src/components/servicios/servicios-form.tsx` | ❌ Por migrar | Alta |
| 2 | `src/components/servicios/servicios-recibidos-form.tsx` | ❌ Por migrar | Alta |
| 3 | `src/components/servicios/servicios-prestados-form.tsx` | ❌ Por migrar | Alta |
| 4 | `src/app/busy/servicios/page.tsx` | ❌ Por migrar | Media |
| 5 | `src/components/servicios/__tests__/servicios-form.test.tsx` | ⏸️ Tests | - |

### Módulo: Ventas/Punto de Venta (4 archivos)

| # | Archivo | Estado | Prioridad |
|---|--------|--------|----------|
| 1 | `src/components/ventas/pv-interface.tsx` | ❌ Por migrar | Alta |
| 2 | `src/components/ofertas/oferta-form.tsx` | ❌ Por migrar | Alta |
| 3 | `src/app/busy/ofertas/[id]/page.tsx` | ❌ Por migrar | Alta |
| 4 | `src/app/busy/puntosDeVenta/page.tsx` | ❌ Por migrar | Media |

### Módulo: Empleados (5 archivos)

| # | Archivo | Estado | Prioridad |
|---|--------|--------|----------|
| 1 | `src/components/empleados/empleados-form.tsx` | ❌ Por migrar | Alta |
| 2 | `src/components/empleados/nomina-view.tsx` | ❌ Por migrar | Alta |
| 3 | `src/components/empleados/vacaciones-form.tsx` | ❌ Por migrar | Media |
| 4 | `src/components/empleados/enhanced-empleados-form.tsx` | ❌ Por migrar | Media |
| 5 | `src/components/empleados/asistencia-form.tsx` | ❌ Por migrar | Media |

### Módulo: Contabilidad (18 archivos)

| # | Archivo | Estado | Prioridad |
|---|--------|--------|----------|
| 1 | `src/app/busy/contabilidad/cuentas/page.tsx` | ❌ Por migrar | Alta |
| 2 | `src/app/busy/contabilidad/cuentas-por-pagar/page.tsx` | ❌ Por migrar | Alta |
| 3 | `src/components/contabilidad/cuenta-bancaria-form.tsx` | ❌ Por migrar | Alta |
| 4 | `src/components/contabilidad/cuentas-table.tsx` | ❌ Por migrar | Alta |
| 5 | `src/components/contabilidad/cuentas-por-pagar-table.tsx` | ❌ Por migrar | Alta |
| 6 | `src/components/contabilidad/cuentas-por-cobrar-table.tsx` | ❌ Por migrar | Alta |
| 7 | `src/components/contabilidad/tipos-pago-config-page.tsx` | ❌ Por migrar | Alta |
| 8 | `src/components/contabilidad/tipos-pago-table.tsx` | ❌ Por migrar | Alta |
| 9 | `src/components/contabilidad/transferencia-bancaria-form.tsx` | ❌ Por migrar | Alta |
| 10 | `src/components/contabilidad/reportes-analytics-page.tsx` | ❌ Por migrar | Media |
| 11 | `src/components/contabilidad/exchange-manager.tsx` | ❌ Por migrar | Media |
| 12 | `src/components/contabilidad/resumen-financiero.tsx` | ❌ Por migrar | Media |
| 13 | `src/components/contabilidad/pagar-cuenta-por-pagar-dialog.tsx` | ❌ Por migrar | Media |
| 14 | `src/components/contabilidad/ajuste-bancario-form.tsx` | ❌ Por migrar | Media |
| 15 | `src/components/contabilidad/enhanced-form-wrapper.tsx` | ❌ Por migrar | Baja |
| 16 | `src/components/contabilidad/toast-notifications.tsx` | ❌ Por migrar | Baja |
| 17 | `src/components/contabilidad/capital/capital-form.tsx` | ❌ Por migrar | Media |

### Módulo: Restaurante (8 archivos)

| # | Archivo | Estado | Prioridad |
|---|--------|--------|----------|
| 1 | `src/app/busy/restaurante/pos/page.tsx` | ❌ Por migrar | Alta |
| 2 | `src/app/busy/restaurante/caja/page.tsx` | ❌ Por migrar | Alta |
| 3 | `src/app/busy/restaurante/kds/page.tsx` | ❌ Por migrar | Media |
| 4 | `src/app/busy/restaurante/produccion/page.tsx` | ❌ Por migrar | Media |
| 5 | `src/app/busy/restaurante/recetas/page.tsx` | ❌ Por migrar | Media |
| 6 | `src/app/busy/restaurante/carta/page.tsx` | ❌ Por migrar | Media |
| 7 | `src/app/busy/restaurante/ticket/[id]/page.tsx` | ❌ Por migrar | Baja |
| 8 | `src/components/restaurante/mesas-board.tsx` | ❌ Por migrar | Media |

### Módulo: Admin/Sistema (8 archivos)

| # | Archivo | Estado | Prioridad |
|---|--------|--------|----------|
| 1 | `src/components/admin/create-user-dialog.tsx` | ❌ Por migrar | Alta |
| 2 | `src/components/admin/edit-user-dialog.tsx` | ❌ Por migrar | Alta |
| 3 | `src/components/admin/admin-users-table.tsx` | ❌ Por migrar | Alta |
| 4 | `src/components/admin/migrate-cuentas-por-pagar-button.tsx` | ❌ Por migrar | Baja |
| 5 | `src/app/busy/planes/page.tsx` | ❌ Por migrar | Media |
| 6 | `src/app/busy/licencias/page.tsx` | ❌ Por migrar | Media |
| 7 | `src/app/busy/listas-precios/page.tsx` | ❌ Por migrar | Media |
| 8 | `src/components/file-upload.tsx` | ❌ Por migrar | Baja |

### Módulo: Otros Componentes (8 archivos)

| # | Archivo | Estado | Prioridad |
|---|--------|--------|----------|
| 1 | `src/components/vendor/vendor-logo-upload.tsx` | ❌ Por migrar | Baja |
| 2 | `src/components/clientes/cliente-logo-upload.tsx` | ❌ Por migrar | Baja |
| 3 | `src/components/transferencias/transferencias-form.tsx` | ❌ Por migrar | Alta |
| 4 | `src/hooks/use-category-validation.tsx` | ❌ Por migrar | Baja |
| 5 | `src/app/busy/unidad/page.tsx` | ❌ Por migrar | Media |
| 6 | `src/app/busy/reparaciones/page.tsx` | ❌ Por migrar | Media |
| 7 | `src/app/layout.tsx` | ⏸️ Evaluar | - |

### Compras Productos - YA MIGRADOS ✅

| # | Archivo | Estado |
|---|--------|--------|
| 1 | `src/components/compras/compra-producto-form.tsx` | ✅ Completado |
| 2 | `src/app/busy/compras-productos/page.tsx` | ✅ Completado |
| 3 | `src/app/busy/compras-productos/[id]/edit/page.tsx` | ✅ Completado |

---

## Casos Especiales

### Caso 1: Toast con promesas

```typescript
// Antes
toast.promise(promise, {
  loading: 'Cargando...',
  success: 'Éxito',
  error: 'Error'
})

// Después - Separar en try/catch
try {
  sileo.info({ title: 'Cargando...' })
  await promise
  sileo.success({ title: 'Éxito' })
} catch (error) {
  sileo.error({ title: 'Error' })
}
```

### Caso 2: Toast con componentes JSX

```typescript
// Antes
toast(<div>Contenido personalizado</div>)

// Después - Simplificar a texto
sileo.info({ title: 'Contenido personalizado' })
```

### Caso 3: Toast con acciones (buttons)

```typescript
// Antes
toast('Mensaje', {
  action: { label: 'Undo', onClick: () => {} }
})

// Después - Sin acciones por ahora (Sileo no soporta)
sileo.info({ title: 'Mensaje' })
// Nota: Las acciones se deben implementar de otra forma
```

---

## Proceso de Migración Recomendado

### Fase 1: Migración de Alta Prioridad (10 archivos)
1. `src/components/productos/productos-form.tsx`
2. `src/components/servicios/servicios-form.tsx`
3. `src/components/ventas/pv-interface.tsx`
4. `src/components/empleados/nomina-view.tsx`
5. `src/app/busy/contabilidad/cuentas/page.tsx`
6. `src/app/busy/contabilidad/cuentas-por-pagar/page.tsx`
7. `src/app/busy/restaurante/pos/page.tsx`
8. `src/app/busy/restaurante/caja/page.tsx`
9. `src/components/admin/create-user-dialog.tsx`
10. `src/components/admin/edit-user-dialog.tsx`

### Fase 2: Migración de Prioridad Media (20 archivos)
- Todos los listados como prioridad "Media"

### Fase 3: Migración de Prioridad Baja (15 archivos)
- Todos los listados como prioridad "Baja"

### Fase 4: Verificación Final
- Ejecutar búsqueda de archivos restantes con Sonner
- Compilar el proyecto
- Probar manualmente las notificaciones

---

## Validaciones

### Requisito: Compilación Exitosa

El sistema DEBE compilar sin errores después de la migración.

**Verificación:**
```bash
pnpm run build
```

**Criterios de éxito:**
- ✅ No hay errores de TypeScript
- ✅ No hay errores de ESLint relacionados con imports
- ✅ La aplicación inicia correctamente

---

## Historial de Cambios

| Versión | Fecha | Descripción |
|---------|-------|-------------|
| 1.0 | 2026-03-27 | Versión inicial - especificación de migración |
