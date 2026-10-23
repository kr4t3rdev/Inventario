import { readFile, readdir } from 'node:fs/promises';
import path from 'node:path';

import { describe, expect, it } from 'vitest';

interface OpenApiDocument {
  openapi: string;
  paths: Record<string, Record<string, unknown>>;
  components: {
    securitySchemes: Record<string, unknown>;
    schemas: Record<string, unknown>;
  };
}

const HTTP_METHODS = ['get', 'post', 'put', 'patch', 'delete'] as const;

async function discoverRouteOperations(
  directory = path.join(process.cwd(), 'src/app/api/mobile/v1'),
): Promise<string[]> {
  const entries = await readdir(directory, { withFileTypes: true });
  const operations: string[] = [];

  for (const entry of entries) {
    const entryPath = path.join(directory, entry.name);
    if (entry.isDirectory()) {
      operations.push(...await discoverRouteOperations(entryPath));
      continue;
    }
    if (entry.name !== 'route.ts') continue;

    const source = await readFile(entryPath, 'utf8');
    const routePath = entryPath
      .slice(path.join(process.cwd(), 'src/app/api/mobile/v1').length)
      .replace(/\/route\.ts$/, '')
      .replace(/\[([^\]]+)]/g, '{$1}');

    for (const method of HTTP_METHODS) {
      const exportedHandler = new RegExp(
        `export\\s+(?:async\\s+function|const)\\s+${method.toUpperCase()}\\b`,
      );
      if (exportedHandler.test(source)) operations.push(`${method.toUpperCase()} ${routePath}`);
    }
  }

  return operations.sort();
}

