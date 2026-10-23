import { mkdtempSync, rmSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { tmpdir } from 'node:os';
import path from 'node:path';

import { generateSdk, SDK_NAMES } from './generate.mjs';

/**
 * @description Compares an SDK output tree, except for the root TypeScript installer lockfile.
 * @param {string} sdk - SDK name used in mismatch diagnostics.
 * @param {string} committedDirectory - Checked-in SDK output directory.
 * @param {string} generatedDirectory - Freshly generated SDK output directory.
 * @returns {void}
 */
export function assertGeneratedSdkMatches(sdk, committedDirectory, generatedDirectory) {
  const result = spawnSync('diff', [
    '--recursive',
    '--brief',
    committedDirectory,
    generatedDirectory,
  ], { cwd: process.cwd(), encoding: 'utf8' });
  if (result.error) throw result.error;

  const committedLockfile = path.resolve(committedDirectory, 'pnpm-lock.yaml');
  const generatedLockfile = path.resolve(generatedDirectory, 'pnpm-lock.yaml');
  const relevantDifferences = `${result.stdout ?? ''}${result.stderr ?? ''}`
    .split(/\r?\n/)
    .filter((line) => {
      if (sdk !== 'typescript') return line.length > 0;
      const onlyFile = line.match(/^Only in (.+): pnpm-lock\.yaml$/);
      if (onlyFile) {
        const onlyPath = path.resolve(onlyFile[1], 'pnpm-lock.yaml');
        return onlyPath !== committedLockfile && onlyPath !== generatedLockfile;
      }
      const differentFiles = line.match(/^Files (.+) and (.+) differ$/);
      if (differentFiles) {
        const pair = [path.resolve(differentFiles[1]), path.resolve(differentFiles[2])].sort();
        return pair[0] !== [committedLockfile, generatedLockfile].sort()[0] ||
          pair[1] !== [committedLockfile, generatedLockfile].sort()[1];
      }
      return line.length > 0;
    });

  if (result.status !== 0 && relevantDifferences.length > 0) {
    process.stderr.write(`${relevantDifferences.join('\n')}\n`);
    throw new Error(`Generated ${sdk} SDK does not match the checked-in output.`);
  }
}

if (process.argv[1] && path.resolve(process.argv[1]) === path.resolve(import.meta.filename)) {
  const temporaryRoot = mkdtempSync(path.join(tmpdir(), 'tcp-mobile-v1-sdks-'));
  try {
    for (const sdk of SDK_NAMES) {
      const generatedDirectory = path.join(temporaryRoot, sdk);
      generateSdk(sdk, generatedDirectory);
      assertGeneratedSdkMatches(
        sdk,
        path.join('sdks/mobile-v1', sdk),
        generatedDirectory,
      );
    }
  } catch (error) {
    console.error(`[openapi] ${error instanceof Error ? error.message : String(error)}`);
    process.exitCode = 1;
  } finally {
    rmSync(temporaryRoot, { recursive: true, force: true });
  }
}
