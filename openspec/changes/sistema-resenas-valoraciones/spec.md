## SDD Spec: Sistema de Reseñas y Valoraciones

### 1. Data Model

#### 1.1 Review

```prisma
model Review {
  reviewId    String   @id @default(cuid())
  tenantId    String
  userId      String
  rating      Int      // 1-5, validado por Zod en server action
  comment     String?  // opcional, max 500 chars
  isApproved  Boolean  @default(false)
  isPositive  Boolean  // true si rating >= 4, calculado al crear
  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt

  tenant Tenant @relation(fields: [tenantId], references: [tenantId], onDelete: Cascade)
  user   User   @relation(fields: [userId], references: [userId], onDelete: Cascade)

  @@unique([tenantId, userId])
  @@index([tenantId, isApproved])
  @@index([tenantId, isPositive, isApproved])
  @@map("reviews")
}
```

#### 1.2 ReviewPrompt

```prisma
model ReviewPrompt {
  promptId    String   @id @default(cuid())
  tenantId    String
  userId      String
  promptedAt  DateTime @default(now())
  dismissedAt DateTime?
  submittedAt DateTime?

  tenant Tenant @relation(fields: [tenantId], references: [tenantId], onDelete: Cascade)
  user   User   @relation(fields: [userId], references: [userId], onDelete: Cascade)

  @@index([tenantId, userId, promptedAt])
  @@map("review_prompts")
}
```

### 2. Zod Schemas

```typescript
// reviewSchema — validación de creación/actualización
const reviewSchema = z.object({
  rating: z.number().int().min(1).max(5),
  comment: z.string().max(500).optional(),
});

// reviewStats — shape del return de getReviewStatsAction
interface ReviewStats {
  averageRating: number;     // promedio global (tenant)
  totalApproved: number;     // reseñas aprobadas
  totalPositive: number;     // reseñas aprobadas con rating >= 4
  totalReviews: number;      // total de reseñas (incluye no aprobadas)
}

// reviewFilterSchema — filtros para listar
const reviewFilterSchema = z.object({
  isApproved: z.boolean().optional(),
  orderBy: z.enum(['rating_desc', 'rating_asc', 'newest']).optional(),
  limit: z.number().int().min(1).max(10).optional(),
});
```

### 3. Server Actions

#### 3.1 submitReviewAction
- **Input**: `{ rating: 1-5, comment?: string }` (validado con Zod)
- **Auth**: Usuario autenticado con tenant
- **Validaciones**:
  - MUST validar que rating sea 1-5
  - MUST verificar que el usuario no tenga ya una Review para su tenant (unique constraint)
  - MUST calcular `isPositive = rating >= 4` antes de insertar
- **Output**: `Review` creado con `isApproved: false`
- **Efectos secundarios**: Si existe un `ReviewPrompt` para este usuario hoy, actualizar `submittedAt`

#### 3.2 approveReviewAction
- **Input**: `reviewId: string`
- **Auth**: Usuario con rol admin/manager en el mismo tenant
- **Validaciones**: MUST verificar que la Review exista y pertenezca al mismo tenant
- **Output**: Review actualizada con `isApproved: true`

#### 3.3 rejectReviewAction
- **Input**: `reviewId: string`
- **Auth**: Usuario con rol admin/manager en el mismo tenant
- **Validaciones**: MUST verificar que la Review exista y pertenezca al mismo tenant
- **Output**: Review eliminada (soft delete no necesario)

#### 3.4 getReviewStatsAction
- **Input**: `{ tenantId: string }`
- **Auth**: Usuario autenticado
- **Output**: `ReviewStats` con promedio, totales, positivas
- **Nota**: MUST contar solo reseñas aprobadas para promedio y positivas

#### 3.5 getApprovedReviewsAction
- **Input**: `{ tenantId: string, limit?: number, orderBy?: 'rating_desc' | 'newest' }`
- **Auth**: Usuario autenticado
- **Output**: Array de Review con datos del usuario (name, avatar)
- **Nota**: MUST incluir `user.name` y `user.avatar` en el resultado

#### 3.6 dismissReviewPromptAction
- **Input**: `{ promptId?: string }` — si no se provee, busca el último prompt del día
- **Auth**: Usuario autenticado
- **Output**: ReviewPrompt actualizado con `dismissedAt: now()`

#### 3.7 canPromptReviewAction
- **Input**: `{ tenantId: string, userId: string }`
- **Output**: `{ canPrompt: boolean }`
- **Lógica**: MUST retornar `true` solo si:
  1. El usuario NO tiene Review para este tenant
  2. NO existe ReviewPrompt con `promptedAt` de hoy
  3. El usuario tiene `UserSession.lastActive < 24h`

### 4. Components

