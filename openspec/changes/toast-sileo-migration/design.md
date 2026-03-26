# Design: Toast-Sileo Migration

## Technical Approach

Reemplazar la librería Sonner por Sileo manteniendo compatibilidad con el código existente mediante un wrapper de alias. La estrategia es **migración incremental por模块** para minimizar riesgo y permitir rollback si es necesario.

```
Sonner (actual) ──→ Sileo (nuevo)
     │                    │
     └── Wrapper compat ──┘
              │
         toast alias
```

## Architecture Decisions

### Decision: Wrapper de Compatibilidad vs Migración Directa

**Choice**: Usar wrapper de compatibilidad (`src/lib/toast.ts`) que acts as alias for Sileo
**Alternatives considered**: 
- Migración directa替换 todos los imports (alto riesgo, cambio masivo)
- Hybrid: instalar Sileo junto Sonner temporalmente
**Rationale**: Permite migración incremental por archivo/módulo sin cambiar el código cliente. Si Sileo falla, se revierte solo el wrapper.

### Decision: Componente Toaster

**Choice**: Crear `src/components/ui/sileo.tsx` nuevo y mantener `sonner.tsx` como export legacy
**Alternatives considered**: 
- Reemplazar directamente el contenido de `sonner.tsx`
- Eliminar `sonner.tsx` y crear `sileo.tsx` limpio
**Rationale**: Mantiene compatibilidd con imports existentes en `layout.tsx` que hacen `import { Toaster } from '@/components/ui/sonner'` vs `import { Toaster } from 'sonner'`.

### Decision: API del Wrapper

**Choice**: Exportar `toast` object con métodos `success/error/warning/info/show/promise/dismiss/clear` que delegan a `sileo`
**Alternatives considered**: 
- Cambiar todos los calls de `toast.success()` a `sileo.success()` directamente
- Mantener `sonner` instalado y usar solo como mock en tests
**Rationale**: Minimiza cambios en archivos cliente. El wrapper actúa como facade.

### Decision: Instalación de Sileo

**Choice**: Agregar `sileo` a dependencies y mantener `sonner` temporalmente hasta completar migración
**Alternatives considered**: 
- Desinstalar `sonner` inmediatamente
- Usar `npm replace` para swap directo
**Rationale**: Permite rollback fácil. Si hay problemas, se desinstala Sileo y se vuelve a Sonner sin afectar código.

## Data Flow

```
┌─────────────────────────────────────────────────────────────────┐
│                         layout.tsx                              │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │  import { Toaster } from '@/components/ui/sonner'        │   │
│  │                           │                              │   │
│  │                           ▼                              │   │
│  │  ┌─────────────────────────────────────────────────┐   │   │
│  │  │  sonner.tsx → Re-exports Sileo's Toaster         │   │   │
│  │  └─────────────────────────────────────────────────┘   │   │
│  └─────────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────┐
│                    Component Files (~100)                        │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │  import { toast } from 'sonner'  (ó '@/lib/toast')       │   │
│  │                           │                              │   │
│  │                           ▼                              │   │
│  │  ┌─────────────────────────────────────────────────┐   │   │
│  │  │  toast.success() / toast.error() / etc.         │   │   │
│  │  │         │                                        │   │   │
│  │  │         ▼                                        │   │   │
│  │  │  ┌─────────────────────────────────────────┐     │   │   │
│  │  │  │  src/lib/toast.ts (Sileo wrapper)      │     │   │   │
│  │  │  │  export const toast = sileo             │     │   │   │
│  │  │  └─────────────────────────────────────────┘     │   │   │
│  │  └─────────────────────────────────────────────────┘   │   │
│  └─────────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────┘
```

## File Changes

| File | Action | Description |
|------|--------|-------------|
| `src/lib/toast.ts` | Create | Wrapper/alias que exporta `sileo` como `toast` |
| `src/components/ui/sileo.tsx` | Create | Componente Toaster de Sileo con theme support |
| `src/components/ui/sonner.tsx` | Modify | Re-export de Sileo para backward compat |
| `src/app/layout.tsx` | Modify | Actualizar import de Toaster si es necesario |
| `src/components/servicios/__tests__/servicios-form.test.tsx` | Modify | Actualizar mock de `sonner` a `sileo` |
| `package.json` | Modify | Agregar `sileo` como dependency |
| `package.json` | Modify (later) | Remover `sonner` después de migración completa |

## Interfaces / Contracts

### src/lib/toast.ts

