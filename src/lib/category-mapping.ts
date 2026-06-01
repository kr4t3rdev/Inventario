/**
 * @description Mapeo de categorías a códigos EAN-13 (sección y específico).
 *
 * Basado en el Clasificador CLAS.xlsx oficial.
 * Los datos fueron extraídos a JSON en src/lib/data/ para mantener
 * el archivo TS pequeño y las mappings editables sin compilar.
 *
 * @module lib/category-mapping
 */

import categoryToSection from "./data/category-to-section.json";
import subcategoryToSpecific from "./data/subcategory-to-specific.json";

// ─── Mappings (datos en JSON) ───────────────────────────

/**
 * @description Mapeo de categorías a códigos de sección EAN-13 (2 dígitos).
 * Ejemplo: "ALIMENTOS" → "21", "CONFECCIONES" → "30"
 */
export { categoryToSection as CATEGORY_TO_SECTION };

/**
 * @description Mapeo de subcategorías a códigos específicos EAN-13 (4 dígitos).
 * Ejemplo: "PANTALONES DE VESTIR (HOMBRE)" → "1448"
 */
export { subcategoryToSpecific as SUBCATEGORY_TO_SPECIFIC };

// ─── Funciones ──────────────────────────────────────────

/**
 * @description Obtiene el código de sección EAN-13 (2 dígitos) para una categoría.
 * Normaliza a minúsculas y recorta espacios automáticamente.
 *
 * @param {string} categoryName - Nombre de la categoría
 * @returns {string} Código de sección de 2 dígitos
 * @throws Error si la categoría no está en el mapeo
 *
 * @example
 * mapCategoryToSection("ALIMENTOS") // "21"
 */
export function mapCategoryToSection(categoryName: string): string {
	const normalized = categoryName.trim().toLowerCase();

	const key = Object.keys(categoryToSection).find(
		(k) => k.toLowerCase() === normalized,
	);

	if (!key) {
		throw new Error(
			`Categoría "${categoryName}" no encontrada en mapeo de secciones.`,
		);
	}

	return categoryToSection[key as keyof typeof categoryToSection];
}

/**
 * @description Obtiene el código específico EAN-13 (4 dígitos) para una subcategoría.
 * Normaliza a minúsculas y recorta espacios automáticamente.
 *
 * @param {string} subcategoryName - Nombre de la subcategoría
 * @returns {string} Código específico de 4 dígitos
 * @throws Error si la subcategoría no está en el mapeo
 *
 * @example
 * mapSubcategoryToSpecific("PANTALONES DE VESTIR (HOMBRE)") // "1448"
 */
export function mapSubcategoryToSpecific(subcategoryName: string): string {
	const normalized = subcategoryName.trim().toLowerCase();

	const key = Object.keys(subcategoryToSpecific).find(
		(k) => k.toLowerCase() === normalized,
	);

	if (!key) {
		throw new Error(
			`Específico "${subcategoryName}" no encontrada en mapeo de específicos.`,
		);
	}

	return subcategoryToSpecific[key as keyof typeof subcategoryToSpecific];
}
