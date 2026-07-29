import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const read = (path: string) => readFileSync(path, 'utf8');

describe('landing phase 3A composition contracts', () => {
  it('uses varied composition instead of repeated feature and benefit card grids', () => {
    const features = read('src/features/landing/components/features.tsx');
    const benefits = read('src/features/landing/components/benefits.tsx');

    expect(features).toContain('Base operativa');
    expect(features).toContain('divide-y');
    expect(benefits).toContain('<ol');
    expect(benefits).not.toContain('<Card');
  });

  it('keeps proof sections compact and reduced-motion aware', () => {
    const stats = read('src/features/reviews/components/landing-stats-dynamic.tsx');
    const testimonials = read('src/features/reviews/components/real-testimonials.tsx');

    expect(stats).toContain('useReducedMotion');
    expect(stats).toContain('divide-y');
    expect(testimonials).toContain('useReducedMotion');
    expect(testimonials).toContain('lg:row-span-2');
    expect(testimonials).toContain('id="testimonios"');
    expect(testimonials).toContain('sr-only');
    expect(testimonials).toContain('.catch(() => setHasError(true))');
  });

  it('renders every feature bullet instead of truncating supporting features', () => {
    const features = read('src/features/landing/components/features.tsx');
    expect(features).toContain('feature.bullets.map');
    expect(features).not.toContain('feature.bullets[0]');
  });

  it('passes reduced motion to every SpringSection used by phase 3A proof sections', () => {
    for (const path of [
      'src/features/landing/components/features.tsx',
      'src/features/reviews/components/landing-stats-dynamic.tsx',
      'src/features/reviews/components/real-testimonials.tsx',
    ]) {
      expect(read(path)).toMatch(/<SpringSection[\s\S]*reduceMotion=\{Boolean\(reduceMotion\)\}/);
    }
    expect(read('src/features/landing/utils.tsx')).toContain('reduceMotion?: boolean');
    expect(read('src/features/landing/utils.tsx')).toContain('initial={reduceMotion ? false');
  });
});
