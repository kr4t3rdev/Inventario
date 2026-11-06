import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

describe('landing point-of-sale demo colors', () => {
  it('uses blue decorative gradients while keeping semantic warnings', () => {
    const demo = readFileSync('src/features/landing/components/pos-demo/pv-demo.tsx', 'utf8');
    const warning = readFileSync(
      'src/features/landing/components/pos-demo/turnos/demo-arqueo-form.tsx',
      'utf8',
    );

    expect(demo).not.toContain('from-orange-500');
    expect(demo).toContain('from-blue-500 to-blue-600');
    expect(demo).toContain('hover:from-blue-500/90 hover:to-blue-600/90');
    expect(warning).toContain('text-amber-600');
  });
});