function documentedOperations(contract: OpenApiDocument): string[] {
  return Object.entries(contract.paths).flatMap(([routePath, pathItem]) =>
    HTTP_METHODS
      .filter((method) => pathItem[method] !== undefined)
      .map((method) => `${method.toUpperCase()} ${routePath}`),
  ).sort();
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function resolveSchema(
  contract: OpenApiDocument,
  schema: Record<string, unknown>,
): Record<string, unknown> {
  const reference = schema.$ref;
  if (typeof reference !== 'string') return schema;
  const name = reference.split('/').at(-1);
  return (name ? contract.components.schemas[name] : undefined) as Record<string, unknown>;
}

async function loadContract(): Promise<OpenApiDocument> {
  const contractPath = path.join(process.cwd(), 'docs/openapi/mobile-v1.json');
  return JSON.parse(await readFile(contractPath, 'utf8')) as OpenApiDocument;
}

describe('mobile v1 OpenAPI contract', () => {
  it('defines the OpenAPI foundation and bearer authentication', async () => {
    const contract = await loadContract();

    expect(contract.openapi).toBe('3.1.0');
    expect(contract.components.securitySchemes.bearerAuth).toEqual({
      type: 'http',
      scheme: 'bearer',
      bearerFormat: 'JWT',
    });
    expect(contract.components.schemas.ApiError).toBeDefined();
    expect(contract.components.schemas.TokenPair).toBeDefined();
  });

  it('documents every mobile authentication operation', async () => {
    const contract = await loadContract();

    expect(contract.paths['/auth/login']?.post).toBeDefined();
    expect(contract.paths['/auth/refresh']?.post).toBeDefined();
    expect(contract.paths['/auth/me']?.get).toBeDefined();
    expect(contract.paths['/auth/logout']?.post).toBeDefined();
    expect(contract.paths['/auth/tenants']?.get).toBeDefined();
    expect(contract.paths['/auth/tenants']?.post).toBeDefined();
  });

  it('matches the real mobile response envelopes', async () => {
    const contract = await loadContract();
    const apiError = contract.components.schemas.ApiError as {
      required: string[];
      properties: Record<string, unknown>;
    };

    expect(apiError.required).toEqual(['error']);
    expect(apiError.properties.error).toEqual({ type: 'string' });
    expect(contract.paths['/auth/me']?.get).toMatchObject({
      responses: {
        '200': {
          content: {
            'application/json': {
              schema: { $ref: '#/components/schemas/AuthenticatedUser' },
            },
          },
        },
      },
    });
  });

  it('keeps exact operation parity with every real mobile v1 route', async () => {
    const contract = await loadContract();
    const realOperations = await discoverRouteOperations();

    expect(realOperations).toHaveLength(125);
    expect(documentedOperations(contract)).toEqual(realOperations);
  });

  it('uses a unique operationId for every operation', async () => {
    const contract = await loadContract();
    const operationIds = Object.values(contract.paths).flatMap((pathItem) =>
      HTTP_METHODS.flatMap((method) => {
        const operation = pathItem[method] as { operationId?: string } | undefined;
        return operation?.operationId ? [operation.operationId] : [];
      }),
    );

    expect(operationIds).toHaveLength(125);
    expect(new Set(operationIds).size).toBe(operationIds.length);
  });

  it('does not expose placeholder response or empty request schemas', async () => {
    const contract = await loadContract();

    for (const [routePath, pathItem] of Object.entries(contract.paths)) {
      for (const method of HTTP_METHODS) {
        const operation = pathItem[method] as {
          requestBody?: { content?: { 'application/json'?: { schema?: Record<string, unknown> } } };
          responses?: Record<string, unknown>;
        } | undefined;
        if (!operation) continue;

        expect(JSON.stringify(operation.responses), `${method.toUpperCase()} ${routePath}`)
          .not.toContain('#/components/schemas/GenericResponse');

        const requestSchema = operation.requestBody?.content?.['application/json']?.schema;
        if (requestSchema) {
          const resolved = resolveSchema(contract, requestSchema);
          expect(Object.keys((resolved?.properties ?? {}) as object).length,
            `${method.toUpperCase()} ${routePath}`).toBeGreaterThan(0);
          expect(resolved?.additionalProperties, `${method.toUpperCase()} ${routePath}`)
            .not.toBe(true);
        }
      }
    }
  });

  it('matches reviewed login, payment-type, and bank-transfer boundaries', async () => {
    const contract = await loadContract();
    const login = contract.paths['/auth/login'].post as {
      parameters: Array<Record<string, unknown>>;
      requestBody: { content: { 'application/json': { schema: Record<string, unknown> } } };
    };
    const loginSchema = resolveSchema(
      contract,
      login.requestBody.content['application/json'].schema,
    );

    expect(loginSchema.properties).not.toHaveProperty('tenantId');
    expect(login.parameters).toContainEqual(expect.objectContaining({
      name: 'x-tenant-id',
      in: 'header',
      required: false,
    }));

    const paymentTypeUpdate = contract.paths['/accounting/payment-types/{id}'].put as {
      requestBody: { content: { 'application/json': { schema: Record<string, unknown> } } };
    };
    const paymentTypeSchema = resolveSchema(
      contract,
      paymentTypeUpdate.requestBody.content['application/json'].schema,
    );
    expect(paymentTypeSchema.properties).toMatchObject({
      nombre: expect.any(Object),
      descripcion: expect.any(Object),
      requiereCuenta: expect.any(Object),
      cuentaDefecto: expect.any(Object),
      isActive: expect.any(Object),
    });

    expect(contract.paths['/accounting/bank-transfers/{id}/comprobante'].get)
      .toHaveProperty('responses.404');
  });

  it('documents the capital-injection idempotency header and optional body key', async () => {
    const contract = await loadContract();
    const operation = contract.paths['/accounting/capital-injections'].post as {
      parameters: Array<Record<string, unknown>>;
      description: string;
      requestBody: { content: { 'application/json': { schema: Record<string, unknown> } } };
    };
    const schema = resolveSchema(
      contract,
      operation.requestBody.content['application/json'].schema,
    );
    const schemaProperties = schema.properties;
    expect(isRecord(schemaProperties)).toBe(true);
    if (!isRecord(schemaProperties)) {
      throw new Error('Expected the capital-injection schema to define properties');
    }

    const bodyKey = schemaProperties.idempotencyKey;
    expect(isRecord(bodyKey)).toBe(true);
    if (!isRecord(bodyKey)) {
      throw new Error('Expected idempotencyKey to be an object schema');
    }

    expect(operation.parameters).toContainEqual(expect.objectContaining({
      name: 'Idempotency-Key',
      in: 'header',
      required: false,
      schema: {
        type: 'string',
        minLength: 1,
        maxLength: 64,
      },
    }));
    expect(operation.description).toMatch(/cuerpo.*prevalece/i);
    expect(bodyKey).toMatchObject({
      type: 'string',
      minLength: 1,
      maxLength: 64,
    });
    expect((schema.required as string[])).not.toContain('idempotencyKey');
  });

  it('documents sale-create idempotency precedence, replay, and payload conflicts', async () => {
    const contract = await loadContract();
    const operation = contract.paths['/sales/create'].post as {
      parameters: Array<Record<string, unknown>>;
      description: string;
      requestBody: { content: { 'application/json': { schema: Record<string, unknown> } } };
      responses: Record<string, { description?: string }>;
    };
    const schema = resolveSchema(
      contract,
      operation.requestBody.content['application/json'].schema,
    );
    const properties = schema.properties;
    expect(isRecord(properties)).toBe(true);
    if (!isRecord(properties)) {
      throw new Error('Expected the sale-create schema to define properties');
    }

    expect(properties.idempotencyKey).toMatchObject({
      type: 'string',
      minLength: 1,
      maxLength: 64,
    });
    expect(schema.required as string[]).not.toContain('idempotencyKey');
    expect(operation.parameters).toContainEqual(expect.objectContaining({
      name: 'Idempotency-Key',
      in: 'header',
      required: false,
      schema: { type: 'string', minLength: 1, maxLength: 64 },
    }));
    expect(operation.responses).toHaveProperty('409');
    expect(operation.responses['409'].description)
      .toMatch(/IDEMPOTENCY_KEY_REUSED.*misma clave.*payload normalizado diferente/i);
    expect(operation.description)
      .toMatch(/cuerpo.*prevalece.*payload normalizado.*respuesta original.*autenticaci[oó]n/i);
    expect(operation.description)
      .toMatch(/clave estable por venta l[oó]gica.*reintentos.*no debe generar.*clave nueva/i);
  });

  it('tells mobile clients to retain the same key across sale retries', async () => {
    const docs = await readFile(path.join(process.cwd(), 'docs/mobile-api-contract.md'), 'utf8');
    const saleSection = docs.split('### `PUT /api/mobile/v1/sales/:id/update`')[0];

    expect(saleSection).toMatch(/clave estable por (?:cada )?venta l[oó]gica pendiente/i);
    expect(saleSection).toMatch(/conservar.*reintento/i);
    expect(saleSection).toMatch(/no debe generar.*clave nueva.*cada intento/i);
  });

  it('documents cash payment dates and idempotency for debts and loans', async () => {
    const contract = await loadContract();
    const paymentPaths = [
      '/accounting/cash-debts/{id}/payments',
      '/accounting/cash-loans/{id}/payments',
    ];

    for (const routePath of paymentPaths) {
      const operation = contract.paths[routePath]?.post as {
        parameters: Array<Record<string, unknown>>;
        description: string;
        requestBody: { content: { 'application/json': { schema: Record<string, unknown> } } };
        responses: Record<string, unknown>;
      };
      const schema = resolveSchema(
        contract,
        operation.requestBody.content['application/json'].schema,
      );
      const properties = schema.properties as Record<string, Record<string, unknown>>;
      const fechaOperacion = properties.fechaOperacion;

      expect(fechaOperacion, routePath).toMatchObject({ type: 'string' });
      expect(fechaOperacion.description, routePath).toMatch(/fecha|date/i);
      expect(properties.idempotencyKey, routePath).toMatchObject({
        type: 'string',
        minLength: 1,
        maxLength: 64,
      });
      expect((schema.required as string[]), routePath).not.toContain('fechaOperacion');
      expect(operation.parameters, routePath).toContainEqual(expect.objectContaining({
        name: 'Idempotency-Key',
        in: 'header',
        required: false,
        schema: { type: 'string', minLength: 1, maxLength: 64 },
      }));
      expect(operation.responses, routePath).toHaveProperty('409');
      expect(operation.description, routePath).toMatch(/cuerpo.*prevalece/i);
    }
  });

  it('uses functional Spanish copy instead of generated method/path text', async () => {
    const contract = await loadContract();

    for (const [routePath, pathItem] of Object.entries(contract.paths)) {
      for (const method of HTTP_METHODS) {
        const operation = pathItem[method] as {
          summary?: string;
          description?: string;
        } | undefined;
        if (!operation) continue;

        expect(operation.summary, `${method.toUpperCase()} ${routePath}`)
          .not.toMatch(/^(Get|Post|Put|Patch|Delete)\b/i);
        expect(operation.summary?.length, `${method.toUpperCase()} ${routePath}`)
          .toBeGreaterThan(8);
        expect(operation.description, `${method.toUpperCase()} ${routePath}`)
          .not.toContain(`${method.toUpperCase()} ${routePath}`);
        expect(operation.description?.length, `${method.toUpperCase()} ${routePath}`)
          .toBeGreaterThan(24);
        expect(operation.description, `${method.toUpperCase()} ${routePath}`).not.toMatch(
          /aplicando los filtros, fechas y paginación admitidos|valida y registra .*incluyendo los efectos contables|dentro del tenant autenticado y devuelve su estado resultante/i,
        );
      }
    }
  });

  it('does not publish implicit open objects in request or response schemas', async () => {
    const contract = await loadContract();
    const violations: string[] = [];
    const visitedReferences = new Set<string>();

    function inspectSchema(schema: unknown, location: string): void {
      if (!schema || typeof schema !== 'object' || Array.isArray(schema)) {
        violations.push(`${location}: schema vacío`);
        return;
      }

      const record = schema as Record<string, unknown>;
      if (typeof record.$ref === 'string') {
        if (visitedReferences.has(record.$ref)) return;
        visitedReferences.add(record.$ref);
        const name = record.$ref.split('/').at(-1);
        inspectSchema(name ? contract.components.schemas[name] : undefined, record.$ref);
        return;
      }

      if (Object.keys(record).length === 0) violations.push(`${location}: {}`);
      if (record.type === 'object') {
        const properties = record.properties as Record<string, unknown> | undefined;
        const additionalProperties = record.additionalProperties;
        const explicitDynamicObject = additionalProperties !== undefined
          && additionalProperties !== true;
        if ((!properties || Object.keys(properties).length === 0) && !explicitDynamicObject) {
          violations.push(`${location}: object abierto`);
        }
        if (properties && Object.keys(properties).length > 0 && record.additionalProperties !== false) {
          violations.push(`${location}: object fijo sin additionalProperties false`);
        }
        for (const [name, property] of Object.entries(properties ?? {})) {
          inspectSchema(property, `${location}.properties.${name}`);
        }
        if (additionalProperties && typeof additionalProperties === 'object') {
          inspectSchema(additionalProperties, `${location}.additionalProperties`);
        }
      }
      if (record.items) inspectSchema(record.items, `${location}.items`);
      for (const keyword of ['allOf', 'oneOf', 'anyOf'] as const) {
        const branches = record[keyword];
        if (Array.isArray(branches)) {
          branches.forEach((branch, index) => inspectSchema(branch, `${location}.${keyword}[${index}]`));
        }
      }
    }

    for (const [routePath, pathItem] of Object.entries(contract.paths)) {
      for (const method of HTTP_METHODS) {
        const operation = pathItem[method] as {
          requestBody?: { content?: Record<string, { schema?: unknown }> };
          responses?: Record<string, { content?: Record<string, { schema?: unknown }> }>;
        } | undefined;
        if (!operation) continue;
        for (const [mediaType, media] of Object.entries(operation.requestBody?.content ?? {})) {
          inspectSchema(media.schema, `${method} ${routePath} request ${mediaType}`);
        }
        for (const [status, response] of Object.entries(operation.responses ?? {})) {
          for (const [mediaType, media] of Object.entries(response.content ?? {})) {
            inspectSchema(media.schema, `${method} ${routePath} ${status} ${mediaType}`);
          }
        }
      }
    }

    expect(violations).toEqual([]);
  });

  it('documents every real payment-type mutation error status', async () => {
    const contract = await loadContract();
    const paymentTypes = contract.paths['/accounting/payment-types/{id}'];

    for (const method of ['put', 'delete'] as const) {
      const operation = paymentTypes[method] as { responses: Record<string, unknown> };
      expect(Object.keys(operation.responses), method.toUpperCase()).toEqual(
        expect.arrayContaining(['400', '403', '404']),
      );
    }
  });

  it('documents parameters, request bodies, responses, and bearer security', async () => {
    const contract = await loadContract();

    for (const [routePath, pathItem] of Object.entries(contract.paths)) {
      for (const method of HTTP_METHODS) {
        const operation = pathItem[method] as Record<string, unknown> | undefined;
        if (!operation) continue;

        expect(operation, `${method.toUpperCase()} ${routePath}`).toHaveProperty('operationId');
        expect(operation, `${method.toUpperCase()} ${routePath}`).toHaveProperty('responses');

        const pathParams = [...routePath.matchAll(/{([^}]+)}/g)].map((match) => match[1]);
        const parameters = (operation.parameters ?? []) as Array<Record<string, unknown>>;
        for (const parameterName of pathParams) {
          expect(parameters, `${method.toUpperCase()} ${routePath}`).toContainEqual(
            expect.objectContaining({ name: parameterName, in: 'path', required: true }),
          );
        }

        if (!['POST /auth/login', 'POST /auth/refresh', 'POST /auth/register'].includes(
          `${method.toUpperCase()} ${routePath}`,
        )) {
          expect(operation.security, `${method.toUpperCase()} ${routePath}`).toEqual([
            { bearerAuth: [] },
          ]);
        }
      }
    }

    expect(contract.paths['/sales/create'].post).toHaveProperty('requestBody');
    expect(contract.paths['/accounting/bank-transfers/{id}/comprobante'].get).toMatchObject({
      responses: {
        '200': {
          content: {
            'application/pdf': { schema: { type: 'string', format: 'binary' } },
          },
        },
      },
    });
  });
});
