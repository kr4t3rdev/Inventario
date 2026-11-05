/** @description Valores de una variante asociados a sus atributos descriptivos. */
export type VarianteAtributos = Record<string, string>;

/** @description Producto vendible generado desde una plantilla de variantes. */
export interface VarianteCatalogo {
  id: string;
  nombre: string;
  sku: string | null;
  atributoJson: VarianteAtributos | null;
  precioCosto: number;
  precioVenta: number;
  stock: number;
  stockTotal: number;
  stockMinimo?: number;
  almacenId?: string;
  precios?: Array<{ listaPrecioId: string; precio: number }>;
}

/** @description Plantilla no vendible y sus variantes vendibles. */
export interface PlantillaVariantes {
  id: string;
  nombre: string;
  atributos: Array<{ nombre: string; valores: string[] }>;
  productos: VarianteCatalogo[];
}
