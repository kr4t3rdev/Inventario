import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const read = (path: string) => readFileSync(path, 'utf8');

describe('landing phase 3A composition contracts', () => {
  it('organizes capabilities as operational layers instead of a dominant oversized card', () => {
    const features = read('src/features/landing/components/features.tsx');
    const benefits = read('src/features/landing/components/benefits.tsx');

    expect(features).toContain('Operación diaria');
    expect(features).toContain('Control financiero');
    expect(features).toContain('Escala del negocio');
    expect(features).toContain('CAPABILITY_GROUPS');
    expect(features).not.toContain('bg-primary p-7');
    expect(benefits).toContain('<ol');
    expect(benefits).not.toContain('<Card');
  });

  it('removes the standalone statistics strip and keeps testimonials reduced-motion aware', () => {
    const landing = read('src/features/landing/components/landing-page-client.tsx');
    const testimonials = read('src/features/reviews/components/real-testimonials.tsx');

    expect(landing).not.toContain('LandingStatsDynamic');
    expect(testimonials).toContain('useReducedMotion');
    expect(testimonials).toContain('lg:row-span-2');
    expect(testimonials).toContain('id="testimonios"');
    expect(testimonials).toContain('sr-only');
    expect(testimonials).toContain('reviews.length < MINIMUM_TESTIMONIALS');
  });

  it('renders every feature bullet instead of truncating supporting features', () => {
    const features = read('src/features/landing/components/features.tsx');
    expect(features).toContain('feature.bullets.map');
    expect(features).not.toContain('feature.bullets[0]');
  });

  it('passes reduced motion to every SpringSection used by phase 3A proof sections', () => {
    for (const path of [
      'src/features/landing/components/features.tsx',
      'src/features/reviews/components/real-testimonials.tsx',
    ]) {
      expect(read(path)).toMatch(/<SpringSection[\s\S]*reduceMotion=\{Boolean\(reduceMotion\)\}/);
    }
    expect(read('src/features/landing/utils.tsx')).toContain('reduceMotion?: boolean');
    expect(read('src/features/landing/utils.tsx')).toContain('initial={reduceMotion ? false');
  });
});
