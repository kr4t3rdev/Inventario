import { execFileSync, spawnSync } from 'node:child_process';
import { mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';

const temporaryDirectories: string[] = [];

afterEach(() => {
  for (const directory of temporaryDirectories.splice(0)) {
    rmSync(directory, { recursive: true, force: true });
  }
});

describe('Vercel ignore rules', () => {
  it('ignores only the root mobile app and includes API route files', () => {
    const directory = mkdtempSync(join(tmpdir(), 'vercel-ignore-'));
    temporaryDirectories.push(directory);
    execFileSync('git', ['init', '--quiet'], { cwd: directory });
    writeFileSync(
      join(directory, '.gitignore'),
      readFileSync(join(process.cwd(), '.vercelignore')),
    );

    const paths = [
      'mobile/app.json',
      'src/app/api/mobile/routes/route.ts',
      'src/app/api/mobile/units/route.ts',
      'src/app/api/mobile/units/[id]/route.ts',
      'src/app/api/auth/me/route.ts',
    ];
    for (const path of paths) {
      const filePath = join(directory, path);
      mkdirSync(join(filePath, '..'), { recursive: true });
      writeFileSync(filePath, '');
    }

    const ignored = (path: string) =>
      spawnSync('git', ['check-ignore', '--no-index', '--quiet', path], {
        cwd: directory,
      }).status === 0;

    expect(ignored('mobile/app.json')).toBe(true);
    expect(ignored('src/app/api/mobile/routes/route.ts')).toBe(false);
    expect(ignored('src/app/api/mobile/units/route.ts')).toBe(false);
    expect(ignored('src/app/api/mobile/units/[id]/route.ts')).toBe(false);
    expect(ignored('src/app/api/auth/me/route.ts')).toBe(false);
  });
});
