import { mkdtempSync, rmSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { tmpdir } from 'node:os';
import path from 'node:path';

import { generateSdk, SDK_NAMES } from './generate.mjs';

const temporaryRoot = mkdtempSync(path.join(tmpdir(), 'tcp-mobile-v1-sdks-'));

try {
  for (const sdk of SDK_NAMES) {
    const generatedDirectory = path.join(temporaryRoot, sdk);
    generateSdk(sdk, generatedDirectory);
    const result = spawnSync('diff', [
      '--recursive',
      '--brief',
      path.join('sdks/mobile-v1', sdk),
      generatedDirectory,
    ], { cwd: process.cwd(), stdio: 'inherit' });
    if (result.status !== 0) {
      throw new Error(`Generated ${sdk} SDK does not match the committed output.`);
    }
  }
} catch (error) {
  console.error(`[openapi] ${error instanceof Error ? error.message : String(error)}`);
  process.exitCode = 1;
} finally {
  rmSync(temporaryRoot, { recursive: true, force: true });
}
