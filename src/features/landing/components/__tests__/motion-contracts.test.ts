import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

describe('landing reduced-motion contracts', () => {
  it('passes reduced motion through the hero and disables interactive animation branches', () => {
    const source = readFileSync('src/features/landing/components/hero.tsx', 'utf8');

    expect(source).toContain('reduceMotion={reduceMotion}');
    expect(source).toContain('whileHover={reduceMotion ? undefined');
    expect(source).toContain('whileTap={reduceMotion ? undefined');
    expect(source).toContain('initial={reduceMotion ? false : { opacity: 0, y: 30 }}');
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
