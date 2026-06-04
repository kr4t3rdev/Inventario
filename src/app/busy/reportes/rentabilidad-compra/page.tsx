import type { Metadata } from "next";
import { ReporteRentabilidadCompra } from "@/features/reportes-financieros/components/reporte-rentabilidad-compra";

export const metadata: Metadata = {
	title: "Rentabilidad por Compra",
	description:
		"Analice la rentabilidad de sus compras con asignación FIFO: ingresos, costos, márgenes y días para vender.",
};

/**
 * @description Página de reporte de rentabilidad por compra.
 *
 * @returns {JSX.Element} Componente orquestador del reporte.
 */
export default function RentabilidadCompraPage() {
	return <ReporteRentabilidadCompra />;
}
