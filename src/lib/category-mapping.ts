/**
 * @description Static mapping of product categories to EAN-13 section codes (2 digits).
 * Section codes represent the general type of product.
 *
 * Example:
 *   - Beverages → "14"
 *   - Dairy Products → "15"
 *   - Tobacco → "13"
 */
export const CATEGORY_TO_SECTION: Record<string, string> = {
  // Beverages & Drinks
  Bebidas: '14',

  // Dairy
  Productos_Lacteos: '15',

  // Tobacco & Smoking
  Tabaco: '13',

  // Fruits & Vegetables
  Frutas: '16',

  // Meat & Fish
  Carnes: '17',

  // Bakery
  Panaderia: '18',

  // Frozen Foods
  Congelados: '19',

  // Pantry & Staples
  Alimentos_Secos: '20',

  // Snacks & Candies
  Snacks: '21',

  // Personal Care
  Cuidado_Personal: '22',

  // Cleaning
  Limpieza: '23',

  // Electronics
  Electrodomesticos: '24',

  // Apparel
  Ropa: '25',

  // Other
  Otros: '99',
}

/**
 * @description Static mapping of product subcategories to EAN-13 specific codes (4 digits).
 * Specific codes represent the subcategory or type within a section.
 *
 * Example:
 *   - Alcoholic Beverages → "0285"
 *   - Non-Alcoholic → "0286"
 *   - Pasteurized Milk → "0301"
 */
export const SUBCATEGORY_TO_SPECIFIC: Record<string, string> = {
  // Beverages
  Bebidas_Alcoholicas: '0285',
  Bebidas_No_Alcoholicas: '0286',
  Vino: '0280',
  Cerveza: '0281',
  Licores: '0282',
  Agua: '0287',
  Refrescos: '0288',
  Jugo: '0289',

  // Dairy
  Leche_Pasteurizada: '0301',
  Leche_Evaporada: '0302',
  Yogurt: '0303',
  Queso: '0304',
  Mantequilla: '0305',
  Crema: '0306',

  // Tobacco
  Cigarrillos: '0401',
  Cigarros: '0402',
  Tabaco_Suelto: '0403',

  // Fruits
  Manzanas: '0501',
  Bananas: '0502',
  Naranjas: '0503',
  Uvas: '0504',
  Fresas: '0505',
  Otras_Frutas: '0599',

  // Vegetables
  Papas: '0601',
  Cebollas: '0602',
  Tomates: '0603',
  Lechuga: '0604',
  Zanahorias: '0605',
  Otras_Verduras: '0699',

  // Meat
  Carne_Res: '0701',
  Carne_Cerdo: '0702',
  Carne_Pollo: '0703',
  Embutidos: '0704',
  Otra_Carne: '0799',

  // Fish
  Pescado_Fresco: '0801',
  Mariscos: '0802',
  Pescado_Congelado: '0803',

  // Bakery
  Pan_Blanco: '0901',
  Pan_Integral: '0902',
  Medialunas: '0903',
  Tortas: '0904',
  Otros_Panificados: '0999',

  // Frozen
  Pizzas: '1001',
  Helados: '1002',
  Alimentos_Congelados: '1003',

  // Pantry
  Arroz: '1101',
  Pasta: '1102',
  Aceite: '1103',
  Sal: '1104',
  Azucar: '1105',
  Harina: '1106',
  Otros_Secos: '1199',

  // Snacks
  Papas_Chips: '1201',
  Galletas: '1202',
  Chocolate: '1203',
  Caramelos: '1204',
  Otros_Snacks: '1299',

  // Personal Care
  Jabon: '1301',
  Champu: '1302',
  Pasta_Dental: '1303',
  Desodorante: '1304',
  Perfumes: '1305',

  // Cleaning
  Detergente: '1401',
  Limpiador_Pisos: '1402',
  Desinfectante: '1403',
  Papel_Higinico: '1404',

  // Electronics
  Heladera: '1501',
  Microondas: '1502',
  Tv: '1503',
  Computadora: '1504',

  // Apparel
  Camiseta: '1601',
  Pantalones: '1602',
  Zapatos: '1603',
  Abrigos: '1604',

  // Other
  Otros: '9999',
}

/**
 * @description Maps a category name to its EAN-13 section code.
 * Performs case-insensitive lookup with trimming.
 *
 * @param categoryName - The category name (e.g., "Beverages", "BEBIDAS")
 * @returns The 2-digit section code
 * @throws Error if the category is not found in the mapping
 *
 * @example
 * mapCategoryToSection("Bebidas") → "14"
 * mapCategoryToSection("bebidas") → "14"
 */
export function mapCategoryToSection(categoryName: string): string {
  const normalized = categoryName.trim().toLowerCase()

  // Case-insensitive lookup
  const key = Object.keys(CATEGORY_TO_SECTION).find(
    k => k.toLowerCase() === normalized
  )

  if (!key) {
    throw new Error(
      `Categoría "${categoryName}" no encontrada en mapeo de secciones`
    )
  }

  return CATEGORY_TO_SECTION[key]
}

/**
 * @description Maps a subcategory name to its EAN-13 specific code.
 * Performs case-insensitive lookup with trimming.
 *
 * @param subcategoryName - The subcategory name (e.g., "Alcoholic Beverages")
 * @returns The 4-digit specific code
 * @throws Error if the subcategory is not found in the mapping
 *
 * @example
 * mapSubcategoryToSpecific("Bebidas_Alcoholicas") → "0285"
 * mapSubcategoryToSpecific("bebidas_alcoholicas") → "0285"
 */
export function mapSubcategoryToSpecific(subcategoryName: string): string {
  const normalized = subcategoryName.trim().toLowerCase()

  // Case-insensitive lookup
  const key = Object.keys(SUBCATEGORY_TO_SPECIFIC).find(
    k => k.toLowerCase() === normalized
  )

  if (!key) {
    throw new Error(
      `Subcategoría "${subcategoryName}" no encontrada en mapeo de específicos`
    )
  }

  return SUBCATEGORY_TO_SPECIFIC[key]
}