```typescript
import { sileo, type SileoOptions, type SileoPromiseOptions } from 'sileo'

// Alias completo para compatibilidad
export const toast = {
  success: (message: string | SileoOptions, description?: string | SileoOptions) =>
    sileo.success(typeof message === 'string' ? { title: message, description } : message),
  
  error: (message: string | SileoOptions, description?: string | SileoOptions) =>
    sileo.error(typeof message === 'string' ? { title: message, description } : message),
  
  warning: (message: string | SileoOptions, description?: string | SileoOptions) =>
    sileo.warning(typeof message === 'string' ? { title: message, description } : message),
  
  info: (message: string | SileoOptions, description?: string | SileoOptions) =>
    sileo.info(typeof message === 'string' ? { title: message, description } : message),
  
  show: (options: SileoOptions) => sileo.show(options),
  
  promise: <T>(promise: Promise<T> | (() => Promise<T>), options: SileoPromiseOptions<T>) =>
    sileo.promise(promise, options),
  
  dismiss: (id?: string) => sileo.dismiss(id),
  
  clear: (position?: string) => sileo.clear(position),
}

// Re-export types para uso externo
export type { SileoOptions, SileoPromiseOptions }
```

### src/components/ui/sileo.tsx

```typescript
"use client"

import { useTheme } from "next-themes"
import { Toaster as SileoToaster, ToasterProps } from "sileo"

const Toaster = ({ ...props }: ToasterProps) => {
  const { theme = "system" } = useTheme()

  return (
    <SileoToaster
      theme={theme as ToasterProps["theme"]}
      position="top-right"
      offset={16}
      {...props}
    />
  )
}

export { Toaster }
```

## Testing Strategy

| Layer | What to Test | Approach |
|-------|-------------|----------|
| Unit | Wrapper `toast.ts` | Test que llama `toast.success()` y verifica que `sileo.success()` fue llamado con correct params |
| Unit | Mock en tests | Actualizar `vi.mock('sonner', ...)` → `vi.mock('sileo', ...)` |
| Integration | Components con toasts | Verify toast calls work correctly after migration |
| E2E | N/A | No se necesita E2E para migración de librería |

### Test File Updates

```typescript
// Before (sonner mock)
vi.mock('sonner', () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn(),
  },
}))

// After (sileo mock)
vi.mock('sileo', () => ({
  sileo: {
    success: vi.fn(),
    error: vi.fn(),
    warning: vi.fn(),
    info: vi.fn(),
    show: vi.fn(),
    promise: vi.fn(),
    dismiss: vi.fn(),
    clear: vi.fn(),
  },
}))
```

## Migration / Rollout

### Phase 1: Setup (riesgo bajo)
1. Instalar `sileo` en package.json
2. Crear `src/lib/toast.ts` wrapper
3. Crear `src/components/ui/sileo.tsx`
4. Verificar que wrapper funciona

### Phase 2: Migración Incremental (por módulo)
1. Seleccionar módulo (ej: `empleados`)
2. Cambiar imports de `import { toast } from 'sonner'` → `import { toast } from '@/lib/toast'`
3. Testear functionality
4. Repetir para siguiente módulo

### Phase 3: Cleanup (cuando 100% migrado)
1. Verificar que no quedan imports de `sonner` para toast
2. Remover `sonner` de dependencies
3. Eliminar `src/components/ui/sonner.tsx` o convertirlo en simple re-export

### Módulos para migración (orden sugerido):
1. **UI/Low-risk**: componentes compartidos, forms simples
2. **Inventory**: productos, categorías, stock
3. **Sales**: ventas, punto de venta (pv-interface)
4. **Accounting**: contabilidad, reportes
5. **Employees**: nómina, asistencia, vacaciones
6. **Restaurante**: POS, KDS, producción

## Open Questions

- [ ] ¿Hay algún código que dependa de features específicos de Sonner (ej: `toast.custom()`, `toast.id`, toast events)?
- [ ] ¿Se usa `react-hook-toast` o `toast` package directamente en algún lugar? (vi que están instalados pero no en uso)
- [ ] ¿Prefieres migración más rápida (directa) o incremental (más segura)?
- [ ] ¿Sileo tiene todos los features que usa Sonner? (ej: `toast.loading()` con progress)

## Notes

### Diferencias Clave Sileo vs Sonner

| Feature | Sonner | Sileo |
|---------|--------|-------|
| Import | `import { toast } from 'sonner'` | `import { sileo } from 'sileo'` |
| Toaster component | `<Toaster />` | `<Toaster />` |
| Success call | `toast.success('msg')` | `sileo.success({ title: 'msg' })` |
| Promise toast | `toast.promise()` | `sileo.promise()` |
| Dark mode | Automatic via theme | Automatic via theme |
| Animations | CSS transitions | Spring physics + SVG morphing |
| Position default | `top-right` | `top-right` |

### Sileo Installation
```bash
npm install sileo
# ó
pnpm add sileo
```
