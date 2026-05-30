## SDD Tasks: Sistema de Reseñas y Valoraciones

Dependency order — tasks MUST be executed in order.

### Task 1: Prisma Schema + Migración

**Files**:
- `prisma/schema.prisma` — agregar modelos `Review` y `ReviewPrompt`

**What**: Agregar los dos modelos al schema y correr migración.

**Check**:
- [ ] Modelos agregados al final del schema
- [ ] `pnpm run build` pasa sin errores de schema
- [ ] Migración creada y aplicada (prisma migrate dev)

---

### Task 2: Zod Schemas + Server Actions

**Files**:
- `src/features/reviews/schemas.ts` — crear
- `src/features/reviews/actions.ts` — crear
- `src/features/reviews/index.ts` — barrel export

**What**: Implementar las 7 server actions + esquemas de validación.

**Actions**:
- `submitReviewAction` — crear reseña con validación + unique constraint
- `approveReviewAction` — admin aprueba (rol check)
- `rejectReviewAction` — admin rechaza/elimina
- `getReviewStatsAction` — stats para dashboard (autenticado)
- `getReviewStatsPublicAction` — stats para landing pública (usa env var)
- `getApprovedReviewsAction` — listar aprobadas (autenticado)
- `getApprovedReviewsPublicAction` — listar aprobadas para landing
- `canPromptReviewAction` — verifica si mostrar dialog
- `dismissReviewPromptAction` — cerrar dialog sin enviar

**Check**:
- [ ] Todas las actions exportadas desde index.ts
- [ ] `npx tsc --noEmit` pasa en src/features/reviews/

---

### Task 3: ReviewStars Component

**Files**:
- `src/features/reviews/components/review-stars.tsx` — crear

**What**: Componente de estrellas SVG interactivo y de solo lectura.

**Props**: `{ rating: number; size?: 'sm' | 'md' | 'lg'; interactive?: boolean; onChange?: (r: number) => void }`

**Check**:
- [ ] Renderiza 5 estrellas con fill condicional
- [ ] Modo interactivo: hover highlight + click selecciona
- [ ] Soporta `useReducedMotion`

---

### Task 4: ReviewDialog + useReviewDialog Hook

**Files**:
- `src/features/reviews/components/review-dialog.tsx` — crear
- `src/features/reviews/hooks/use-review-dialog.ts` — crear

**What**: Dialog de calificación con estrellas + comentario + lógica de aparición.

**Check**:
- [ ] Dialog se muestra según `canPromptReviewAction()`
- [ ] Enviar → submitReviewAction → toast success → no vuelve
- [ ] Cerrar → dismissReviewPromptAction → no molesta hasta mañana
- [ ] Loading state en botón enviar
- [ ] Error handling con toast

---

### Task 5: ReviewHeroBadge (Server Component)

**Files**:
- `src/features/reviews/components/review-hero-badge.tsx` — crear

**What**: Badge condicional para el Hero de la landing.

**Lógica**:
- Llama `getReviewStatsPublicAction()`
- Si `totalPositive < 3` → retorna null
- Renderiza: rating promedio + estrellas + "X reseñas" + avatares + "X empresas"

**Check**:
- [ ] No renderiza nada si hay < 3 reseñas positivas
- [ ] Muestra datos reales cuando hay suficientes
- [ ] Diseño consistente con el hero existente

---

### Task 6: RealTestimonials (Server Component)

**Files**:
- `src/features/reviews/components/real-testimonials.tsx` — crear

**What**: Sección de testimonios con datos reales.

**Lógica**:
- Llama `getApprovedReviewsPublicAction({ limit: 3 })`
- Si `reviews.length === 0` → retorna null
- Renderiza: cards con quote + nombre + avatar + rating

**Check**:
- [ ] No renderiza nada si no hay reseñas aprobadas
- [ ] Muestra hasta 3 reseñas con datos reales
- [ ] Mismo diseño visual que testimonios actuales

---

### Task 7: Integrar en Landing Page

**Files**:
- `src/app/page.tsx` — actualizar hero y testimonios
- `src/features/landing/components/hero.tsx` — integrar ReviewHeroBadge
- `src/features/landing/components/testimonials.tsx` — reemplazar por RealTestimonials

**What**:
- Hero: agregar `<ReviewHeroBadge />` junto a la imagen (reemplaza los badges flotantes de data cuando hay datos reales)
- Testimonios: reemplazar `LandingTestimonials` por `RealTestimonials`

**Nota**: Los badges flotantes actuales del hero (HERO_BADGES) deben seguir mostrándose. El ReviewHeroBadge es adicional, condicional.

**Check**:
- [ ] Hero muestra badge de reseñas cuando hay datos
- [ ] Hero sigue funcionando sin datos de reseñas
- [ ] Testimonios no se renderizan sin reseñas
- [ ] Build pasa

---

### Task 8: Integrar ReviewDialog en Layout Authenticated

**Files**:
- `src/app/busy/layout.tsx` — agregar hook
- `src/app/busy/layout.tsx` — importar ReviewDialog

**What**: Integrar `useReviewDialog` + `ReviewDialog` en el layout del dashboard.

**Check**:
- [ ] Dialog aparece para usuarios activos sin reseña
- [ ] No aparece para usuarios con reseña ya enviada
- [ ] No aparece más de 1 vez por día
- [ ] Build pasa

---

### Task 9: Admin Moderation Page

**Files**:
- `src/app/busy/reviews/page.tsx` — crear
- `src/app/busy/reviews/layout.tsx` — crear (opcional)

**What**: Página de moderación de reseñas para admin/manager.

**Contenido**:
- Tabla con reseñas pendientes (isApproved: false)
- Historial de reseñas aprobadas
- Botones: aprobar (check ✓), rechazar (X)
- Stats header: total pendientes, total aprobadas

**Check**:
- [ ] Ruta /busy/reviews funcional
- [ ] Solo accesible por admin/manager
- [ ] Aprobar y rechazar funcionan con toast feedback
- [ ] Build pasa

---

### Task 10: Verificación Final

**What**: Build, lint, typecheck.

**Check**:
- [ ] `pnpm run build` sin errores
- [ ] `pnpm run lint` sin errores
- [ ] Migración Prisma aplicada
- [ ] Landing sin reseñas no muestra badges ni testimonios (graceful degradation)
