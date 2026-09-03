import { readFile } from 'node:fs/promises';
import path from 'node:path';

import { describe, expect, it } from 'vitest';

describe('accounting reports monitor npm script', () => {
  it('exposes a Railway-friendly command that runs once and exits', async () => {
    const packageJson = JSON.parse(
      await readFile(path.resolve(process.cwd(), 'package.json'), 'utf8'),
    ) as { scripts?: Record<string, string> };

    expect(packageJson.scripts?.['ops:monitor:accounting-reports']).toBe(
      'tsx scripts/ops/accounting-reports-monitor.ts',
    );
  });
});
