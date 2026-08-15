import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const configPath = resolve(dirname(import.meta.filename), '../metro.config.js');
const appPath = resolve(dirname(import.meta.filename), '../App.tsx');
const dashboardPath = resolve(dirname(import.meta.filename), './BusinessDashboard.tsx');

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

  it('wires unauthorized data responses to local session expiry', () => {
    const app = readFileSync(appPath, 'utf8');
    expect(app).toContain('createGeneratedBusinessApi');
    expect(app).toContain('clearLocalSession');
    expect(app).toContain("setStatus('signed-out')");
  });

  it('keeps the business dashboard safe-area and theme-token guarded', () => {
    const dashboard = readFileSync(dashboardPath, 'utf8');
    expect(dashboard).toContain('SafeAreaView');
    expect(dashboard).toContain('useColorScheme');
    expect(dashboard).toContain('darkTheme');
    expect(dashboard).not.toContain('Todas las ubicaciones');
    expect(dashboard).not.toContain('Costo');
  });
});
