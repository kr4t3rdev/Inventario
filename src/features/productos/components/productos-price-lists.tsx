/**
 * @description Sección de precios por lista para el formulario de productos.
 * Muestra un input de precio por cada lista de precios configurada.
 *
 * @module features/productos/components/productos-price-lists
 */

"use client";

import { motion } from "framer-motion";
import CurrencyInput from "@/components/currency-input";

/**
 * @description Props para el componente ProductosPriceListsSection
 */
export interface ProductosPriceListsSectionProps {
	/** Listas de precios disponibles */
	listasPrecios: Array<{ id: string; nombre: string }>;
	/** Mapa de listaPrecioId → valor string (para edición) */
	preciosPorLista: Record<string, string>;
	/** Actualiza el precio de una lista específica */
	onPrecioChange: (listaId: string, value: string) => void;
	/** Precio base de venta (watch del form) */
	precioBase: number;
	/** Si el formulario está cargando */
	isLoading: boolean;
}

/**
 * @description Renderiza los inputs de precio por lista de precios.
 * Cada lista muestra un CurrencyInput con placeholder = precio base.
 *
 * @param {ProductosPriceListsSectionProps} props - Props del componente
 * @returns {JSX.Element | null} Sección de precios por lista o null si no hay listas
 */
export function ProductosPriceListsSection({
	listasPrecios,
	preciosPorLista,
	onPrecioChange,
	precioBase,
	isLoading,
}: ProductosPriceListsSectionProps) {
	if (!listasPrecios || listasPrecios.length === 0) return null;

	return (
		<motion.div
			className="space-y-3 rounded-xl border border-dashed p-4"
			initial={{ opacity: 0, y: 14 }}
			animate={{ opacity: 1, y: 0 }}
			transition={{ delay: 0.43 }}
		>
			<p className="text-sm font-semibold">Precios por lista</p>
			<p className="text-xs text-muted-foreground">
				Si dejas vacío un campo, el sistema usará el precio base de venta.
			</p>
			<div className="grid grid-cols-1 gap-3 md:grid-cols-2">
				{listasPrecios.map((lista) => (
					<div key={lista.id} className="space-y-1">
						<label className="text-xs text-muted-foreground">
							{lista.nombre}
						</label>
						<CurrencyInput
							value={preciosPorLista[lista.id] ?? ""}
							onChange={(newValue) => onPrecioChange(lista.id, newValue)}
							disabled={isLoading}
							placeholder={`Base: ${Number(precioBase || 0).toFixed(2)}`}
						/>
					</div>
				))}
			</div>
		</motion.div>
	);
}
