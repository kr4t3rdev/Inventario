import { createHash } from 'node:crypto';
import { readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';

const CONTRACT_PATH = 'docs/openapi/mobile-v1.json';
const MANIFEST_PATH = path.join('sdks', 'mobile-v1', 'sdk-manifest.json');
const HTTP_METHODS = ['get', 'post', 'put', 'patch', 'delete'];

/**
 * @description Escribe el manifiesto de trazabilidad del SDK mobile v1.
 * @returns {Promise<void>}
 */
export async function writeSdkManifest() {
  const contractRaw = await readFile(path.join(process.cwd(), CONTRACT_PATH), 'utf8');
  const contract = JSON.parse(contractRaw);
  const operations = Object.values(contract.paths).reduce((total, pathItem) =>
    total + HTTP_METHODS.filter((method) => pathItem[method] !== undefined).length, 0);
  const generator = JSON.parse(await readFile(path.join(process.cwd(), 'openapitools.json'), 'utf8'));

  const manifest = {
    contractPath: CONTRACT_PATH,
    contractSha256: createHash('sha256').update(contractRaw).digest('hex'),
    contractVersion: contract.info.version,
    operationCount: operations,
    schemaCount: Object.keys(contract.components.schemas).length,
    generatorVersion: generator.generator.version,
    generatorSha256: generator.generator.sha256,
    generatedAt: new Date().toISOString(),
  };

  await writeFile(path.join(process.cwd(), MANIFEST_PATH), `${JSON.stringify(manifest, null, 2)}\n`);
  return manifest;
}

if (process.argv[1] && path.resolve(process.argv[1]) === path.resolve(import.meta.filename)) {
  const manifest = await writeSdkManifest();
  console.log(`[openapi] manifiesto escrito en ${MANIFEST_PATH}: ${manifest.operationCount} operaciones, contrato ${manifest.contractSha256.slice(0, 12)}`);
}
