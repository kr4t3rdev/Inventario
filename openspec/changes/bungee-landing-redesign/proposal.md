# Proposal: Bungee-Inspired Landing Page Redesign

## Intent
Transform the FinanceMDM landing page into a dark, bold, industrial aesthetic with monospace typography, spring-powered animations, and stronger visual hierarchy — inspired by the Bungee creative agency template.

## Scope

### In Scope
- **Typography**: Integrate Chivo Mono (monospace) for headings, numbers, stats, and brand elements via `next/font`
- **Theme**: Shift globals.css CSS variables toward a dark industrial palette (near-black backgrounds, high contrast, muted borders)
- **Animations**: Replace all current Framer Motion animations with spring-based transitions (bounce: 0.2–0.6, duration: 1–1.4s). Keep `useReducedMotion` support.
- **Layout enhancements**: Add animated stat counters with large numbers, add testimonials section with quote cards, add FAQ accordion section
- **Brand text**: Update "Fina<span>nce</span>MDM" to use monospace styling

### Out of Scope
- No changes to routing, authentication, or backend
- No changes to existing shadcn/ui components outside the landing page
- No removal of existing sections (Hero, Features, Benefits, Pricing, Contact stay)
- No changes to theme toggle or dark mode logic

## Approach

### Phase 1: Foundation
1. Add Chivo Mono + Inter fonts via `next/font` in `layout.tsx`
2. Update `globals.css` with new dark industrial CSS variables
3. Add `fontFamily` to `@theme inline` in globals.css

### Phase 2: Core Page Transformation
1. Rewrite `page.tsx` animations using spring pattern
2. Update all typography to use Chivo Mono for headings
3. Convert stat boxes to large animated counters
4. Add testimonial section with quote cards
5. Add FAQ accordion section
6. Update hero section with stronger typographic hierarchy

### Phase 3: Polish & Accessibility
1. Verify reduced motion support
2. Test dark mode consistency
3. Test font loading and fallbacks

## Key Design Decisions

1. **Font strategy**: Use `next/font` with `variable` font support and CSS variable injection (best practice for Next.js 16)
2. **Spring animations**: Define reusable spring animation variants instead of inline config — cleaner code, easier to maintain
3. **Stat counters**: Use Framer Motion `useSpring` + `useTransform` for smooth animated numbers
4. **Dark industrial theme**: Override CSS variables in globals.css only — no new Tailwind config needed
5. **FAQ**: Use existing shadcn/ui `Accordion` component instead of building from scratch

## Risks
- **Font flash**: Chivo Mono may take extra time to load — use `display: swap` and system monospace fallback
- **Animation performance**: Spring animations on low-end devices — mitigated by `useReducedMotion`
