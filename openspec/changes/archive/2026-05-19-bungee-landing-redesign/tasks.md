# Tasks: Bungee-Inspired Landing Page Redesign

## Task 1: Font Config (`src/app/fonts.ts`)
- [ ] Create `src/app/fonts.ts` with `next/font/local` declarations
- [ ] ChivoMono variable font (400-700) + Italic from `public/fonts/`
- [ ] Inter variable font (400-700) + Italic from `public/fonts/`
- [ ] Export CSS variable names: `var(--font-mono)`, `var(--font-sans)`

Files: `src/app/fonts.ts` (NEW)
Depends on: Nothing

## Task 2: Theme Update (`src/app/globals.css`)
- [ ] Add `--font-family-sans` and `--font-family-mono` to `@theme inline`
- [ ] Update `.dark` CSS variables for dark industrial palette
- [ ] Keep light mode unchanged

Files: `src/app/globals.css` (MODIFY)
Depends on: Task 1

## Task 3: Layout Font Injection (`src/app/layout.tsx`)
- [ ] Import `chivoMono` and `inter` from `./fonts`
- [ ] Add `className` with both font variables to `<body>`

Files: `src/app/layout.tsx` (MODIFY)
Depends on: Task 1

## Task 4: Page Rewrite with Spring Animations (`src/app/page.tsx`)
- [ ] Define shared spring animation constants/variants
- [ ] Update Hero with Chivo Mono headings + stat counters
- [ ] Update Features with spring staggered reveal
- [ ] Update Benefits with spring slide animations
- [ ] Update Pricing with spring staggered cards
- [ ] Update Contact section
- [ ] Add Stats section (animated number counters) after Hero
- [ ] Add Testimonials section (3 quote cards) between Benefits and Pricing
- [ ] Add FAQ section (shadcn Accordion) between Contact and Footer
- [ ] Update all hover effects to spring-based
- [ ] Maintain `useReducedMotion` for all animations
- [ ] Maintain existing preloader

Files: `src/app/page.tsx` (REWRITE)
Depends on: Task 2, Task 3

## Task 5: Build & Verify
- [ ] Run `pnpm run build`
- [ ] Check for compilation errors
- [ ] Verify fonts load correctly
- [ ] Verify dark mode toggle
- [ ] Verify reduced motion
