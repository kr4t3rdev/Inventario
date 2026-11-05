/**
 * @description Funciones puras para validar y expandir matrices de variantes.
 * @module features/productos/services/variantes
 */

export interface AtributoVarianteInput {
  nombre: string;
  valores: string[];
}

export interface CombinacionVariante {
  atributos: Record<string, string>;
  sku: string;
}

/**
 * @description Normaliza una parte de SKU a caracteres ASCII seguros.
 * @param {string} value - Valor legible de un atributo.
 * @returns {string} Segmento en mayúsculas separado por guiones.
 */
function normalizeSkuPart(value: string): string {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
}

/**
 * @description Construye el producto cartesiano y un SKU determinista por combinación.
 * @param {AtributoVarianteInput[]} attributes - Atributos ordenados y sus valores.
 * @param {string} skuPrefix - Prefijo común de SKU.
 * @param {number} maxVariants - Máximo de combinaciones permitido.
 * @returns {CombinacionVariante[]} Combinaciones con atributos y SKU.
 * @throws {Error} Si hay atributos inválidos, exceso de combinaciones o SKU duplicados.
 */
export function buildVariantCombinations(
  attributes: AtributoVarianteInput[],
  skuPrefix: string,
  maxVariants = 100,
): CombinacionVariante[] {
  const prefix = normalizeSkuPart(skuPrefix);
  if (!prefix || prefix.length > 100) {
    throw new Error('El prefijo de SKU debe incluir caracteres alfanuméricos');
  }
  if (attributes.length === 0) {
    throw new Error('La plantilla requiere al menos un atributo');
  }

  const names = new Set<string>();
  const normalizedAttributes = attributes.map((attribute) => {
    const name = attribute.nombre.trim();
    const normalizedName = name.toLocaleLowerCase();
    if (!name) throw new Error('El nombre de cada atributo es obligatorio');
    if (names.has(normalizedName)) {
      throw new Error('Los nombres de atributos deben ser únicos');
    }
    names.add(normalizedName);

    const values = attribute.valores.map((value) => value.trim());
    if (values.length === 0 || values.some((value) => !value)) {
      throw new Error('Cada atributo requiere al menos un valor');
    }
    const normalizedValues = values.map((value) => value.toLocaleLowerCase());
    if (new Set(normalizedValues).size !== values.length) {
      throw new Error('Los valores de cada atributo deben ser únicos');
    }

    return { name, values };
  });

  const combinationCount = normalizedAttributes.reduce(
    (count, attribute) => count * attribute.values.length,
    1,
  );
  if (combinationCount > maxVariants) {
    throw new Error(`La matriz excede el máximo de ${maxVariants} variantes`);
  }

  let combinations: Array<{ attributes: Record<string, string>; skuParts: string[] }> = [
    { attributes: {}, skuParts: [] },
  ];
  for (const attribute of normalizedAttributes) {
    combinations = combinations.flatMap((combination) =>
      attribute.values.map((value) => ({
        attributes: { ...combination.attributes, [attribute.name]: value },
        skuParts: [...combination.skuParts, value],
      })),
    );
  }

  const result = combinations.map(({ attributes: variantAttributes, skuParts }) => {
    const normalizedParts = skuParts.map(normalizeSkuPart);
    if (normalizedParts.some((part) => !part)) {
      throw new Error('Cada valor de atributo debe aportar letras o números al SKU');
    }
    const sku = [prefix, ...normalizedParts].join('-');
    if (sku.length > 100) throw new Error('El SKU generado supera los 100 caracteres');
    return { atributos: variantAttributes, sku };
  });
  if (new Set(result.map((variant) => variant.sku)).size !== result.length) {
    throw new Error('La normalización produce SKU duplicados');
  }

  return result;
}
