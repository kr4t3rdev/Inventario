import { readFile, readdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import ts from 'typescript';

export const HTTP_METHODS = ['GET', 'POST', 'PUT', 'PATCH', 'DELETE'];
const DEFAULT_ROUTE_DIRECTORY = path.join('src', 'app', 'api', 'mobile', 'v1');
const DEFAULT_CONTRACT_PATH = path.join('docs', 'openapi', 'mobile-v1.json');
const HTTP_METHOD_SET = new Set(HTTP_METHODS);
const SERVICE_NAME_PATTERN = /\b([A-Z]\w*Service)\b/g;

/**
 * @description Lists every mobile v1 route file recursively.
 * @param {string} directory - Directory to inspect.
 * @param {string[]} files - Accumulator of absolute route file paths.
 * @returns {Promise<string[]>} Collected route.ts paths.
 */
async function collectRouteFiles(directory, files = []) {
  const entries = await readdir(directory, { withFileTypes: true });
  for (const entry of entries) {
    const entryPath = path.join(directory, entry.name);
    if (entry.isDirectory()) {
      await collectRouteFiles(entryPath, files);
    } else if (entry.name === 'route.ts') {
      files.push(entryPath);
    }
  }
  return files;
}

/**
 * @description Extracts HTTP handler exports from one route file using the TypeScript AST.
 * @param {string} filePath - Route file path.
 * @param {string} source - Route file source code.
 * @returns {{ handlers: string[], reexports: string[] }} Exported HTTP methods and reexport findings.
 */
function extractHttpExports(filePath, source) {
  const sourceFile = ts.createSourceFile(filePath, source, ts.ScriptTarget.ES2022, true);
  const handlers = [];
  const reexports = [];

  for (const statement of sourceFile.statements) {
    const exportModifier = ts.getCombinedModifierFlags(statement) & ts.ModifierFlags.Export;
    if (!exportModifier) continue;

    if (ts.isFunctionDeclaration(statement) && statement.name?.text
      && HTTP_METHOD_SET.has(statement.name.text)) {
      handlers.push(statement.name.text);
      continue;
    }

    if (ts.isVariableStatement(statement)) {
      for (const declaration of statement.declarationList.declarations) {
        if (ts.isIdentifier(declaration.name) && HTTP_METHOD_SET.has(declaration.name.text)) {
          handlers.push(declaration.name.text);
        }
      }
      continue;
    }

    if (ts.isExportDeclaration(statement) && statement.exportClause) {
      const specifiers = statement.exportClause.getChildAt(1).getChildren()
        .filter(ts.isExportSpecifier)
        .map((specifier) => specifier.name.text)
        .filter((name) => HTTP_METHOD_SET.has(name));
      if (specifiers.length > 0) {
        reexports.push(...specifiers);
      }
    }
  }

  return { handlers, reexports };
}

/**
 * @description Discovers the real mobile v1 operations exported by route handlers.
 * @param {string} directory - Route directory to scan.
 * @returns {Promise<{ operations: string[], anomalies: string[] }>} Sorted operations and structural anomalies.
 */
export async function discoverRouteOperations(directory = DEFAULT_ROUTE_DIRECTORY) {
  const root = path.resolve(directory);
  const files = await collectRouteFiles(root);
  const operations = [];
  const anomalies = [];

  for (const filePath of files) {
    const source = await readFile(filePath, 'utf8');
    const routePath = filePath
      .slice(root.length)
      .replace(/[/\\]route\.ts$/, '')
      .replace(/\[([^\]]+)]/g, '{$1}');
    const { handlers, reexports } = extractHttpExports(filePath, source);

    for (const method of reexports) {
      anomalies.push(`${method} ${routePath}: reexport no soportado (${filePath})`);
    }
    if (handlers.length === 0 && reexports.length === 0) {
      anomalies.push(`${routePath}: route.ts sin handler HTTP exportado (${filePath})`);
    }
    for (const method of handlers) {
      operations.push(`${method} ${routePath}`);
    }
  }

  return { operations: [...new Set(operations)].sort(), anomalies: anomalies.sort() };
}

/**
 * @description Loads the canonical OpenAPI mobile v1 contract.
 * @param {string} contractPath - Contract file location.
 * @returns {Promise<any>} Parsed OpenAPI document.
 */
export async function loadContract(contractPath = DEFAULT_CONTRACT_PATH) {
  return JSON.parse(await readFile(path.join(process.cwd(), contractPath), 'utf8'));
}

/**
 * @description Lists the operations documented by the contract.
 * @param {any} contract - Parsed OpenAPI document.
 * @returns {string[]} Sorted METHOD /path operations.
 */
