# Fix: Landing page returns 404 en Next.js 16.2.4

## Intent
Resolver el 404 de la página raíz (`/`) causado por un bug de Next.js 16.2.4 donde `src/app/page.tsx` es silenciosamente descartada del route table.

## Contexto
- Next.js 16.2.4 con Turbopack (default) y webpack
- `src/app/page.tsx` existe, compila sin errores, pero no aparece en la tabla de rutas
- `type AppRoutes` en `.next/dev/types/routes.d.ts` muestra solo `/docs` y `/docs/[...module]`
- Probado sin barrel export, sin `not-found.tsx`, sin config custom → mismo resultado
- Railway deploy exitoso pero landing page 404

## Hipótesis
- Bug de Next.js 16.2.4 con App Router root page
- Posiblemente relacionado con Turbopack y detección de páginas en el directorio raíz
- No es causado por cambios de features/suscripciones

## Posibles soluciones a evaluar
1. Route group: mover `page.tsx` a `src/app/(landing)/page.tsx` + middleware redirect `/` → `/(landing)`
2. Usar `redirect('/docs')` en middleware para el root
3. Upgrade de Next.js a canary/parche más reciente
4. Reescribir con `async rewrites()` en next.config.mjs para mapear `/` → `/docs`

## Archivos involucrados
- `src/app/page.tsx` — página raíz del landing
- `next.config.mjs` — posible workaround via rewrites
- `src/middleware.ts` — posible workaround via redirect
- `.next/dev/types/routes.d.ts` — evidencia del bug

## Estado
⏸️ Pausado — requiere investigación adicional del bug de Next.js 16
