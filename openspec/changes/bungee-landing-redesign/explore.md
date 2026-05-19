# Exploration: Bungee-Inspired Landing Page Redesign

## Executive Summary
Transform the current finance MDM landing page from a light/zink-blueish theme to a dark industrial aesthetic with Chivo Mono typography, spring animations, and stronger typographic hierarchy inspired by the Bungee Framer template.

## Current State Analysis

### Current page.tsx (747 lines)
- **Structure**: Hero → Features → Benefits → Pricing → Contact footer
- **Animations**: Basic Framer Motion fade/slide-up, hover lifts, preloader with spinning ring
- **Theme**: Light/dark via shadcn CSS variables, uses blue-ish primary
- **Motion**: Uses `useReducedMotion` for accessibility
- **Images**: Uses `/images/Finanzas3.jpeg` and `/images/Beneficios.jpg`

### Current globals.css (184 lines)
- Tailwind CSS v4 with `@theme inline`
- Light mode: oklch(0.985 0.003 258) background, oklch(0.49 0.14 254) primary
- Dark mode: oklch(0.2 0.01 255) background, oklch(0.69 0.12 251) primary
- No custom fonts configured (defaults to system sans-serif)
- Custom animations: fade-in, pulse-subtle, bounce-subtle, float

### Current Font Setup
- No Google Fonts configured
- Using default system sans-serif (Inter is not explicitly set up)
- No monospace font for headings

## Bungee Reference Analysis

### Font Strategy
- **Chivo Mono** (Google Font): monospace font for headings, brand text, large numbers, stats
- **Inter Display** (Google Font): for body text, descriptions
- We already have Inter in the project indirectly through Tailwind, but need to set up `next/font`

### Color Palette (Dark Industrial)
- Background: Near-black (e.g., #0A0A0B or oklch(0.15 0.005 260))
- Surface/Card: Dark charcoal (e.g., #1A1A1E)
- Primary accent: Keep current blue but make it more vibrant (or shift to a cooler industrial blue)
- Text: High contrast (near white)
- Muted: Lower opacity whites
- Borders: Subtle white at low opacity (e.g., oklch(1 0 0 / 8%))

### Animation Patterns (Extracted from Bungee JS)
The Bungee site uses Framer Motion appear animations with:
```
type: "spring"
bounce: 0.2 - 0.6
duration: 1.0 - 1.4 seconds
initial: { opacity: 0.001, y: 40 }
animate: { opacity: 1, y: 0, transition: { type: "spring", bounce: 0.2, duration: 1 } }
```
Staggered reveals with delay increments of ~0.06-0.1s between items.

### Layout Elements
- Strong typographic hierarchy with oversized numbers
- Stats grid with large counters
- Minimal navigation with monospace labels
- Full-width sections with generous padding
- FAQ accordion (simple expand/collapse)
- Testimonials with quote cards

## Recommendation: Files to Modify

1. **src/app/layout.tsx** — Add Chivo Mono + Inter Display via next/font, inject CSS variables
2. **src/app/globals.css** — Update CSS variables for dark industrial theme, add font families to @theme
3. **src/app/page.tsx** — Major rewrite preserving sections but updating animations, typography, layout

## New Components to Create

1. **AnimatedStatCounter** — Animated number counter with spring entrance
2. **TestimonialsSection** — Quote cards with spring appear animations
3. **FAQAccordion** — Simple accordion for questions (or use existing shadcn Accordion)

## Complexity Estimate
- **Files changed**: 3 (layout.tsx, globals.css, page.tsx)
- **New components**: 3 small components
- **Estimated lines changed**: ~400-500
- **Risk**: Low-medium (primarily presentation layer, no business logic)
- **Key risk**: Font loading affecting initial render (need to handle with fallbacks)
