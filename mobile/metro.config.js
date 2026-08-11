const path = require('node:path');
const { getDefaultConfig } = require('expo/metro-config');

const projectRoot = __dirname;
const repoRoot = path.resolve(projectRoot, '..');
const generatedSdkRoot = path.join(repoRoot, 'sdks/mobile-v1/typescript');
const config = getDefaultConfig(projectRoot);

config.watchFolders = [repoRoot, generatedSdkRoot];
config.resolver.nodeModulesPaths = [
  path.resolve(projectRoot, 'node_modules'),
  path.resolve(repoRoot, 'node_modules'),
];
config.resolver.disableHierarchicalLookup = true;

module.exports = config;
