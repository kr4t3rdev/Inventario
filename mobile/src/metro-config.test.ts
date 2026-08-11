import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const configPath = resolve(dirname(import.meta.filename), '../metro.config.js');
const appPath = resolve(dirname(import.meta.filename), '../App.tsx');

describe('Expo Metro boundary', () => {
  it('watches the generated SDK while resolving dependencies from standalone mobile first', () => {
    const config = readFileSync(configPath, 'utf8');

    expect(config).toContain("require('expo/metro-config')");
    expect(config).toContain("path.resolve(projectRoot, '..')");
    expect(config).toContain("path.join(repoRoot, 'sdks/mobile-v1/typescript')");
    expect(config).toContain('config.watchFolders');
    expect(config).toContain("path.resolve(projectRoot, 'node_modules')");
    expect(config).toContain("path.resolve(repoRoot, 'node_modules')");
    expect(config).toContain('config.resolver.nodeModulesPaths');
  });

  it('imports the appearance hook from React Native', () => {
    const app = readFileSync(appPath, 'utf8');

    expect(app).toContain("useColorScheme } from 'react-native'");
    expect(app).not.toContain("useColorScheme, useEffect");
  });
});