#### 4.1 ReviewDialog
- **Trigger**: Se muestra automáticamente al cargar página authenticated si `canPromptReviewAction()` retorna true
- **Content**:
  - Título: "¿Cómo calificás tu experiencia con FinanceMDM?"
  - 5 estrellas clickeables (con hover highlight)
  - TextArea opcional para comentario (placeholder: "Contanos qué te gustaría mejorar...")
  - Botón "Enviar" (primary) + "Ahora no" (ghost)
- **Comportamiento**:
  - "Enviar" → llama `submitReviewAction`, cierra dialog, no vuelve a mostrar
  - "Ahora no" → llama `dismissReviewPromptAction`, cierra dialog
  - Click fuera o ESC → mismo que "Ahora no"

#### 4.2 ReviewStars (display)
- **Props**: `{ rating: number, size?: 'sm' | 'md' | 'lg', interactive?: boolean, onChange?: (rating: number) => void }`
- **Display**: 5 estrellas SVG, llenas según rating, con color amber
- **Interactive**: hover + click para seleccionar rating

#### 4.3 ReviewHeroBadge
- **Server component** (async): llama `getReviewStatsAction`
- **Condición**: MUST retornar null si `totalPositive < 3`
- **Display**: Rating promedio + estrellas + "X reseñas" + contador de empresas como avatar group
- **Props**: `{ tenantId: string }`

#### 4.4 RealTestimonials
- **Server component** (async): llama `getApprovedReviewsAction({ limit: 3 })`
- **Condición**: MUST retornar null si `reviews.length === 0`
- **Display**: Misma estructura de cards que la sección actual de testimonios
- **Props**: `{ tenantId: string }`

### 5. Landing Page Integration

#### 5.1 Hero Badge
- El componente `ReviewHeroBadge` se integra en `LandingHero` como elemento opcional
- **Importante**: La landing es pública (no autenticada). Necesita un tenantId por defecto.
- **Solución**: El tenantId se obtiene de una variable de entorno `NEXT_PUBLIC_DEFAULT_TENANT_ID` o del primer tenant activo. En la landing pública, se muestran stats globales del tenant principal.

#### 5.2 Testimonios
- La sección `LandingTestimonials` actual se reemplaza por `RealTestimonials`
- Si `RealTestimonials` retorna null, la sección entera no se renderiza
- El Marquee entre testimonios y pricing se mantiene

#### 5.3 ReviewDialog en app authenticated
- El hook `useReviewDialog` se integra en el layout authenticated (`src/app/busy/layout.tsx`)
- Se ejecuta 1 vez por sesión de página (no por navegación SPA)

### 6. Admin Moderation Page

- Ruta: `/busy/reviews`
- Tabla con reseñas pendientes de aprobación + historial de aprobadas
- Acciones: aprobar (check) / rechazar (X)
- MUST ser accesible solo para roles admin/manager
- Columnas: Usuario, Rating, Comentario, Fecha, Acciones

### 7. Given/When/Then Scenarios

```gherkin
Scenario: Usuario activo sin reseña ve el dialog
  Given un usuario autenticado con sesión activa < 24h
  And no tiene Review para su tenant
  And no tiene ReviewPrompt hoy
  When carga cualquier página del dashboard
  Then se muestra ReviewDialog

Scenario: Usuario envía reseña
  Given ReviewDialog visible
  When selecciona 4 estrellas y escribe "Muy buen sistema"
  And hace clic en "Enviar"
  Then se crea Review con rating=4, comment="Muy buen sistema", isApproved=false
  And isPositive=true
  And el dialog se cierra
  And no se vuelve a mostrar

Scenario: Usuario cierra sin enviar
  Given ReviewDialog visible
  When hace clic en "Ahora no"
  Then se crea ReviewPrompt con dismissedAt
  And el dialog se cierra
  And no se vuelve a mostrar hasta el día siguiente

Scenario: Hero badge se muestra con suficientes reseñas
  Given el tenant tiene >= 3 reseñas positivas aprobadas
  When se renderiza landing page
  Then ReviewHeroBadge muestra rating promedio, estrellas y contador

Scenario: Hero badge no se muestra con pocas reseñas
  Given el tenant tiene < 3 reseñas positivas aprobadas
  When se renderiza landing page
  Then ReviewHeroBadge retorna null (no se renderiza)

Scenario: Testimonios se muestran con reseñas aprobadas
  Given el tenant tiene >= 1 reseña aprobada
  When se renderiza landing page
  Then RealTestimonials muestra hasta 3 cards

Scenario: Testimonios no se muestran sin reseñas
  Given el tenant tiene 0 reseñas aprobadas
  When se renderiza landing page
  Then RealTestimonials retorna null (sección no renderizada)
```

### 8. Non-goals
- NO se implementa edición de reseña (el usuario puede pedir borrarla vía admin)
- NO se implementa reply de admin a reseñas
- NO se implementa notificación por email al aprobar/rechazar
