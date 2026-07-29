import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const read = (path: string) => readFileSync(path, 'utf8');

describe('landing phase 3B contracts', () => {
  it('keeps pricing visible while loading, failing, or receiving no plans', () => {
    const pricing = read('src/features/reviews/components/pricing-dynamic.tsx');

    expect(pricing).toContain('Cargando planes');
    expect(pricing).toContain('hasError');
    expect(pricing).toContain('plans.length === 0');
    expect(pricing).not.toContain('if (isLoading) return null');
    expect(pricing).not.toContain('if (plans.length === 0) return null');
  });

  it('uses accessible anchors without nesting a button inside a link', () => {
    const pricing = read('src/features/reviews/components/pricing-dynamic.tsx');
    const contact = read('src/features/landing/components/contact.tsx');

    expect(pricing).toContain('Button asChild');
    expect(pricing).not.toMatch(/<Link[^>]*>\s*<Button/);
    expect(contact).toContain('id="contacto"');
    expect(contact).toContain('aria-labelledby="contacto-title"');
    expect(contact).toContain('aria-label={`${item.label}: ${item.value}`}');
  });

  it('honors reduced motion in animated landing sections', () => {
    expect(read('src/features/landing/components/faq.tsx')).toContain('useReducedMotion');
    expect(read('src/features/landing/components/contact.tsx')).toContain('useReducedMotion');
    expect(read('src/features/reviews/components/pricing-dynamic.tsx')).toContain('useReducedMotion');
  });

  it('keeps footer navigation tied to existing landing and application routes', () => {
    const footer = read('src/features/landing/components/footer.tsx');

    expect(footer).toContain('href="#precios"');
    expect(footer).toContain('href="#contacto"');
    expect(footer).toContain('href="/login"');
    expect(footer).toContain('href="/register"');
    expect(footer).not.toContain('href="/privacy"');
  });
});