export function documentedOperations(contract) {
  return Object.entries(contract.paths).flatMap(([routePath, pathItem]) =>
    HTTP_METHODS
      .map((method) => method.toLowerCase())
      .filter((method) => pathItem[method] !== undefined)
      .map((method) => `${method.toUpperCase()} ${routePath}`),
  ).sort();
}

/**
 * @description Resolves the request schema name for one operation.
 * @param {any} operation - Documented operation object.
 * @returns {string} Referenced schema name, '(inline)', or '(sin body)'.
 */
function requestSchemaName(operation) {
  const schema = operation?.requestBody?.content?.['application/json']?.schema;
  if (!schema) return '(sin body)';
  if (typeof schema.$ref === 'string') return schema.$ref.split('/').at(-1);
  return '(inline)';
}

/**
 * @description Classifies the declared security of one operation.
 * @param {any} operation - Documented operation object.
 * @returns {string} 'bearer', 'public' or 'none'.
 */
function securityLabel(operation) {
  const security = operation?.security;
  if (Array.isArray(security) && security.length === 0) return 'public';
  if (Array.isArray(security)
    && security.length === 1
    && Object.keys(security[0]).length === 1
    && 'bearerAuth' in security[0]) return 'bearer';
  return 'none';
}

/**
 * @description Extracts service class names imported by a route file.
 * @param {string} source - Route file source code.
 * @returns {string[]} Imported service names.
 */
function importedServices(source) {
  const services = new Set();
  for (const line of source.split(/\r?\n/)) {
    if (!line.trimStart().startsWith('import')) continue;
    for (const match of line.matchAll(SERVICE_NAME_PATTERN)) {
      services.add(match[1]);
    }
  }
  return [...services].sort();
}

/**
 * @description Lists mobile source files that reference each operationId.
 * @param {string} mobileSrcDirectory - Mobile source directory.
 * @param {string[]} operationIds - Operation identifiers to search.
 * @returns {Promise<Map<string, string[]>>} operationId → relative consumer files.
 */
async function mobileConsumers(mobileSrcDirectory, operationIds) {
  const consumers = new Map(operationIds.map((operationId) => [operationId, []]));

  async function scanDirectory(directory) {
    const entries = await readdir(directory, { withFileTypes: true });
    for (const entry of entries) {
      const entryPath = path.join(directory, entry.name);
      if (entry.isDirectory()) {
        await scanDirectory(entryPath);
      } else if (/\.(?:ts|tsx)$/.test(entry.name) && !/\.test\.(?:ts|tsx)$/.test(entry.name)) {
        const source = await readFile(entryPath, 'utf8');
        const relativePath = path
          .relative(mobileSrcDirectory, entryPath)
          .split(path.sep)
          .join('/');
        for (const operationId of operationIds) {
          if (source.includes(operationId)) {
            consumers.get(operationId)?.push(relativePath);
          }
        }
      }
    }
  }

  await scanDirectory(mobileSrcDirectory);
  for (const files of consumers.values()) files.sort();
  return consumers;
}

/**
 * @description Builds the full operation inventory matrix.
 * @param {any} contract - Parsed OpenAPI document.
 * @param {{ operations: string[], anomalies: string[] }} discovered - Real route operations.
 * @param {{ mobileSrcDirectory?: string }} options - Optional consumer scan directory.
 * @returns {Promise<{ rows: object[], summary: object }>} Inventory rows and structural deltas.
 */
