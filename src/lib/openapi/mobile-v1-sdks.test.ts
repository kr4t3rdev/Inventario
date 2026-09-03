import { access, chmod, mkdir, mkdtemp, readFile, readdir, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';

import { describe, expect, it } from 'vitest';

import { generateSdk } from '../../../scripts/openapi/generate.mjs';

const HTTP_METHODS = ['get', 'post', 'put', 'patch', 'delete'] as const;
const SDK_ROOT = path.join(process.cwd(), 'sdks/mobile-v1');
const SDK_SOURCE_EXTENSIONS: Record<string, string[]> = {
  typescript: ['.ts'],
  dart: ['.dart'],
  swift: ['.swift'],
  kotlin: ['.kt'],
};

interface OpenApiOperation {
  operationId?: string;
}

interface OpenApiDocument {
  paths: Record<string, Partial<Record<(typeof HTTP_METHODS)[number], OpenApiOperation>>>;
}

/**
 * @description Recursively lists files in a generated SDK directory.
 * @param {string} directory - Directory to inspect.
 * @returns {Promise<string[]>} Sorted absolute file paths.
 */
async function listFiles(directory: string): Promise<string[]> {
  const entries = await readdir(directory, { withFileTypes: true });
  const nested = await Promise.all(entries.map(async (entry) => {
    const entryPath = path.join(directory, entry.name);
    return entry.isDirectory() ? listFiles(entryPath) : [entryPath];
  }));
  return nested.flat().sort();
}

/**
 * @description Reads stable operation identifiers from the mobile v1 contract.
 * @returns {Promise<string[]>} Sorted operation identifiers.
 */
async function operationIds(): Promise<string[]> {
  const contract = JSON.parse(
    await readFile(path.join(process.cwd(), 'docs/openapi/mobile-v1.json'), 'utf8'),
  ) as OpenApiDocument;

  return Object.values(contract.paths).flatMap((pathItem) =>
    HTTP_METHODS.flatMap((method) => pathItem[method]?.operationId ?? []),
  ).sort();
}

describe('mobile v1 generated SDKs', () => {
  it('pins local generation configuration for every supported platform', async () => {
    const packageJson = JSON.parse(await readFile('package.json', 'utf8')) as {
      scripts: Record<string, string>;
      devDependencies: Record<string, string>;
    };
    const openApiTools = JSON.parse(await readFile('openapitools.json', 'utf8')) as {
      generator: { version: string; jarPath: string; downloadUrl: string; sha256: string };
    };

    expect(packageJson.devDependencies).not.toHaveProperty(
      '@openapitools/openapi-generator-cli',
    );
    expect(packageJson.scripts['openapi:generate']).toBe('node scripts/openapi/generate.mjs');
    expect(packageJson.scripts['openapi:generate:check'])
      .toBe('node scripts/openapi/check-generated.mjs');
    expect(packageJson.scripts['openapi:parity']).toContain('mobile-v1-sdks.test.ts');
    expect(openApiTools.generator).toEqual({
      version: '7.17.0',
      jarPath: '.cache/openapi-generator/openapi-generator-cli-7.17.0.jar',
      downloadUrl: 'https://repo.maven.apache.org/maven2/org/openapitools/' +
        'openapi-generator-cli/7.17.0/openapi-generator-cli-7.17.0.jar',
      sha256: '25d6bd8273dd2be99979d544b62ea43f0ce1975f1aa582678b5093d1e7fcfce8',
    });

    await Promise.all(Object.keys(SDK_SOURCE_EXTENSIONS).map((sdk) =>
      access(path.join(process.cwd(), 'openapi-generator', `${sdk}.yaml`)),
    ));
  });

  it.each(Object.entries(SDK_SOURCE_EXTENSIONS))(
    'generates all 110 stable operation names in the %s SDK',
    async (sdk, extensions) => {
      const expectedOperationIds = await operationIds();
      const files = (await listFiles(path.join(SDK_ROOT, sdk)))
        .filter((file) => extensions.includes(path.extname(file)));
      const source = (await Promise.all(files.map((file) => readFile(file, 'utf8')))).join('\n');

      expect(expectedOperationIds).toHaveLength(110);
      expect(files.length).toBeGreaterThan(0);
      expect(expectedOperationIds.filter((operationId) => source.includes(operationId)))
        .toEqual(expectedOperationIds);
    },
  );

  it.each(Object.keys(SDK_SOURCE_EXTENSIONS))(
    'keeps %s generation free of wall-clock timestamps',
    async (sdk) => {
      const extensions = SDK_SOURCE_EXTENSIONS[sdk];
      const files = (await listFiles(path.join(SDK_ROOT, sdk)))
        .filter((file) => extensions.includes(path.extname(file)));
      const source = (await Promise.all(files.map((file) => readFile(file, 'utf8')))).join('\n');

      expect(source).not.toMatch(/generated (?:at|on):?\s+\d{4}-\d{2}-\d{2}/i);
    },
    30_000,
  );

  it('exposes a configurable base URL and Bearer token injection on every SDK', async () => {
    const evidence = await Promise.all([
      readFile(path.join(SDK_ROOT, 'typescript/src/runtime.ts'), 'utf8'),
      readFile(path.join(SDK_ROOT, 'typescript/src/apis/AuthApi.ts'), 'utf8'),
      readFile(path.join(SDK_ROOT, 'dart/lib/api_client.dart'), 'utf8'),
      readFile(path.join(SDK_ROOT, 'dart/lib/auth/http_bearer_auth.dart'), 'utf8'),
      readFile(path.join(SDK_ROOT, 'swift/Sources/APIs.swift'), 'utf8'),
      readFile(path.join(
        SDK_ROOT,
        'kotlin/src/main/kotlin/com/tcp/mobile/v1/infrastructure/ApiClient.kt',
      ), 'utf8'),
      readFile(path.join(SDK_ROOT, 'typescript/src/models/JsonValue.ts'), 'utf8'),
      readFile(path.join(SDK_ROOT, 'swift/Sources/Models/JsonValue.swift'), 'utf8'),
      readFile(path.join(
        SDK_ROOT,
        'swift/Sources/Models/PutAccountingPaymentTypesIdResponse.swift',
      ), 'utf8'),
    ]);

    expect(evidence[0]).toContain('basePath?: string');
    expect(evidence[1]).toContain('`Bearer ${tokenString}`');
    expect(evidence[2]).toContain('this.basePath');
    expect(evidence[3]).toContain("'Authorization'] = 'Bearer $accessToken'");
    expect(evidence[4]).toContain('public static var basePath');
    expect(evidence[4]).toContain('public static var accessToken');
    expect(evidence[4].match(/public static var accessToken/g)).toHaveLength(1);
    expect(evidence[5]).toContain('const val baseUrlKey');
    expect(evidence[5]).toContain('"Bearer $accessToken"');
    expect(evidence[6]).not.toContain("from './JsonValue'");
    expect(evidence[6]).not.toContain("from './any'");
    expect(evidence[7]).toContain('case array([JsonValue])');
    expect(evidence[7]).toContain('case object([String: JsonValue])');
    expect(evidence[8]).toContain('public var success: Bool?');
    expect(evidence[8]).not.toContain('AnyCodable?');
  });

  it('redacts credentials from every generated string representation', async () => {
    const sensitiveModels = [
      'AuthSession',
      'LoginRequest',
      'RefreshRequest',
      'SwitchTenantResponse',
      'Token',
      'TokenPair',
    ];
    const dartFiles = ['auth_session', 'login_request', 'refresh_request',
      'switch_tenant_response', 'token', 'token_pair'];
    const dart = (await Promise.all(dartFiles.map((file) =>
      readFile(path.join(SDK_ROOT, `dart/lib/model/${file}.dart`), 'utf8'),
    ))).join('\n');
    const kotlin = (await Promise.all(sensitiveModels.map((model) =>
      readFile(path.join(
        SDK_ROOT,
        `kotlin/src/main/kotlin/com/tcp/mobile/v1/models/${model}.kt`,
      ), 'utf8'),
    ))).join('\n');
    const swift = (await Promise.all(sensitiveModels.map((model) =>
      readFile(path.join(SDK_ROOT, `swift/Sources/Models/${model}.swift`), 'utf8'),
    ))).join('\n');
    const typescript = (await Promise.all(sensitiveModels.map((model) =>
      readFile(path.join(SDK_ROOT, `typescript/src/models/${model}.ts`), 'utf8'),
    ))).join('\n');

    expect(dart).toContain('<redacted>');
    expect(dart).not.toMatch(/\$(?:password|accessToken|refreshToken|token)\b/);
    expect(kotlin.match(/override fun toString\(\): String/g)).toHaveLength(6);
    expect(kotlin).toContain('<redacted>');
    expect(kotlin).not.toMatch(/\$(?:password|accessToken|refreshToken|token)\b/);
    expect(swift.match(/CustomStringConvertible/g)).toHaveLength(6);
    expect(swift).toContain('<redacted>');
    expect(swift).not.toMatch(/\\\((?:password|accessToken|refreshToken|token)\)/);
    expect(typescript).not.toContain('toString(');
  });

  it('places Swift redacted descriptions at model scope', async () => {
    const model = await readFile(
      path.join(SDK_ROOT, 'swift/Sources/Models/AuthSession.swift'),
      'utf8',
    );
    const encodeStart = model.indexOf('public func encode(to encoder: Encoder) throws {');
    const descriptionStart = model.indexOf('public var description: String');
    let depth = 0;
    let encodeEnd = -1;

    for (let index = model.indexOf('{', encodeStart); index < model.length; index += 1) {
      if (model[index] === '{') depth += 1;
      if (model[index] === '}') depth -= 1;
      if (depth === 0) {
        encodeEnd = index;
        break;
      }
    }

    expect(encodeStart).toBeGreaterThan(-1);
    expect(encodeEnd).toBeGreaterThan(encodeStart);
    expect(descriptionStart).toBeGreaterThan(encodeEnd);
  });

  it('preserves existing SDK output when generation fails', async () => {
    const temporaryRoot = await mkdtemp(path.join(tmpdir(), 'tcp-openapi-failure-'));
    const outputDirectory = path.join(temporaryRoot, 'typescript');
    const sentinel = path.join(outputDirectory, 'existing-output.txt');
    const failingJava = path.join(temporaryRoot, 'java');
    const previousJava = process.env.JAVA_BIN;
    const previousJar = process.env.OPENAPI_GENERATOR_JAR;

    try {
      await mkdir(outputDirectory, { recursive: true });
      await writeFile(sentinel, 'preserve me');
      await writeFile(failingJava, '#!/bin/sh\n[ "$1" = "-version" ] && exit 0\nexit 23\n');
      await chmod(failingJava, 0o755);
      process.env.JAVA_BIN = failingJava;
      process.env.OPENAPI_GENERATOR_JAR = '/tmp/openapi-generator-cli-7.17.0.jar';

      expect(() => generateSdk('typescript', outputDirectory)).toThrow(
        'OpenAPI Generator failed for typescript with status 23.',
      );
      await expect(readFile(sentinel, 'utf8')).resolves.toBe('preserve me');
    } finally {
      if (previousJava === undefined) delete process.env.JAVA_BIN;
      else process.env.JAVA_BIN = previousJava;
      if (previousJar === undefined) delete process.env.OPENAPI_GENERATOR_JAR;
      else process.env.OPENAPI_GENERATOR_JAR = previousJar;
      await rm(temporaryRoot, { recursive: true, force: true });
    }
  });

  it('removes generated publishing scripts, tokens, and packaged artifacts', async () => {
    const files = await listFiles(SDK_ROOT);
    const forbiddenPaths = files.filter((file) =>
      /(?:^|\/)(?:git_push\.sh|dist|build)(?:\/|$)|\.(?:tgz|tar|tar\.gz|zip)$/i.test(file),
    );
    const scriptFiles = files.filter((file) =>
      /(?:\.sh|\.bat|\.gradle|\.properties|package\.json)$/i.test(file),
    );
    const generatedText = (await Promise.all(
      scriptFiles.map((file) => readFile(file, 'utf8')),
    )).join('\n');
    const manifests = (await Promise.all(['dart', 'swift'].map((sdk) =>
      readFile(path.join(SDK_ROOT, sdk, '.openapi-generator/FILES'), 'utf8'),
    ))).join('\n');

    expect(forbiddenPaths).toEqual([]);
    expect(manifests).not.toContain('git_push.sh');
    expect(generatedText).not.toContain('GIT_TOKEN');
    expect(generatedText).not.toMatch(/\bgit\s+push\b/);
    expect(generatedText).not.toMatch(/\brm\s+-rf\b/);
  });
});
