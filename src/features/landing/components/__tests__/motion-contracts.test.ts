import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

describe('landing reduced-motion contracts', () => {
  it('passes reduced motion through the hero and disables interactive animation branches', () => {
    const source = readFileSync('src/features/landing/components/hero.tsx', 'utf8');

    expect(source).toContain('reduceMotion={reduceMotion}');
    expect(source).toContain('whileHover={reduceMotion ? undefined');
    expect(source).toContain('whileTap={reduceMotion ? undefined');
    expect(source).toContain('initial={reduceMotion ? false : { y: 30 }}');
  });

  it('supports reduced motion in WordReveal and ParallaxLayer', () => {
    const wordReveal = readFileSync('src/components/ui/word-reveal.tsx', 'utf8');
    const parallax = readFileSync('src/features/landing/utils.tsx', 'utf8');

    expect(wordReveal).toContain('reduceMotion?: boolean');
    expect(wordReveal).toContain('initial={reduceMotion ? false');
    expect(parallax).toContain('reduceMotion?: boolean');
    expect(parallax).toContain('style={reduceMotion ? undefined : { y }}');
  });
});

describe('landing content visibility', () => {
  it('does not hide below-the-fold sections before IntersectionObserver runs', () => {
    const files = [
      'src/features/landing/utils.tsx',
      'src/components/ui/word-reveal.tsx',
      'src/features/landing/components/hero.tsx',
      'src/features/landing/components/benefits.tsx',
      'src/features/landing/components/faq.tsx',
      'src/features/landing/components/features.tsx',
      'src/features/landing/components/pos-demo/pos-demo-section.tsx',
      'src/features/landing/components/pos-demo/pv-demo.tsx',
      'src/features/reviews/components/landing-stats-dynamic.tsx',
      'src/features/reviews/components/pricing-dynamic.tsx',
      'src/features/reviews/components/real-testimonials.tsx',
    ];

    for (const file of files) {
      const source = readFileSync(file, 'utf8');
      expect(source).not.toMatch(/initial=\{[^\n]*opacity:\s*0/);
    }
  });
});
