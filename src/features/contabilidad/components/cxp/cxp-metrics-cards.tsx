"use client";

import { TrendingUp, TrendingDown, DollarSign, CreditCard } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { AnimatedNumber } from "@/components/ui/animated-number";
import { cn } from "@/lib/utils";

const surfaceCardClass = cn(
	"relative overflow-hidden border-slate-200/60 bg-white/70 shadow-sm backdrop-blur-xl",
	"dark:border-slate-800/60 dark:bg-slate-950/15",
);

interface CxpMetricas {
	totalFacturado: number;
	totalPagado: number;
	totalSaldo: number;
	totalCuentas: number;
	cuentasPendientes: number;
	cuentasPagadas: number;
	porcentajePagado: number;
}

interface CxpMetricsCardsProps {
	metricas: CxpMetricas;
}

/**
 * @description Tarjetas de métricas del módulo de cuentas por pagar.
 * @param {CxpMetricsCardsProps} props - Métricas agregadas del servidor.
 * @returns {JSX.Element} Grid de cuatro tarjetas (facturado, pagado, pendiente, estado).
 */
export function CxpMetricsCards({ metricas }: CxpMetricsCardsProps) {
	return (
		<div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
			<Card className={cn(surfaceCardClass, "hover:shadow-md transition-shadow")}>
				<CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
					<CardTitle className="text-sm font-medium text-muted-foreground">
						Total Facturado
					</CardTitle>
					<DollarSign className="h-4 w-4 text-blue-500" />
				</CardHeader>
				<CardContent>
					<div className="text-2xl font-bold text-foreground tabular-nums">
						<AnimatedNumber value={metricas.totalFacturado} currency="$" />
					</div>
					<p className="text-xs text-muted-foreground mt-1">
						{metricas.totalCuentas} facturas de proveedores
					</p>
				</CardContent>
			</Card>

			<Card className={cn(surfaceCardClass, "hover:shadow-md transition-shadow")}>
				<CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
					<CardTitle className="text-sm font-medium text-muted-foreground">
						Total Pagado
					</CardTitle>
					<TrendingUp className="h-4 w-4 text-green-500" />
				</CardHeader>
				<CardContent>
					<div className="text-2xl font-bold text-foreground tabular-nums">
						<AnimatedNumber value={metricas.totalPagado} currency="$" />
					</div>
					<p className="text-xs text-green-600 mt-1 font-medium">
						{metricas.porcentajePagado.toFixed(1)}% pagado
					</p>
				</CardContent>
			</Card>

			<Card className={cn(surfaceCardClass, "hover:shadow-md transition-shadow")}>
				<CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
					<CardTitle className="text-sm font-medium text-muted-foreground">
						Saldo Pendiente
					</CardTitle>
					<TrendingDown className="h-4 w-4 text-red-500" />
				</CardHeader>
				<CardContent>
					<div className="text-2xl font-bold text-red-600 tabular-nums">
						<AnimatedNumber value={metricas.totalSaldo} currency="$" />
					</div>
					<p className="text-xs text-muted-foreground mt-1">
						{metricas.cuentasPendientes} cuentas pendientes
					</p>
				</CardContent>
			</Card>

			<Card className={cn(surfaceCardClass, "hover:shadow-md transition-shadow")}>
				<CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
					<CardTitle className="text-sm font-medium text-muted-foreground">
						Estado General
					</CardTitle>
					<CreditCard className="h-4 w-4 text-amber-500" />
				</CardHeader>
				<CardContent>
					<div className="text-2xl font-bold text-foreground tabular-nums">
						{metricas.cuentasPagadas}
						<span className="text-sm font-normal text-muted-foreground">
							{" "}
							/ {metricas.totalCuentas}
						</span>
					</div>
					<p className="text-xs text-muted-foreground mt-1">
						facturas pagadas
					</p>
				</CardContent>
			</Card>
		</div>
	);
}

export type { CxpMetricas };