export async function buildInventory(contract, discovered, options = {}) {
  const documented = new Set(documentedOperations(contract));
  const routeDirectory = path.resolve(DEFAULT_ROUTE_DIRECTORY);
  const routeFiles = await collectRouteFiles(routeDirectory);
  const routeSourceByPath = new Map();
  for (const filePath of routeFiles) {
    const routePath = filePath
      .slice(routeDirectory.length)
      .replace(/[/\\]route\.ts$/, '')
      .replace(/\[([^\]]+)]/g, '{$1}');
    routeSourceByPath.set(routePath, await readFile(filePath, 'utf8'));
  }

  const rows = [];
  for (const operation of discovered.operations) {
    const [method, ...routeParts] = operation.split(' ');
    const routePath = routeParts.join(' ');
    const documentedOperation = contract.paths[routePath]?.[method.toLowerCase()];
    const operationId = documentedOperation?.operationId ?? '';
    rows.push({
      operation,
      documented: documented.has(operation),
      operationId,
      tag: documentedOperation?.tags?.[0] ?? '',
      requestSchemaName: requestSchemaName(documentedOperation),
      responseStatuses: documentedOperation
        ? Object.keys(documentedOperation.responses ?? {}).sort()
        : [],
      security: documentedOperation ? securityLabel(documentedOperation) : 'none',
      routeServices: importedServices(routeSourceByPath.get(routePath) ?? ''),
      usesRequireTenant: /requireTenant\(/.test(routeSourceByPath.get(routePath) ?? ''),
      usesRequireFeature: /requireFeature\(/.test(routeSourceByPath.get(routePath) ?? ''),
      mobileConsumerFiles: [],
    });
  }

  const operationIds = rows.map((row) => row.operationId).filter(Boolean);
  const consumers = await mobileConsumers(
    options.mobileSrcDirectory ?? path.join('mobile', 'src'),
    operationIds,
  );
  for (const row of rows) {
    row.mobileConsumerFiles = consumers.get(row.operationId) ?? [];
  }

  const seen = new Set();
  const duplicateOperationIds = [];
  for (const operationId of operationIds) {
    if (seen.has(operationId)) duplicateOperationIds.push(operationId);
    seen.add(operationId);
  }

  const summary = {
    realOperations: discovered.operations.length,
    documentedOperations: documented.size,
    missing: discovered.operations.filter((operation) => !documented.has(operation)),
    obsolete: [...documented].filter((operation) => !discovered.operations.includes(operation)),
    duplicateOperationIds: [...new Set(duplicateOperationIds)].sort(),
    anomalies: discovered.anomalies,
  };

  return { rows, summary };
}

/**
 * @description Renders the inventory as a Markdown report.
 * @param {{ rows: object[], summary: object }} inventory - Built inventory.
 * @param {string} generatedAt - ISO timestamp for the report header.
 * @returns {string} Markdown document.
 */
export function renderInventoryMarkdown(inventory, generatedAt) {
  const { rows, summary } = inventory;
  const lines = [
    '# Inventario de operaciones mobile v1 (OpenAPI)',
    '',
    `Generado: ${generatedAt}. Fuente: \`docs/openapi/mobile-v1.json\` + rutas en \`src/app/api/mobile/v1\`.`,
    'Artefacto de la Fase 0 del plan de reconciliación OpenAPI. Regenerar con `pnpm run openapi:inventory`.',
    '',
    '## Resumen',
    '',
    `- Operaciones reales: ${summary.realOperations}`,
    `- Operaciones documentadas: ${summary.documentedOperations}`,
    `- Sin documentar: ${summary.missing.length}`,
    `- Documentadas sin implementación: ${summary.obsolete.length}`,
    `- operationId duplicados: ${summary.duplicateOperationIds.length}`,
    `- Anomalías de exportación: ${summary.anomalies.length}`,
    '',
  ];

  if (summary.missing.length > 0) {
    lines.push('### Sin documentar', '', ...summary.missing.map((op) => `- ${op}`), '');
  }
  if (summary.obsolete.length > 0) {
    lines.push('### Documentadas sin implementación', '', ...summary.obsolete.map((op) => `- ${op}`), '');
  }
  if (summary.duplicateOperationIds.length > 0) {
    lines.push('### operationId duplicados', '', ...summary.duplicateOperationIds.map((id) => `- ${id}`), '');
  }
  if (summary.anomalies.length > 0) {
    lines.push('### Anomalías de exportación', '', ...summary.anomalies.map((a) => `- ${a}`), '');
  }

  lines.push(
    '## Matriz por operación',
    '',
    '| Operación | operationId | Request | Respuestas | Auth | Tenant | Permiso | Servicios de ruta | Consumidores móvil |',
    '|---|---|---|---|---|---|---|---|---|',
  );
  for (const row of rows) {
    lines.push(`| ${row.operation} | ${row.operationId || '—'} | ${row.requestSchemaName}`
      + ` | ${row.responseStatuses.join(', ')} | ${row.security}`
      + ` | ${row.usesRequireTenant ? 'sí' : '—'} | ${row.usesRequireFeature ? 'sí' : '—'}`
      + ` | ${row.routeServices.join(', ') || '—'}`
      + ` | ${row.mobileConsumerFiles.join(', ') || '—'} |`);
  }
  lines.push('');
  return lines.join('\n');
}

if (process.argv[1] && path.resolve(process.argv[1]) === path.resolve(import.meta.filename)) {
  const outIndex = process.argv.indexOf('--out');
  const outPath = outIndex > -1 ? process.argv[outIndex + 1] : undefined;
  const discovered = await discoverRouteOperations();
  const contract = await loadContract();
  const inventory = await buildInventory(contract, discovered, {
    mobileSrcDirectory: path.join('mobile', 'src'),
  });
  const markdown = renderInventoryMarkdown(inventory, new Date().toISOString());
  if (outPath) {
    await writeFile(path.join(process.cwd(), outPath), markdown, 'utf8');
    console.log(`[openapi] inventario escrito en ${outPath}`);
  } else {
    console.log(markdown);
  }
}
