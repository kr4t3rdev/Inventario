const DEFAULT_PAGE_SIZE = 200;
const MAX_PAGE_SIZE = 500;

export class InvalidProductSyncRequestError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'InvalidProductSyncRequestError';
  }
}

export function parseProductSyncLimit(searchParams: URLSearchParams): number {
  const values = searchParams.getAll('limit');
  if (values.length > 1) {
    throw new InvalidProductSyncRequestError('El parámetro limit no puede repetirse.');
  }
  if (values.length === 0) return DEFAULT_PAGE_SIZE;

  const value = values[0];
  if (!/^[1-9]\d*$/.test(value)) {
    throw new InvalidProductSyncRequestError('El parámetro limit debe ser un entero positivo.');
  }

  const limit = Number(value);
  if (!Number.isSafeInteger(limit) || limit > MAX_PAGE_SIZE) {
    throw new InvalidProductSyncRequestError(`El parámetro limit no puede superar ${MAX_PAGE_SIZE}.`);
  }

  return limit;
}

export function getOptionalProductSyncToken(
  searchParams: URLSearchParams,
  name: 'pageToken',
): string | null {
  const values = searchParams.getAll(name);
  if (values.length > 1) {
    throw new InvalidProductSyncRequestError(`El parámetro ${name} no puede repetirse.`);
  }
  if (values.length === 0) return null;
  if (values[0].length === 0) {
    throw new InvalidProductSyncRequestError(`El parámetro ${name} no puede estar vacío.`);
  }
  return values[0];
}

export function getRequiredProductSyncToken(
  searchParams: URLSearchParams,
  name: 'cursor',
): string {
  const values = searchParams.getAll(name);
  if (values.length !== 1 || values[0].length === 0) {
    throw new InvalidProductSyncRequestError(`Se requiere un único parámetro ${name}.`);
  }
  return values[0];
}
