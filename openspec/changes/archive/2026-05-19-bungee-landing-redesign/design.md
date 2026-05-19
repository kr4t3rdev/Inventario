# Design: Bungee-Inspired Landing Page Redesign

## Font Loading Strategy

### Descarga de Fonts
Los archivos woff2 de Google Fonts se descargan con curl y se colocan en `public/fonts/`:

**Chivo Mono** (desde Google Fonts CSS):
- Peso 400: https://fonts.gstatic.com/s/chivomono/v11/mFT0WbgRxKvF_Z5eQMO9gx8D1Q.woff2
- Peso 400 italic: https://fonts.gstatic.com/s/chivomono/v11/mFT2WbgRxKvF_Z5eQMO9gxoz12p_.woff2
- Peso 700: https://fonts.gstatic.com/s/chivomono/v11/mFT0WbgRxKvF_Z5eQMO9gx8D1Q.woff2
- Peso 700 italic: https://fonts.gstatic.com/s/chivomono/v11/mFT2WbgRxKvF_Z5eQMO9gxoz12p_.woff2

**Inter** (desde Google Fonts CSS):
- 4 files: 400, 500, 600, 700 (normal + italic)

Naming: `ChivoMono-[weight].[ext]`, `Inter-[weight].[ext]`

### Carga en layout.tsx
```typescript
// src/app/fonts.ts (nuevo archivo)
import localFont from 'next/font/local'

export const chivoMono = localFont({
  src: [
    { path: '../../public/fonts/ChivoMono-400.woff2', weight: '400', style: 'normal' },
    { path: '../../public/fonts/ChivoMono-400i.woff2', weight: '400', style: 'italic' },
    { path: '../../public/fonts/ChivoMono-700.woff2', weight: '700', style: 'normal' },
    { path: '../../public/fonts/ChivoMono-700i.woff2', weight: '700', style: 'italic' },
  ],
  variable: '--font-mono',
  display: 'swap',
})

export const inter = localFont({
  src: [
    { path: '../../public/fonts/Inter-400.woff2', weight: '400', style: 'normal' },
    { path: '../../public/fonts/Inter-400i.woff2', weight: '400', style: 'italic' },
    { path: '../../public/fonts/Inter-500.woff2', weight: '500', style: 'normal' },
    { path: '../../public/fonts/Inter-600.woff2', weight: '600', style: 'normal' },
    { path: '../../public/fonts/Inter-700.woff2', weight: '700', style: 'normal' },
    { path: '../../public/fonts/Inter-700i.woff2', weight: '700', style: 'italic' },
  ],
  variable: '--font-sans',
  display: 'swap',
})
```

## Theme CSS Variables (globals.css)

### Dark Mode Updates
```css
.dark {
  --background: oklch(0.13 0.008 260);    /* near-black base */
  --foreground: oklch(0.97 0.003 260);     /* near-white text */
  --card: oklch(0.18 0.008 260);           /* charcoal surface */
  --card-foreground: oklch(0.97 0.003 260);
  --primary: oklch(0.65 0.16 255);         /* azul más vibrante */
  --primary-foreground: oklch(0.15 0.01 260);
  --muted: oklch(0.22 0.005 260);
  --muted-foreground: oklch(0.65 0.01 260);
  --border: oklch(1 0 0 / 8%);             /* bordes muy sutiles */
}
```

### Font Family en @theme
```css
@theme inline {
  --font-family-sans: var(--font-sans), system-ui, sans-serif;
  --font-family-mono: var(--font-mono), 'Courier New', monospace;
}
```

## Animation Variants (Shared Pattern)

```typescript
// En page.tsx o un archivo de constantes
const springConfig = {
  type: 'spring' as const,
  bounce: 0.3,
  duration: 1.1,
}

const springStagger = (index: number, baseDelay = 0) => ({
  initial: { opacity: 0, y: 40 },
  whileInView: { opacity: 1, y: 0 },
  viewport: { once: true, amount: 0.2 },
  transition: { ...springConfig, delay: baseDelay + index * 0.06 },
})
```

## Stat Counter Component

```typescript
// Componente inline o en features/landing/
// Usa useSpring + useTransform de Framer Motion
// Recibe: value (número final), label (string), prefix/suffix
// InView trigger para empezar la animación
```

## New Sections Layout

### Stats Section (después del Hero)
```
Grid 2x2 de stats cards
┌─────────────────┬─────────────────┐
│    +127%        │    6            │
│   Productividad  │   Módulos clave │
├─────────────────┼─────────────────┤
│    3            │    Tiempo real   │
│   Sucursales    │                 │
└─────────────────┴─────────────────┘
```

### Testimonials Section (entre Benefits y Pricing)
```
┌─────────────────────────────────────────┐
│ "quote text"                            │
│ ┌───────┐ Nombre Apellido               │
│ │ avatar │ Rol, Empresa                 │
│ └───────┘                               │
│ ←  ○  ○  ○  →                          │
└─────────────────────────────────────────┘
```
3 cards en grid horizontal con stagger appear.
Sin carrusel por ahora — las 3 visibles.

### FAQ Section (entre Contact y Footer)
```
┌─────────────────────────────────────────┐
│ Preguntas Frecuentes                    │
│                                         │
│ ▼ ¿Pregunta 1?                         │
│   Respuesta...                          │
│ ▶ ¿Pregunta 2?                         │
│ ▶ ¿Pregunta 3?                         │
│ ▶ ¿Pregunta 4?                         │
└─────────────────────────────────────────┘
```
Usar shadcn/ui `<Accordion type="single" collapsible>`

## File Structure

```
src/
├── app/
│   ├── fonts.ts              [NEW] Font config exports
│   ├── layout.tsx            [MODIFY] Add font classes
│   ├── globals.css           [MODIFY] Dark theme + font vars
│   └── page.tsx              [REWRITE] Animations + new sections
public/
│   └── fonts/                [NEW] Local woff2 files
│       ├── ChivoMono-400.woff2
│       ├── ChivoMono-400i.woff2
│       ├── ChivoMono-700.woff2
│       ├── ChivoMono-700i.woff2
│       ├── Inter-400.woff2
│       ├── Inter-400i.woff2
│       ├── Inter-500.woff2
│       ├── Inter-600.woff2
│       ├── Inter-700.woff2
│       └── Inter-700i.woff2
```

## Dependencies
- framer-motion (ya instalado)
- next (localFont built-in)
- shadcn/ui Accordion (ya disponible en components/ui/)
