/**
 * @description Labels dinámicos para la UI de categorías.
 *              Alterna entre terminología estándar (categoría/subcategoría)
 *              y CLAS (sección/específico) según el modo EAN-13.
 *
 * @module features/categorias/lib/category-labels
 */

export interface CategoryLabels {
  /** Título singular del elemento hijo */
  childTitle: string
  /** Título plural del elemento hijo */
  childTitlePlural: string
  /** Botón de acción para crear */
  createLabel: string
  /** Botón de acción para editar */
  editLabel: string
  /** Placeholder para el input de nombre */
  namePlaceholder: string
  /** Descripción del campo nombre */
  nameDescription: string
  /** Descripción del campo descripción */
  descriptionLabel: string
  /** Texto cuando no hay selección */
  noSelectionLabel: string
  /** Label del selector */
  selectorLabel: string
  /** Placeholder del selector */
  selectorPlaceholder: string
  /** Opción "ninguno" en selector */
  noneOptionLabel: string
  /** Label para badge de conteo */
  countLabel: (count: number) => string
  /** Descripción del formulario */
  formDescription: string
  /** Título del formulario en modo creación */
  createFormTitle: string
  /** Texto del botón de submit */
  submitLabel: string
}

export function getCategoryLabels(usaEan13: boolean): CategoryLabels {
  if (usaEan13) {
    return {
      childTitle: 'específico CLAS',
      childTitlePlural: 'específicos CLAS',
      createLabel: 'Nuevo Específico CLAS',
      editLabel: 'Editar Específico CLAS',
      namePlaceholder: 'Ingrese el nombre del específico',
      nameDescription: 'Nombre del específico dentro de la sección CLAS.',
      descriptionLabel: 'Descripción opcional del específico CLAS.',
      noSelectionLabel: 'Sin específico CLAS',
      selectorLabel: 'Específico CLAS',
      selectorPlaceholder: 'Seleccionar específico CLAS',
      noneOptionLabel: 'Sin específico CLAS',
      countLabel: (count: number) => `${count} específicos CLAS`,
      formDescription: 'Crea un específico CLAS para clasificar productos según el nomenclador oficial.',
      createFormTitle: 'Nuevo Específico CLAS',
      submitLabel: 'Crear específico CLAS',
    }
  }

  // Modo estándar
  return {
    childTitle: 'subcategoría',
    childTitlePlural: 'subcategorías',
    createLabel: 'Nueva Subcategoría',
    editLabel: 'Editar Subcategoría',
    namePlaceholder: 'Ingrese el nombre de la subcategoría',
    nameDescription: 'Nombre visible de la subcategoría dentro de la categoría padre.',
    descriptionLabel: 'Descripción opcional para dar contexto adicional a la subcategoría.',
    noSelectionLabel: 'Sin subcategoría',
    selectorLabel: 'Subcategoría',
    selectorPlaceholder: 'Seleccionar subcategoría',
    noneOptionLabel: 'Sin subcategoría',
    countLabel: (count: number) => `${count} subcategorías`,
    formDescription: 'Crea una subcategoría jerárquica estándar para organizar tus productos.',
    createFormTitle: 'Nueva Subcategoría',
    submitLabel: 'Crear subcategoría',
  }
}
