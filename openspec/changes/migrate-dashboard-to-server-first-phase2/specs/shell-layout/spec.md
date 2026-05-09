# Delta: Busy Shell Layout Ownership

## ADDED Requirements

### Requirement: Busy layout is the sole owner of sidebar shell providers

`src/app/busy/layout.tsx` DEBE ser el único owner de `SidebarProvider` y `SidebarInset` para las rutas bajo `/busy/*`.

#### Scenario: Child pages inherit sidebar context

- GIVEN una ruta hija bajo `/busy/*`
- WHEN esa ruta renderiza
- THEN DEBE asumir que el contexto/sidebar shell ya existe en el layout
- AND NO DEBE reinstanciar `SidebarProvider` ni `SidebarInset`

### Requirement: Client layout does not force child pages to be client

Un layout client bajo `src/app/busy/layout.tsx` NO DEBE obligar a que sus child pages sean client.

#### Scenario: Server child page inside client layout

- GIVEN `src/app/busy/layout.tsx` permanece `'use client'` por necesidades reales del sidebar/auth/header
- WHEN `src/app/busy/dashboard/page.tsx` se migra
- THEN la page PUEDE seguir siendo server-first
- AND el boundary client del layout NO DEBE usarse como excusa para fetch client-side innecesario

## MODIFIED Requirements

### Requirement: Dashboard respects shell ownership

El dashboard principal DEBE respetar el ownership del shell definido en `src/app/busy/layout.tsx`.

#### Scenario: Dashboard removes nested main/shell duplication

- GIVEN el dashboard actual duplicaba wrappers del shell
- WHEN la migración termina
- THEN el DOM final NO DEBE contener un `SidebarInset` adicional creado por la page
- AND el dashboard DEBE evitar `<main>` anidados derivados de esa duplicación

## REMOVED Requirements

### Requirement: Child page manages busy shell independently

Razón: el shell debe centralizarse en el layout del segmento, no en las pages hijas.
