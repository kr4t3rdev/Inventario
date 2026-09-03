import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

describe('Vitest workspace boundaries', () => {
  it('excludes the independently versioned mobile application', () => {
    const config = readFileSync('vitest.config.mjs', 'utf8');

    expect(config).toContain("'mobile/**'");
  });
});
