# Paquete 1: Reportes Server-First + Cache Helper

## Objetivo

Convertir `src/app/busy/reportes/page.tsx` en el primer piloto seguro de Cache Components/PPR, centralizando la lectura de transferencias en un helper de servidor reusable y manteniendo el cliente solo para interacción y render.

## Alcance

### En alcance
- Mantener `src/app/busy/reportes/page.tsx` como Server Component.
- Extraer la lectura de transferencias a `src/lib/server/cache/reportes.ts`.
- Confirmar que `ReportesPageClient` reciba datos por props y no haga fetch propio.
- Preparar el route para un fallback/streaming posterior si hace falta.

### Fuera de alcance
- No tocar `admin/page.tsx`.
- No tocar `busy/contabilidad/page.tsx`.
- No introducir `use cache` en páginas mutables o no determinísticas.
- No reescribir layouts client-heavy todavía.

## Tareas

### Fase 1: Base del helper

- [ ] 1.1 Crear `src/lib/server/cache/reportes.ts` con una función pura que resuelva las transferencias usadas por reportes.
- [ ] 1.2 Definir el input explícito del helper (por ejemplo filtros/tenant/contexto si aplica) para que el cache key sea determinístico.
- [ ] 1.3 Asegurar que el output del helper sea serializable y no arrastre objetos no compatibles con RSC.

### Fase 2: Wiring del route

- [ ] 2.1 Refactorizar `src/app/busy/reportes/page.tsx` para consumir el helper nuevo en lugar de tener la lectura inline.
- [ ] 2.2 Mantener `ReportesPageClient` como consumidor de props sin fetch propio.
- [ ] 2.3 Verificar que la page siga devolviendo la misma UI para el usuario final.

### Fase 3: Validación del boundary server/client

- [ ] 3.1 Revisar `src/features/reportes-financieros/components/reportes-page-client.tsx` para confirmar que solo haga render/interacción.
- [ ] 3.2 Eliminar cualquier fetch duplicado o lógica de data-loading interna si existiera.
- [ ] 3.3 Confirmar que los datos iniciales sigan llegando desde el server wrapper.

### Fase 4: Verificación técnica

- [ ] 4.1 Agregar o ajustar tests unitarios para el helper `src/lib/server/cache/reportes.ts`.
- [ ] 4.2 Agregar o ajustar tests del wrapper si hay lógica condicional relevante.
- [ ] 4.3 Ejecutar `pnpm run typecheck` sobre el slice tocado.
- [ ] 4.4 Ejecutar `pnpm run lint` sobre los archivos modificados.

## Criterios de aceptación

- `reportes/page.tsx` no hace fetch de datos inline.
- La lectura de transferencias queda centralizada en un helper server reusable.
- `ReportesPageClient` no realiza data fetching.
- El piloto sirve como base para aplicar el mismo patrón en rutas posteriores.
