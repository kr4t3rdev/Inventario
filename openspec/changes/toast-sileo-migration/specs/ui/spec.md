# Delta for UI Notifications (Toast System)

## Purpose

Reemplazar la librería de notificaciones toast Sonner por Sileo en toda la aplicación. Sileo ofrece animaciones basadas en física con efectos SVG morphing, API similar, y mejor integración visual con el diseño de la app.

## Context

- **Librería actual**: Sonner (`sonner@^1.7.0`)
- **Librería destino**: Sileo (`sileo`)
- **Archivos afectados**: ~100+ archivos con imports de `sonner`
- **Punto de entrada único**: `src/app/layout.tsx` + `src/components/ui/sonner.tsx`
- **Casos de uso principales**:
  - Éxito de operaciones (CRUD)
  - Errores de validación y servidor
  - Warnings (stock limitado, etc.)
  - Confirmaciones de acciones

## ADDED Requirements

### Requirement: SileoProvider Integration

El sistema DEBERÁ importar y montar el componente `Toaster` de Sileo en el layout raíz de la aplicación.

#### Scenario: Montaje en RootLayout

- GIVEN Aplicación Next.js con React 19
- WHEN Se renderiza el `RootLayout`
- THEN El componente `<Toaster />` de Sileo DEBE estar montado en el body, después del `AuthProvider`

#### Scenario: Configuración de posición global

- GIVEN El componente Toaster montado
- WHEN Se muestran notificaciones
- THEN La posición por defecto DEBE ser `top-right` con un offset de 16px

#### Scenario: Soporte para dark mode

- GIVEN El tema de la aplicación (light/dark/system)
- WHEN Se muestra una notificación
- THEN El toast DEBE adaptarse al tema actual sin necesidad de recargar

---

### Requirement: Compatibilidad de API - Métodos de Toast

El sistema DEBE proporcionar una capa de compatibilidad (wrapper) para que los ~738 usos existentes de `toast()` funcionen sin cambios en el código cliente.

#### Scenario: toast.success()

- GIVEN Componente que llama a `toast.success('Mensaje')`
- WHEN Se ejecuta
- THEN DEBE invocar `sileo.success({ title: 'Mensaje' })`

#### Scenario: toast.error()

- GIVEN Componente que llama a `toast.error('Error')`
- WHEN Se ejecuta
- THEN DEBE invocar `sileo.error({ title: 'Error' })`

#### Scenario: toast.warning()

- GIVEN Componente que llama a `toast.warning('Warning')`
- WHEN Se ejecuta
- THEN DEBE invocar `sileo.warning({ title: 'Warning' })`

#### Scenario: toast() genérico

- GIVEN Componente que llama a `toast('Mensaje genérico')`
- WHEN Se ejecuta
- THEN DEBE invocar `sileo.show({ title: 'Mensaje genérico' })`

#### Scenario: toast() con description

- GIVEN Componente que llama a `toast.success('Título', { description: 'Detalle' })`
- WHEN Se ejecuta
- THEN DEBE invocar `sileo.success({ title: 'Título', description: 'Detalle' })`

#### Scenario: toast() con duración custom

- GIVEN Componente que llama a `toast('Msg', { duration: 8000 })`
- WHEN Se ejecuta
- THEN DEBE invocar `sileo.show({ title: 'Msg', duration: 8000 })`

---

### Requirement: Compatibilidad de API - Toaster Component

El sistema DEBERÁ mantener compatibilidad con el componente `Toaster` exportado desde `@/components/ui/sonner`.

#### Scenario: Export del componente Toaster

- GIVEN Archivo `@/components/ui/sonner.tsx`
- WHEN Se importa `Toaster` de este archivo
- THEN DEBE exportar el componente `Toaster` de Sileo con la configuración adecuada

---

### Requirement: Promise Toast Support

El sistema DEBE soportar el patrón `toast.promise()` para operaciones async.

#### Scenario: toast.promise()

