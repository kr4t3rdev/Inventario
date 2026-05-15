# Spec: Migración a Server Components

## Feature: Evaluación de Client Components

### Escenario 1: Componente que solo consumía Redux
**Given** un componente con `'use client'` que solo usaba `useAppSelector`/`useAppDispatch`
**When** Redux ha sido eliminado
**Then** el componente debe reevaluarse:
- Si no usa hooks de React (useState, useEffect, etc.) → eliminar `'use client'`, convertir a Server Component
- Si usa hooks pero solo para estado de UI → mantener Client Component pero recibir data como props desde Server Component padre
- Si usa interacción del usuario (onClick, onSubmit, etc.) → mantener Client Component

### Escenario 2: Componente que llamaba a API routes
**Given** un componente que usaba `fetch('/api/...')` y ahora usa SA
**When** el componente se convierte a Server Component
**Then** la SA se llama directo en el componente (await), sin `useEffect`

### Escenario 3: Server Component con datos de SA
**Given** un Server Component que llama a una SA asíncrona
**When** se renderiza la página
**Then** los datos se obtienen en el servidor (no hay waterfall cliente-servidor)
**And** el HTML se sirve con datos incluidos

## Feature: Priorización

### Escenario 4: Post-Redux migration
**Given** que Redux ha sido eliminado del proyecto
**When** se evalúan los componentes con `'use client'`
**Then** se priorizan los que solo tenían `'use client'` por Redux
**And** se dejan como Client Components los que tienen interacción real (POS, formularios complejos)

## Criterios de Aceptación

- [ ] Sin `'use client'` innecesario en features migrados
- [ ] Server Components llaman SA directo (sin `useEffect`)
- [ ] Bundle size reducido (menos JS enviado al cliente)
- [ ] Build + tests OK
