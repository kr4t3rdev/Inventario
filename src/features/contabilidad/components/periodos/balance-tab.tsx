/**
 * @description Tab de balance del cuadre de período.
 * Muestra saldos por cuenta bancaria con variación vs inicio del período
 * y totales agrupados por moneda. Animaciones Framer Motion.
 */
"use client";

import { motion } from "framer-motion";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Banknote, TrendingUp, TrendingDown, Minus } from "lucide-react";
import {
	staggerContainer,
	cardSlideFromRight,
	fadeUp,
	cardHover,
	slideFromRight,
	listItem,
} from "../cuadre/animations";
import type { SaldoCuentaData, TotalesMoneda } from "../../cuadre-queries";

interface BalanceTabProps {
	saldosPorCuenta: SaldoCuentaData[];
	totalesPorMoneda: TotalesMoneda[];
}

function formatMoneda(monto: number, moneda: string): string {
	return `${moneda} ${Math.abs(monto).toLocaleString("es-CU", {
		minimumFractionDigits: 2,
		maximumFractionDigits: 2,
	})}`;
}

function VariacionBadge({ variacion }: { variacion: number }) {
	if (variacion > 0) {
		return (
			<Badge
				variant="outline"
				className="bg-green-50 text-green-700 border-green-200"
			>
				<TrendingUp className="h-3 w-3 mr-1" />+{formatMoneda(variacion)}
			</Badge>
		);
	}
	if (variacion < 0) {
		return (
			<Badge
				variant="outline"
				className="bg-red-50 text-red-700 border-red-200"
			>
				<TrendingDown className="h-3 w-3 mr-1" />
				{formatMoneda(variacion)}
			</Badge>
		);
	}
	return (
		<Badge
			variant="outline"
			className="bg-gray-50 text-gray-500 border-gray-200"
		>
			<Minus className="h-3 w-3 mr-1" />
			Sin cambios
		</Badge>
	);
}

export function BalanceTab({
	saldosPorCuenta,
	totalesPorMoneda,
}: BalanceTabProps) {
	if (saldosPorCuenta.length === 0) {
		return (
			<motion.div
				variants={fadeUp}
				initial="hidden"
				animate="visible"
				className="flex flex-col items-center justify-center py-12 text-muted-foreground"
			>
				<Banknote className="h-12 w-12 mb-3 opacity-20" />
				<p>No hay cuentas bancarias activas en este período.</p>
			</motion.div>
		);
	}

	return (
		<motion.div
			variants={staggerContainer}
			initial="hidden"
			animate="visible"
			className="space-y-6"
		>
			{/* Totales por moneda */}
			<motion.div
				variants={staggerContainer}
				className="grid gap-4 md:grid-cols-3"
			>
				{totalesPorMoneda.map((t, i) => (
					<motion.div
						key={t.moneda}
						variants={cardSlideFromRight}
						custom={i}
						{...cardHover}
					>
						<Card>
							<CardHeader className="pb-2">
								<CardTitle className="text-sm font-medium text-muted-foreground">
									Balance {t.moneda}
								</CardTitle>
							</CardHeader>
							<CardContent>
								<div className="text-2xl font-bold">
									{formatMoneda(t.saldoNeto, t.moneda)}
								</div>
								<div className="flex gap-4 mt-1 text-xs text-muted-foreground">
									<span className="text-green-600">
										Ingresos: {formatMoneda(t.totalIngresos)}
									</span>
									<span className="text-red-600">
										Egresos: {formatMoneda(t.totalEgresos)}
									</span>
								</div>
							</CardContent>
						</Card>
					</motion.div>
				))}
			</motion.div>

			{/* Detalle por cuenta */}
			<motion.div variants={fadeUp}>
				<Card>
					<CardHeader>
						<CardTitle className="text-base">Cuentas Bancarias</CardTitle>
					</CardHeader>
					<CardContent className="p-0">
						<motion.div variants={staggerContainer} className="divide-y">
							{saldosPorCuenta.map((c) => (
								<motion.div
									key={c.cuentaId}
									variants={slideFromRight}
									className="flex items-center justify-between px-6 py-4 hover:bg-muted/30 transition-colors"
								>
									<div className="flex items-center gap-3">
										<div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
											<Banknote className="h-5 w-5 text-primary" />
										</div>
										<div>
											<p className="font-medium text-sm">{c.nombre}</p>
											<div className="flex items-center gap-2 mt-0.5">
												<Badge variant="secondary" className="text-xs">
													{c.moneda}
												</Badge>
												<span className="text-xs text-muted-foreground">
													Inicio: {formatMoneda(c.saldoInicioPeriodo, c.moneda)}
												</span>
											</div>
										</div>
									</div>
									<div className="text-right">
										<div className="text-lg font-semibold">
											{formatMoneda(c.saldoActual, c.moneda)}
										</div>
										<div className="mt-1">
											<VariacionBadge variacion={c.variacion} />
										</div>
									</div>
								</motion.div>
							))}
						</motion.div>
					</CardContent>
				</Card>
			</motion.div>
		</motion.div>
	);
}
