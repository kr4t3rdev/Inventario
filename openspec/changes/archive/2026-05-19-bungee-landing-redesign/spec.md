# Spec: Bungee-Inspired Landing Page Redesign

## Fonts (Cargados Localmente)

### REQ-FONT-01: Chivo Mono
- Cargar Chivo Mono desde archivos locales en `public/fonts/`
- Pesos requeridos: 400 (Regular), 700 (Bold)
- Estilos: Normal, Italic (400, 700)
- Usar `next/font/local` con CSS variables

### REQ-FONT-02: Inter
- Cargar Inter desde archivos locales en `public/fonts/`
- Pesos requeridos: 400 (Regular), 500 (Medium), 600 (Semibold), 700 (Bold)
- Estilos: Normal, Italic
- Usar `next/font/local` con CSS variables

### REQ-FONT-03: CSS Variables
- `--font-mono` → Chivo Mono
- `--font-sans` → Inter
- Registrados en `@theme inline` de globals.css

## Theme Dark Industrial

### REQ-THEME-01: Background
- Fondo base: near-black (oklch(0.13 0.005 260) aprox)
- Cards/superficies: charcoal oscuro (oklch(0.18 0.008 260) aprox)
- Sin cambios en el toggle dark/light — solo se modifica el tema oscuro

### REQ-THEME-02: Primary Accent
- Mantener el azul actual como primary pero más vibrante en dark mode
- Asegurar alto contraste con fondos oscuros

### REQ-THEME-03: Borders
- Bordes sutiles: oklch(1 0 0 / 6-10%) — muy tenues
- Separación visual vía contraste de fondo, no bordes fuertes

## Animaciones Spring

### REQ-ANIM-01: Patrón Base
```typescript
const springUp = {
  initial: { opacity: 0, y: 40 },
  animate: { opacity: 1, y: 0 },
  transition: { type: 'spring', bounce: 0.3, duration: 1.1 }
}
```

### REQ-ANIM-02: Secciones
- Hero: spring con delay 0 (entrada inicial)
- Features cards: staggered reveal con delay incremental (0.06-0.1s)
- Benefits: slide lateral con spring
- Pricing: staggered reveal
- Contact: fade-up estándar
- Stats: animated counter con useSpring

### REQ-ANIM-03: Hover Effects
- Cards: lift con spring suave (y: -6 a -8)
- Buttons: scale 1.03 with spring (stiffness: 300, damping: 15)
- Icons: rotate suave con spring

### REQ-ANIM-04: Accesibilidad
- Todas las animaciones respetan `useReducedMotion`
- Si reduceMotion: transitions instantáneas (duration: 0)

## Layout y Secciones

### REQ-SECT-01: Hero (Actualizada)
- Headline en Chivo Mono bold
- Stats como contadores animados con números grandes (ej: "127%" no "+127%")
- Botones CTA mantienen estilo actual

### REQ-SECT-02: Features (Actualizada)
- Cards con spring staggered reveal
- Bullets mantienen CheckCircle2
- Iconos con hover rotate spring

### REQ-SECT-03: Benefits (Actualizada)
- Layout grid actual se mantiene
- Animación con spring slide desde lateral

### REQ-SECT-04: Pricing (Actualizada)
- Cards con spring staggered reveal
- Featured card con hover lift pronunciado

### REQ-SECT-05: Testimonios (NUEVA)
- 3 quote cards con citas ficticias
- Avatar circular + nombre + rol
- Spring appear con stagger
- Colocar entre Benefits y Pricing

### REQ-SECT-06: FAQ (NUEVA)
- Usar shadcn/ui Accordion
- 4-6 preguntas frecuentes
- Colocar entre Contact y Footer

### REQ-SECT-07: Stats Counters (NUEVA)
- Grid de 4 stats con números grandes en Chivo Mono
- Títulos descriptivos pequeños
- Animación de contador numérico con `useSpring` + `useTransform`
- Colocar en Hero o después del Hero

## Escenarios

### ESC-01: Carga Inicial
**Given** un usuario entra a la landing
**When** la página se carga
**Then** fonts locales se aplican inmediatamente (no flash)
**And** animación spring de entrada en hero
**And** preloader se mantiene (ya existe)

### ESC-02: Scroll Reveal
**Given** un usuario scrollea hacia abajo
**When** cada sección entra en viewport
**Then** los elementos aparecen con animación spring (slide-up)
**And** los cards aparecen escalonados (stagger)

### ESC-03: Stat Counter
**Given** un usuario ve los stats
**When** la sección entra en viewport
**Then** los números animan desde 0 hasta su valor final
**And** la animación es suave (spring)

### ESC-04: Dark Mode
**Given** un usuario cambia a dark mode
**When** el tema se activa
**Then** los fondos son near-black
**And** el texto mantiene alto contraste

### ESC-05: Reduced Motion
**Given** un usuario prefiere reducir animaciones
**When** la página carga
**Then** no hay animaciones spring (transiciones instantáneas)
**And** los stat counters muestran el valor final directamente
