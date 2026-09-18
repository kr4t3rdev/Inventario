import { readFile } from 'node:fs/promises';
import path from 'node:path';

export interface OpenApiContract {
  paths: Record<string, Record<string, unknown>>;
  components?: Record<string, unknown>;
  [key: string]: unknown;
}

const HTTP_METHODS = ['get', 'post', 'put', 'patch', 'delete'] as const;
const PUBLIC_OPERATIONS = new Set(['POST /auth/login', 'POST /auth/refresh', 'POST /auth/register']);

/**
 * @description Carga el contrato OpenAPI mobile v1 desde su ubicación canónica.
 * @returns {Promise<OpenApiContract>} Contrato OpenAPI parseado.
 */
export async function loadMobileV1Contract(): Promise<OpenApiContract> {
  const contractPath = path.join(process.cwd(), 'docs/openapi/mobile-v1.json');
  return JSON.parse(await readFile(contractPath, 'utf8')) as OpenApiContract;
}

/**
 * @description Decodifica un segmento de JSON Pointer según RFC 6901.
 * @param {string} segment - Segmento codificado del puntero.
 * @returns {string} Segmento decodificado.
 */
function decodePointerSegment(segment: string): string {
  return decodeURIComponent(segment).replace(/~1/g, '/').replace(/~0/g, '~');
}

/**
 * @description Comprueba si una referencia local resuelve dentro del contrato.
 * @param {OpenApiContract} contract - Documento raíz del contrato.
 * @param {string} reference - Referencia local que se debe resolver.
 * @returns {boolean} Verdadero cuando el destino existe.
 */
function resolvesLocalReference(contract: OpenApiContract, reference: string): boolean {
  if (!reference.startsWith('#/')) return false;

  return reference.slice(2).split('/').map(decodePointerSegment).reduce<unknown>(
    (current, segment) => {
      if (!current || typeof current !== 'object' || !(segment in current)) return undefined;
      return (current as Record<string, unknown>)[segment];
    },
    contract,
  ) !== undefined;
}

/**
 * @description Recorre el documento y registra referencias locales inválidas.
 * @param {unknown} value - Nodo actual del documento.
 * @param {OpenApiContract} contract - Documento raíz usado para resolver referencias.
 * @param {string} location - Ruta legible del nodo actual.
 * @param {string[]} violations - Acumulador de incumplimientos.
 * @returns {void}
 */
function inspectReferences(
  value: unknown,
  contract: OpenApiContract,
  location: string,
  violations: string[],
): void {
  if (!value || typeof value !== 'object') return;

  if (Array.isArray(value)) {
    value.forEach((item, index) => inspectReferences(
      item,
      contract,
      `${location}[${index}]`,
      violations,
    ));
    return;
  }

  for (const [key, child] of Object.entries(value)) {
    const childLocation = location ? `${location}.${key}` : key;
    if (key === '$ref' && typeof child === 'string') {
      if (!resolvesLocalReference(contract, child)) {
        violations.push(`${childLocation}: referencia no resuelta ${child}`);
      }
      continue;
    }
    inspectReferences(child, contract, childLocation, violations);
  }
}

/**
 * @description Valida referencias, operationId únicos y seguridad explícita por operación.
 * @param {OpenApiContract} contract - Contrato OpenAPI que se debe validar.
 * @returns {string[]} Lista estable de incumplimientos; vacía cuando el contrato es válido.
 */
export function findOpenApiContractViolations(contract: OpenApiContract): string[] {
  const violations: string[] = [];
  const operationIds = new Set<string>();

  inspectReferences(contract, contract, '', violations);

  for (const [routePath, pathItem] of Object.entries(contract.paths)) {
    for (const method of HTTP_METHODS) {
      const operation = pathItem[method] as Record<string, unknown> | undefined;
      if (!operation) continue;

      const label = `${method.toUpperCase()} ${routePath}`;
      const operationId = operation.operationId;
      if (typeof operationId !== 'string' || operationId.length === 0) {
        violations.push(`${label}: operationId ausente`);
      } else if (operationIds.has(operationId)) {
        violations.push(`${label}: operationId duplicado ${operationId}`);
      } else {
        operationIds.add(operationId);
      }

      const expectedSecurity = PUBLIC_OPERATIONS.has(label) ? [] : [{ bearerAuth: [] }];
      if (JSON.stringify(operation.security) !== JSON.stringify(expectedSecurity)) {
        violations.push(`${label}: seguridad explícita inválida`);
      }
    }
  }

  return violations.sort();
}
