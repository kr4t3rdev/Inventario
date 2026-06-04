"use client";

import {
	DollarSign,
	TrendingUp,
	Landmark,
	Percent,
	Package,
} from "lucide-react";

import {
	Card,
	CardContent,
	CardHeader,
	CardDescription,
} from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { AnimatedCard } from "@/components/ui/animations";
import type { ResumenAnalisis } from "@/features/reportes-financieros/actions-rentabilidad-compra";

const surfaceCardClass = cn(
	"relative overflow-hidden border-slate-200/60 bg-white/70 shadow-sm backdrop-blur-xl",
	"dark:border-slate-800/60 dark:bg-slate-900/10",
);

interface SummaryCardsProps {
	resumen: ResumenAnalisis;
}

/**
 * @description Grid de KPIs para el reporte de rentabilidad por compra.
 *
 * @param {SummaryCardsProps} props - Datos del resumen.
 * @returns {JSX.Element} Grid de 5 tarjetas con métricas.
 */
export function SummaryCards({ resumen }: SummaryCardsProps) {
	const cards = [
		{
			label: "Costo Total",
			value: `$${resumen.totalComprado.toLocaleString()}`,
			sublabel: "Total pagado en la compra",
			icon: DollarSign,
			borderColor: "border-l-primary",
		},
		{
			label: "Total Vendido",
			value: `$${resumen.totalVendido.toLocaleString()}`,
			sublabel: "Ingresos generados",
			icon: TrendingUp,
			borderColor: "border-l-chart-2",
		},
		{
			label: "Ganancia Neta",
			value: `$${resumen.gananciaTotal.toLocaleString()}`,
			sublabel: `Margen: ${resumen.margenPromedio.toFixed(1)}%`,
			icon: Landmark,
			borderColor:
				resumen.gananciaTotal >= 0
					? "border-l-chart-3"
					: "border-l-destructive",
			valueClass:
				resumen.gananciaTotal >= 0 ? "text-green-600" : "text-red-600",
		},
		{
			label: "ROI",
			value: `${resumen.roi.toFixed(1)}%`,
			sublabel: "Retorno sobre inversión",
			icon: Percent,
			borderColor: "border-l-accent",
		},
		{
			label: "Stock Remanente",
			value: `${resumen.stockRestante} / ${resumen.cantidadComprada} unids`,
			sublabel:
				resumen.cantidadComprada > 0
					? `${((resumen.stockRestante / resumen.cantidadComprada) * 100).toFixed(1)}% del lote`
					: "Sin stock",
			icon: Package,
			borderColor: "border-l-muted",
		},
	];

	return (
		<div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
			{cards.map((card) => (
				<AnimatedCard key={card.label}>
					<Card className={cn(surfaceCardClass, card.borderColor)}>
						<CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
							<CardDescription className="text-sm font-medium">
								{card.label}
							</CardDescription>
							<card.icon className="h-4 w-4 text-muted-foreground" />
						</CardHeader>
						<CardContent>
							<div className={cn("text-2xl font-bold", card.valueClass)}>
								{card.value}
							</div>
							<p className="text-xs text-muted-foreground">{card.sublabel}</p>
						</CardContent>
					</Card>
				</AnimatedCard>
			))}
		</div>
	);
}