- GIVEN Componente que llama a `toast.promise(promise, { loading: '...', success: '...', error: '...' })`
- WHEN La promesa se resuelve exitosamente
- THEN DEBE invocar `sileo.promise()` con los mismos options

---

### Requirement: Mock para Tests

El sistema DEBERÁ mantener mocks de `sonner` disponibles para los tests existentes.

#### Scenario: Mock en tests de componentes

- GIVEN Tests en `src/components/servicios/__tests__/servicios-form.test.tsx`
- WHEN Se ejecutan los tests
- THEN El mock de `sonner` DEBE continuar funcionando (puede mantenerse o migrarse a mock de `sileo`)

---

## MODIFIED Requirements

### Requirement: Actualización de imports

Los imports de `import { toast } from 'sonner'` DEBERÁN actualizarse a `import { sileo } from 'sileo'` o usar el wrapper de compatibilidad.

(Previously: `import { toast } from 'sonner'`)

#### Scenario: Import directo a sileo

- GIVEN Archivos con `import { toast } from 'sonner'`
- WHEN Se migran
- THEN DEBERÍAN usar `import { sileo } from 'sileo'` con `sileo.success()`, `sileo.error()`, etc.

#### Scenario: Import via wrapper

- GIVEN Archivos con `import { toast } from 'sonner'`
- WHEN Se migran
- THEN PUEDEN usar `import { toast } from '@/lib/sileo-wrapper'` para migración incremental sin cambios en el código cliente

---

## REMOVED Requirements

### Requirement: Desinstalación de Sonner

El paquete `sonner` NO DEBERÁ estar instalado como dependencia de producción.

(Reason: Reemplazado por `sileo`)

#### Scenario: Dependencia en package.json

- GIVEN Archivo `package.json`
- WHEN Se completa la migración
- THEN `sonner` NO DEBE aparecer en `dependencies`

---

## Notes on Migration Strategy

### Opción A: Migración directa (recomendada para proyectos pequeños)
- Cambiar todos los imports de `import { toast } from 'sonner'` a `import { sileo } from 'sileo'`
- Reemplazar `toast.success()` con `sileo.success()`, etc.
- **Impacto**: ~100 archivos, ~738 occurrences
- **Ventaja**: Sin capas de compatibilidad, código limpio
- **Desventaja**: Cambio masivo simultáneo

### Opción B: Wrapper de compatibilidad
- Crear `src/lib/toast.ts` que экспортa `toast` como alias de `sileo`
- Mantener el import `import { toast } from '@/lib/toast'`
- Cambiar imports gradualmente archivo por archivo
- **Impacto**: позволяет incremental migration
- **Ventaja**: можно hacer миграцию частями
- **Desventaja**: Adds indirection layer

### Opción C: Hybrid approach
- Instalar `sileo` alongside `sonner` temporalmente
- Crear wrapper `src/lib/sileo-wrapper.ts` que экспортa API compatible
- Actualizar `src/components/ui/sonner.tsx` para usar Sileo internamente
- Reemplazar `sonner` con `sileo` en `package.json` al final
- **Impacto**: миграция без período de transición problemático
- **Ventaja**: puedes revertir fácilmente si hay problemas
- **Desventaja**: más archivos de configuración

## Technical Notes

1. **Sileo API**:
   - `sileo.success(options)` - donde options tiene `title`, `description`, `duration`, `position`
   - `sileo.error(options)`
   - `sileo.warning(options)`
   - `sileo.info(options)`
   - `sileo.show(options)`
   - `sileo.promise(promise, opts)`
   - `sileo.dismiss(id)`
   - `sileo.clear()`

2. **Differencias con Sonner**:
   - Sileo usa `sileo` como objeto global, no `toast`
   - Sileo tiene efectos de física (spring animations)
   - Sileo soporta `fill` para backgrounds personalizados
   - Sileo tiene `autopilot` para auto-expand/collapse

3. **Tests existentes**:
   - `vi.mock('sonner', ...)` necesita actualizarse a `vi.mock('sileo', ...)`
