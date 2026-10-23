import { access, chmod, mkdir, mkdtemp, readFile, readdir, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';

import { describe, expect, it } from 'vitest';

import { assertGeneratedSdkMatches } from '../../../scripts/openapi/check-generated.mjs';
import { generateSdk, postprocessGeneratedSdk } from '../../../scripts/openapi/generate.mjs';
import { CashPaymentRequestToJSON } from '../../../sdks/mobile-v1/typescript/src/models/CashPaymentRequest';
import { SaleCreateRequestToJSON } from '../../../sdks/mobile-v1/typescript/src/models/SaleCreateRequest';
import { SalesApi } from '../../../sdks/mobile-v1/typescript/src/apis/SalesApi';
import { Configuration } from '../../../sdks/mobile-v1/typescript/src/runtime';

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

const SDK_OPERATION_HELPER_SUFFIXES: Record<string, readonly string[]> = {
  typescript: ['Raw'],
  dart: ['WithHttpInfo'],
  swift: ['WithRequestBuilder'],
  kotlin: ['WithHttpInfo', 'RequestConfig'],
};

/**
 * @description Extracts declared generated-client operations, excluding helper variants.
 * @param {string} source - Generated API source text.
 * @param {string} sdk - SDK language whose method declaration syntax is parsed.
 * @returns {string[]} Canonical operation identifiers declared in the source.
 */
function declaredSdkMethods(source: string, sdk: string): Array<{
  operationId: string;
  helper: string | null;
}> {
  const declarationPatterns: Record<string, RegExp> = {
    typescript: /^\s*async\s+(mobile[A-Z]\w*)\s*\(/gm,
    dart: /^\s*(?:Future<[^\n]+?>|Future)\s+(mobile[A-Z]\w*)\s*\(/gm,
    swift: /^\s*open\s+class\s+func\s+(mobile[A-Z]\w*)\s*\(/gm,
    kotlin: /^\s*fun\s+(mobile[A-Z]\w*)\s*\(/gm,
  };
  const pattern = declarationPatterns[sdk];
  if (!pattern) throw new Error(`Unsupported mobile SDK: ${sdk}`);

  return [...source.matchAll(pattern)].map(([, declaredName]) => {
    const suffix = SDK_OPERATION_HELPER_SUFFIXES[sdk].find((candidate) =>
      declaredName.endsWith(candidate),
    );
    return {
      operationId: suffix ? declaredName.slice(0, -suffix.length) : declaredName,
      helper: suffix ?? null,
    };
  });
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

  it('filters only the SDK known helper declarations, retaining extras and duplicates', () => {
    const declarations = [
      'async mobileGetAdminUsersRaw() {}',
      'async mobileGetAdminUsers() {}',
      'async mobileGetAdminUsersGetter() {}',
      'async mobileGetAdminUsers() {}',
    ].join('\n');
    const methods = declaredSdkMethods(declarations, 'typescript');
    const primaryMethods = methods.filter((method) => method.helper === null);

    expect(methods.filter((method) => method.helper !== null)).toEqual([
      { operationId: 'mobileGetAdminUsers', helper: 'Raw' },
    ]);
    expect(primaryMethods.map((method) => method.operationId)).toEqual([
      'mobileGetAdminUsers',
      'mobileGetAdminUsersGetter',
      'mobileGetAdminUsers',
    ]);
    expect(primaryMethods.filter((method) =>
      method.operationId === 'mobileGetAdminUsers',
    )).toHaveLength(2);
  });

  it.each(Object.entries(SDK_SOURCE_EXTENSIONS))(
    'matches every OpenAPI operation exactly in the %s SDK',
    async (sdk, extensions) => {
      const expectedOperationIds = await operationIds();
      const files = (await listFiles(path.join(SDK_ROOT, sdk))).filter((file) =>
        extensions.includes(path.extname(file)) && /(?:\/api|\/apis)\//i.test(file),
      );
      const source = (await Promise.all(files.map((file) => readFile(file, 'utf8')))).join('\n');
      const actualOperationIds = declaredSdkMethods(source, sdk)
        .filter((method) => method.helper === null)
        .map((method) => method.operationId)
        .sort();

      expect(expectedOperationIds).toHaveLength(125);
      expect(new Set(expectedOperationIds).size).toBe(125);
      expect(files.length).toBeGreaterThan(0);
      expect(actualOperationIds).toEqual(expectedOperationIds);
    },
  );

  it.each(Object.keys(SDK_SOURCE_EXTENSIONS))(
    'generates the cash payment operation date field in the %s SDK',
    async (sdk) => {
      const modelPaths: Record<string, string> = {
        typescript: 'typescript/src/models/CashPaymentRequest.ts',
        dart: 'dart/lib/model/cash_payment_request.dart',
        swift: 'swift/Sources/Models/CashPaymentRequest.swift',
        kotlin: 'kotlin/src/main/kotlin/com/tcp/mobile/v1/models/CashPaymentRequest.kt',
      };
      const apiPaths: Record<string, string> = {
        typescript: 'typescript/src/apis/AccountingCashFinancingApi.ts',
        dart: 'dart/lib/api/accounting_cash_financing_api.dart',
        swift: 'swift/Sources/APIs/AccountingCashFinancingAPI.swift',
        kotlin: 'kotlin/src/main/kotlin/com/tcp/mobile/v1/apis/AccountingCashFinancingApi.kt',
      };
      const source = await readFile(path.join(SDK_ROOT, modelPaths[sdk]), 'utf8');
      const apiSource = await readFile(path.join(SDK_ROOT, apiPaths[sdk]), 'utf8');

      expect(source).toContain('fechaOperacion');
      expect(apiSource).toContain('Idempotency-Key');
    },
  );

  it('omits absent Dart idempotency and operation-date fields without changing other nulls', async () => {
    const temporaryRoot = await mkdtemp(path.join(tmpdir(), 'tcp-openapi-dart-optional-fields-'));
    const outputDirectory = path.join(temporaryRoot, 'dart');
    const modelDirectory = path.join(outputDirectory, 'lib/model');
    const saleFile = path.join(modelDirectory, 'sale_create_request.dart');
    const paymentFile = path.join(modelDirectory, 'cash_payment_request.dart');
    const modelSource = (optionalFields: string[], otherField: string) => [
      'Map<String, dynamic> toJson() {',
      '  final json = <String, dynamic>{};',
      ...optionalFields.flatMap((field) => [
        `  if (this.${field} != null) {`,
        `    json[r'${field}'] = this.${field};`,
        '  } else {',
        `    json[r'${field}'] = null;`,
        '  }',
      ]),
      `  if (this.${otherField} != null) {`,
      `    json[r'${otherField}'] = this.${otherField};`,
      '  } else {',
      `    json[r'${otherField}'] = null;`,
      '  }',
      '  return json;',
      '}',
      '',
    ].join('\n');

    try {
      await mkdir(modelDirectory, { recursive: true });
      await writeFile(saleFile, modelSource(['idempotencyKey'], 'clienteId'));
      await writeFile(
        paymentFile,
        modelSource(['idempotencyKey', 'fechaOperacion'], 'moneda'),
      );

      postprocessGeneratedSdk('dart', outputDirectory);

      const saleSource = await readFile(saleFile, 'utf8');
      const paymentSource = await readFile(paymentFile, 'utf8');
      expect(saleSource).toContain("json[r'idempotencyKey'] = this.idempotencyKey;");
      expect(saleSource).not.toContain("json[r'idempotencyKey'] = null;");
      expect(saleSource).toContain("json[r'clienteId'] = null;");
      expect(paymentSource).toContain("json[r'idempotencyKey'] = this.idempotencyKey;");
      expect(paymentSource).toContain("json[r'fechaOperacion'] = this.fechaOperacion;");
      expect(paymentSource).not.toContain("json[r'idempotencyKey'] = null;");
      expect(paymentSource).not.toContain("json[r'fechaOperacion'] = null;");
      expect(paymentSource).toContain("json[r'moneda'] = null;");
    } finally {
      await rm(temporaryRoot, { recursive: true, force: true });
    }
  });

  it('omits absent optional body keys across SDK serializers while retaining explicit values', async () => {
    const cashPaymentJson = JSON.parse(JSON.stringify(CashPaymentRequestToJSON({
      monto: 2,
      cuentaId: 'account-1',
      tipoPagoId: 'payment-1',
    }))) as Record<string, unknown>;
    const saleCreateJson = JSON.parse(JSON.stringify(SaleCreateRequestToJSON({
      puntoDeVentaId: 'pos-1',
      descuento: 0,
      items: [],
    }))) as Record<string, unknown>;
    const swiftCashPayment = await readFile(
      path.join(SDK_ROOT, 'swift/Sources/Models/CashPaymentRequest.swift'),
      'utf8',
    );
    const swiftSaleCreate = await readFile(
      path.join(SDK_ROOT, 'swift/Sources/Models/SaleCreateRequest.swift'),
      'utf8',
    );
    const kotlinSerializer = await readFile(
      path.join(SDK_ROOT, 'kotlin/src/main/kotlin/com/tcp/mobile/v1/infrastructure/Serializer.kt'),
      'utf8',
    );
    const dartCashPayment = await readFile(
      path.join(SDK_ROOT, 'dart/lib/model/cash_payment_request.dart'),
      'utf8',
    );
    const dartSaleCreate = await readFile(
      path.join(SDK_ROOT, 'dart/lib/model/sale_create_request.dart'),
      'utf8',
    );

    expect(cashPaymentJson).not.toHaveProperty('idempotencyKey');
    expect(cashPaymentJson).not.toHaveProperty('fechaOperacion');
    expect(saleCreateJson).not.toHaveProperty('idempotencyKey');
    expect(CashPaymentRequestToJSON({
      monto: 2,
      cuentaId: 'account-1',
      tipoPagoId: 'payment-1',
      idempotencyKey: 'cash-key-1',
      fechaOperacion: '2026-10-09',
    })).toMatchObject({ idempotencyKey: 'cash-key-1', fechaOperacion: '2026-10-09' });
    expect(SaleCreateRequestToJSON({
      puntoDeVentaId: 'pos-1',
      descuento: 0,
      items: [],
      idempotencyKey: 'sale-key-1',
    })).toMatchObject({ idempotencyKey: 'sale-key-1' });
    expect(swiftCashPayment).toContain('encodeIfPresent(idempotencyKey, forKey: .idempotencyKey)');
    expect(swiftCashPayment).toContain('encodeIfPresent(fechaOperacion, forKey: .fechaOperacion)');
    expect(swiftSaleCreate).toContain('encodeIfPresent(idempotencyKey, forKey: .idempotencyKey)');
    expect(kotlinSerializer).toContain('JsonInclude.Include.NON_ABSENT');
    expect(dartCashPayment).not.toContain("json[r'idempotencyKey'] = null;");
    expect(dartCashPayment).not.toContain("json[r'fechaOperacion'] = null;");
    expect(dartSaleCreate).not.toContain("json[r'idempotencyKey'] = null;");
  });

  it.each(Object.keys(SDK_SOURCE_EXTENSIONS))(
    'generates sale-create idempotency support in the %s SDK',
    async (sdk) => {
      const modelPaths: Record<string, string> = {
        typescript: 'typescript/src/models/SaleCreateRequest.ts',
        dart: 'dart/lib/model/sale_create_request.dart',
        swift: 'swift/Sources/Models/SaleCreateRequest.swift',
        kotlin: 'kotlin/src/main/kotlin/com/tcp/mobile/v1/models/SaleCreateRequest.kt',
      };
      const apiPaths: Record<string, string> = {
        typescript: 'typescript/src/apis/SalesApi.ts',
        dart: 'dart/lib/api/sales_api.dart',
        swift: 'swift/Sources/APIs/SalesAPI.swift',
        kotlin: 'kotlin/src/main/kotlin/com/tcp/mobile/v1/apis/SalesApi.kt',
      };
      const modelSource = await readFile(path.join(SDK_ROOT, modelPaths[sdk]), 'utf8');
      const apiSource = await readFile(path.join(SDK_ROOT, apiPaths[sdk]), 'utf8');

      expect(modelSource).toContain('idempotencyKey');
      expect(apiSource).toContain('Idempotency-Key');
      expect(apiSource).toContain('mobilePostSalesCreate');
    },
  );

  it('forwards caller-provided sale keys to the TypeScript body and optional header', async () => {
    const requests: Array<{ url: string; init?: RequestInit }> = [];
    const api = new SalesApi(new Configuration({
      basePath: 'https://mobile.example/api/mobile/v1',
      fetchApi: async (input, init) => {
        requests.push({ url: String(input), init });
        return new Response('{}', {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        });
      },
    }));
    const saleCreateRequest = {
      puntoDeVentaId: 'pv-1',
      items: [{ productoId: 'product-1', cantidad: 1, precioUnitario: 3 }],
      idempotencyKey: 'sale-logical-42',
    };

    await api.mobilePostSalesCreateRaw({
      saleCreateRequest,
      idempotencyKey: 'sale-attempt-42',
    });
    await api.mobilePostSalesCreateRaw({
      saleCreateRequest: {
        puntoDeVentaId: 'pv-1',
        items: [{ productoId: 'product-1', cantidad: 1, precioUnitario: 3 }],
      },
    });

    expect(requests).toHaveLength(2);
    expect(requests[0].url).toBe('https://mobile.example/api/mobile/v1/sales/create');
    expect(new Headers(requests[0].init?.headers).get('Idempotency-Key'))
      .toBe('sale-attempt-42');
    expect(JSON.parse(String(requests[0].init?.body))).toMatchObject({
      idempotencyKey: 'sale-logical-42',
    });
    expect(new Headers(requests[1].init?.headers).has('Idempotency-Key')).toBe(false);
    expect(JSON.parse(String(requests[1].init?.body))).not.toHaveProperty('idempotencyKey');
  });

  it('keeps generated Kotlin low-level sale key parameters source-compatible', async () => {
    const temporaryRoot = await mkdtemp(path.join(tmpdir(), 'tcp-openapi-kotlin-key-'));
    const outputDirectory = path.join(temporaryRoot, 'kotlin');
    const apiDirectory = path.join(
      outputDirectory,
      'src/main/kotlin/com/tcp/mobile/v1/apis',
    );
    const cashApiFile = path.join(apiDirectory, 'AccountingCashFinancingApi.kt');
    const modelDirectory = path.join(
      outputDirectory,
      'src/main/kotlin/com/tcp/mobile/v1/models',
    );
    const apiFile = path.join(apiDirectory, 'SalesApi.kt');
    const signatures = [
      'fun mobilePostSalesCreateWithHttpInfo(saleCreateRequest: SaleCreateRequest, ' +
        'idempotencyKey: kotlin.String?) : ApiResponse<PostSalesCreateResponse?>',
      'fun mobilePostSalesCreateRequestConfig(saleCreateRequest: SaleCreateRequest, ' +
        'idempotencyKey: kotlin.String?) : RequestConfig<SaleCreateRequest>',
    ].join('\n');
    const cashSignatures = [
      'fun mobilePostAccountingCashDebtsByIdPaymentsWithHttpInfo(id: kotlin.String, ' +
        'cashPaymentRequest: CashPaymentRequest, idempotencyKey: kotlin.String?) : ApiResponse<Response?>',
      'fun mobilePostAccountingCashLoansByIdPaymentsRequestConfig(id: kotlin.String, ' +
        'cashPaymentRequest: CashPaymentRequest, idempotencyKey: kotlin.String?) : RequestConfig<CashPaymentRequest>',
      'fun mobileUnrelated(requiredNullable: kotlin.String?) : RequestConfig<String>',
    ].join('\n');

    try {
      await mkdir(apiDirectory, { recursive: true });
      await mkdir(modelDirectory, { recursive: true });
      await writeFile(apiFile, signatures);
      await writeFile(cashApiFile, cashSignatures);

      postprocessGeneratedSdk('kotlin', outputDirectory);

      const processedSignatures = await readFile(apiFile, 'utf8');
      expect(processedSignatures.match(/idempotencyKey: kotlin\.String\? = null/g))
        .toHaveLength(2);
      const processedCashSignatures = await readFile(cashApiFile, 'utf8');
      expect(processedCashSignatures.match(/idempotencyKey: kotlin\.String\? = null/g))
        .toHaveLength(2);
      expect(processedCashSignatures).toContain('requiredNullable: kotlin.String?');
      expect(processedCashSignatures).not.toContain('requiredNullable: kotlin.String? = null');
      const generatedApi = await readFile(
        path.join(SDK_ROOT, 'kotlin/src/main/kotlin/com/tcp/mobile/v1/apis/SalesApi.kt'),
        'utf8',
      );
      expect(generatedApi).toMatch(
        /fun mobilePostSalesCreateWithHttpInfo\([^\n]*idempotencyKey: kotlin\.String\? = null\)/,
      );
      expect(generatedApi).toMatch(
        /fun mobilePostSalesCreateRequestConfig\([^\n]*idempotencyKey: kotlin\.String\? = null\)/,
      );
      const generatedCashApi = await readFile(
        path.join(SDK_ROOT, 'kotlin/src/main/kotlin/com/tcp/mobile/v1/apis/AccountingCashFinancingApi.kt'),
        'utf8',
      );
      expect(generatedCashApi).toMatch(
        /fun mobilePostAccountingCashDebtsByIdPaymentsWithHttpInfo\([^\n]*idempotencyKey: kotlin\.String\? = null\)/,
      );
      expect(generatedCashApi).toMatch(
        /fun mobilePostAccountingCashLoansByIdPaymentsRequestConfig\([^\n]*idempotencyKey: kotlin\.String\? = null\)/,
      );
    } finally {
      await rm(temporaryRoot, { recursive: true, force: true });
    }
  });

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

      // El runtime ahora valida la presencia del JAR antes de spawnar Java:
      // el fallo determinista es "JAR not found", y aún así no debe tocar la salida previa.
      expect(() => generateSdk('typescript', outputDirectory)).toThrow(
        'OpenAPI Generator JAR not found',
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

  it('ignores only the TypeScript installer lock when comparing generated SDK trees', async () => {
    const temporaryRoot = await mkdtemp(path.join(tmpdir(), 'tcp-openapi-tree-compare-'));
    const committedDirectory = path.join(temporaryRoot, 'committed');
    const generatedDirectory = path.join(temporaryRoot, 'generated');

    try {
      await mkdir(committedDirectory, { recursive: true });
      await mkdir(generatedDirectory, { recursive: true });
      await writeFile(path.join(committedDirectory, 'RequiredApi.ts'), 'export {}\n');
      await writeFile(path.join(generatedDirectory, 'RequiredApi.ts'), 'export {}\n');
      await writeFile(path.join(committedDirectory, 'pnpm-lock.yaml'), 'installer-only\n');

      expect(() => assertGeneratedSdkMatches(
        'typescript',
        committedDirectory,
        generatedDirectory,
      )).not.toThrow();

      await writeFile(path.join(committedDirectory, 'UnexpectedApi.ts'), 'export {}\n');
      expect(() => assertGeneratedSdkMatches(
        'typescript',
        committedDirectory,
        generatedDirectory,
      )).toThrow('does not match');

      await rm(path.join(committedDirectory, 'UnexpectedApi.ts'));
      await mkdir(path.join(committedDirectory, 'src'), { recursive: true });
      await mkdir(path.join(generatedDirectory, 'src'), { recursive: true });
      await writeFile(path.join(committedDirectory, 'src/Existing.ts'), 'export {}\n');
      await writeFile(path.join(generatedDirectory, 'src/Existing.ts'), 'export {}\n');
      await writeFile(path.join(generatedDirectory, 'src/pnpm-lock.yaml'), 'nested\n');
      expect(() => assertGeneratedSdkMatches(
        'typescript',
        committedDirectory,
        generatedDirectory,
      )).toThrow('does not match');
      await rm(path.join(generatedDirectory, 'src/pnpm-lock.yaml'));

      const committedDartDirectory = path.join(temporaryRoot, 'committed-dart');
      const generatedDartDirectory = path.join(temporaryRoot, 'generated-dart');
      await mkdir(committedDartDirectory, { recursive: true });
      await mkdir(generatedDartDirectory, { recursive: true });
      await writeFile(path.join(committedDartDirectory, 'pnpm-lock.yaml'), 'not-allowed\n');
      expect(() => assertGeneratedSdkMatches(
        'dart',
        committedDartDirectory,
        generatedDartDirectory,
      )).toThrow('does not match');

      await rm(path.join(generatedDirectory, 'RequiredApi.ts'));
      expect(() => assertGeneratedSdkMatches(
        'typescript',
        committedDirectory,
        generatedDirectory,
      )).toThrow('does not match');
    } finally {
      await rm(temporaryRoot, { recursive: true, force: true });
    }
  });

  it('normalizes trailing whitespace in generated Markdown deterministically', async () => {
    const temporaryRoot = await mkdtemp(path.join(tmpdir(), 'tcp-openapi-markdown-'));
      const outputDirectory = path.join(temporaryRoot, 'typescript');
      const markdownFile = path.join(outputDirectory, 'docs/SaleCreateRequest.md');
      const sourceFile = path.join(outputDirectory, 'src/models/WhitespaceExample.kt');
      const generatedSwiftSnippet = 'let saleCreateRequest = SaleCreateRequest(' +
        'puntoDeVentaId: "puntoDeVentaId_example", clienteId: "clienteId_example", ' +
        'empleadoId: "empleadoId_example", descuento: 123, observaciones: "observaciones_example", ' +
        'items: [SaleItemRequest(productoId: "productoId_example", cantidad: 123, ' +
        'precioUnitario: 123)], turnoId: "turnoId_example", metodoPago: "metodoPago_example", ' +
        'montoEfectivo: 123, montoTarjeta: 123, montoTransferencia: 123, montoCredito: 123, ' +
        'tipoVencimiento: "tipoVencimiento_example", fechaVencimiento: "fechaVencimiento_example", ' +
        'cuentaBancariaId: "cuentaBancariaId_example", idempotencyKey: "idempotencyKey_example") ' +
        '// SaleCreateRequest | ';

    try {
      await mkdir(path.dirname(markdownFile), { recursive: true });
      await mkdir(path.join(outputDirectory, 'src/models'), { recursive: true });
      await writeFile(
        sourceFile,
        'class Example {\n    \n    /** comment  \n     * detail  \n     */\n' +
          '    val literal = "literal  "\n}\n',
      );
      await writeFile(
        markdownFile,
        '# SaleCreateRequest  \n\nfield | description \t\nhard break  \nnext\n' +
          '```text\nliteral code  \n```\n```typescript\n' +
          'const config = new Configuration({ \n```\n```swift\n' + generatedSwiftSnippet + '\n' +
          'let intentional = "literal  "\n```\n',
      );

      postprocessGeneratedSdk('typescript', outputDirectory);

      const markdown = await readFile(markdownFile, 'utf8');
      expect(markdown).toBe(
        '# SaleCreateRequest\\\n\nfield | description\\\nhard break\\\nnext\n' +
          '```text\nliteral code  \n```\n```typescript\n' +
          'const config = new Configuration({\n```\n```swift\n' +
          generatedSwiftSnippet.trimEnd() + '\n' +
          'let intentional = "literal  "\n```\n',
      );
      expect(await readFile(sourceFile, 'utf8')).toBe(
        'class Example {\n\n    /** comment\n     * detail\n     */\n' +
          '    val literal = "literal  "\n}\n',
      );
    } finally {
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
