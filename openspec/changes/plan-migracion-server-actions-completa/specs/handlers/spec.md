# Spec: Migración de Handlers Legacy a Server Actions

## Feature: Eliminación de handlers redundantes

### Escenario 1: Handler completamente duplicado por SA
**Given** un feature (ej: categorías) donde existe `api/handlers.ts` Y `actions.ts`
**When** se verifica que cada handler tiene su equivalente en Server Action
**Then** el handler se puede eliminar sin impacto funcional
**And** todos los componentes que llamaban al handler ahora llaman a la SA
**And** los tests de la SA cubren los mismos casos que el handler

### Escenario 2: Handler con lógica extra no migrada
**Given** un feature donde el handler tiene lógica que la SA no cubre
**When** se identifica la funcionalidad faltante
**Then** se migra esa lógica a una nueva SA
**And** se verifica que los parámetros y respuesta sean equivalentes
**And** se elimina el handler solo después de confirmar cobertura total

### Escenario 3: Componente que llama a API route directamente
**Given** un componente que usa `fetch('/api/...')` o RTK Query
**When** se elimina el handler/route correspondiente
**Then** el componente se actualiza para llamar a la SA directo
**And** el comportamiento observable es idéntico (mismos datos, mismos errores)

### Escenario 4: API route de infraestructura
**Given** rutas como `/api/upload`, `/api/exchange`, `/api/health`, `/api/metrics`, `/api/image`
**When** se evalúa su propósito
**Then** se conservan como API routes (no aplica migración a SA)
**And** se documenta explícitamente por qué se conservan

## Feature: Verificación post-eliminación

### Escenario 5: Build sin handlers
**Given** que se eliminaron los handlers de un feature
**When** se ejecuta `pnpm run build`
**Then** el build es exitoso (sin imports rotos, sin referencias a handlers eliminados)

### Escenario 6: Tests post-migración
**Given** que se eliminaron los handlers de un feature
**When** se ejecuta `pnpm run test:run`
**Then** todos los tests existentes pasan (o se actualizaron)
**And** no hay tests que referencien handlers eliminados

## Feature: Orden de migración

### Escenario 7: Priorización por riesgo
**Given** la lista de features con handlers legacy
**When** se planifica la migración
**Then** categorías va primero (handlers 100% duplicados, riesgo bajo)
**And** contabilidad va al final (handler 525+ líneas, lógica financiera, riesgo alto)

## Criterios de Aceptación

- [ ] Cada handler eliminado tiene cobertura verificada en SA
- [ ] Build exitoso después de cada batch de eliminación
- [ ] Tests pasan después de cada batch
- [ ] API routes de infraestructura se conservan
- [ ] Zero regresiones funcionales reportadas
