/**
 * @description Utilidades puras para el listado y etiquetado de planes en admin.
 */

interface AdminPlanListItem {
  nombre: string;
  descripcion?: string | null;
}

/**
 * @description Filtra planes por nombre o descripción ignorando mayúsculas.
 * @param {AdminPlanListItem[]} plans - Planes disponibles en el admin.
 * @param {string} search - Texto ingresado en el buscador.
 * @returns {AdminPlanListItem[]} Planes que coinciden con la búsqueda.
 */
export function filterAdminPlans<T extends AdminPlanListItem>(
  plans: T[],
  search: string,
): T[] {
  const normalizedSearch = search.trim().toLocaleLowerCase();

  if (!normalizedSearch) {
    return plans;
  }

  return plans.filter((plan) => {
    const nombre = plan.nombre.toLocaleLowerCase();
    const descripcion = plan.descripcion?.toLocaleLowerCase() ?? '';

    return (
      nombre.includes(normalizedSearch) ||
      descripcion.includes(normalizedSearch)
    );
  });
}

/**
 * @description Formatea la etiqueta comercial del precio según la duración real del plan.
 * @param {number} price - Precio del plan.
 * @param {number} durationDays - Duración del plan en días.
 * @returns {string} Etiqueta visible en la tabla del admin.
 */
export function formatPlanPriceLabel(
  price: number,
  durationDays: number,
): string {
  if (price === 0) {
    return 'Gratis';
  }

  const suffix = durationDays === 30 ? 'mes' : `${durationDays} días`;
  return `$${price.toLocaleString()}/${suffix}`;
}
