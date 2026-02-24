const DANGEROUS_PREFIX = /^\s*[=+\-@]/;

/**
 * @description Sanitiza un valor para exportacion CSV evitando inyeccion de formulas.
 * @param {unknown} value - Valor de celda a serializar.
 * @returns {string} Valor saneado para exportacion.
 */
export function sanitizeCsvCell(value: unknown): string {
  if (value === null || value === undefined) {
    return '';
  }

  const raw = String(value);
  const safe = DANGEROUS_PREFIX.test(raw) ? `'${raw}` : raw;

  if (/[",\n\r]/.test(safe)) {
    return `"${safe.replace(/"/g, '""')}"`;
  }

  return safe;
}

/**
 * @description Construye un contenido CSV valido para descarga.
 * @param {string[]} headers - Encabezados del CSV.
 * @param {unknown[][]} rows - Filas del CSV.
 * @returns {string} Texto CSV completo.
 */
export function buildCsv(headers: string[], rows: unknown[][]): string {
  const headerLine = headers.map((header) => sanitizeCsvCell(header)).join(',');
  const bodyLines = rows.map((row) => row.map((cell) => sanitizeCsvCell(cell)).join(','));

  return [headerLine, ...bodyLines].join('\n');
}
