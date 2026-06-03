/**
 * @description Gráfico de torta que muestra la distribución del balance por cuenta bancaria.
 * Agrupa cuentas por moneda y muestra la proporción de cada cuenta.
 */
"use client";

import { useState } from "react";
import {
	PieChart,
	Pie,
	Cell,
	ResponsiveContainer,
	Tooltip,
	Legend,
} from "recharts";
import { PieChart as PieChartIcon } from "lucide-react";
import {
	chartTooltipStyle,
	chartTooltipLabelStyle,
	chartTooltipItemStyle,
	formatCurrency,
} from "./chart-theme";
import type { SaldoCuentaData } from "../../cuadre-queries";

interface BalancePieChartProps {
	saldosPorCuenta: SaldoCuentaData[];
}

const COLORS = [
	"#2563eb",
	"#14b8a6",
	"#f59e0b",
	"#f43f5e",
	"#8b5cf6",
	"#06b6d4",
	"#84cc16",
	"#ec4899",
];

export function BalancePieChart({ saldosPorCuenta }: BalancePieChartProps) {
	const [activeIndex, setActiveIndex] = useState<number | null>(null);

	if (saldosPorCuenta.length === 0) return null;

	// Agrupar por moneda y preparar datos
	const data = saldosPorCuenta
		.filter((c) => c.saldoActual !== 0)
		.map((c) => ({
			name: c.nombre,
			value: Math.abs(c.saldoActual),
			moneda: c.moneda,
			saldoActual: c.saldoActual,
			label: `${c.nombre} (${c.moneda})`,
		}))
		.sort((a, b) => b.value - a.value);

	if (data.length === 0) return null;

	return (
		<div className="bg-card border rounded-lg p-4 h-full">
			<div className="flex items-center gap-2 mb-3">
				<PieChartIcon className="h-4 w-4 text-muted-foreground" />
				<h3 className="text-sm font-semibold">
					Distribución del Balance por Cuenta
				</h3>
			</div>
			<div className="h-[240px]">
				<ResponsiveContainer width="100%" height="100%">
					<PieChart>
						<Pie
							data={data}
							cx="50%"
							cy="50%"
							innerRadius={55}
							outerRadius={95}
							paddingAngle={2}
							dataKey="value"
							onMouseEnter={(_, index) => setActiveIndex(index)}
							onMouseLeave={() => setActiveIndex(null)}
							animationDuration={400}
							animationEasing="ease-out"
						>
							{data.map((entry, index) => (
								<Cell
									key={`cell-${index}`}
									fill={COLORS[index % COLORS.length]}
									opacity={
										activeIndex === null || activeIndex === index ? 1 : 0.5
									}
									stroke={
										activeIndex === index ? "hsl(var(--foreground))" : "none"
									}
									strokeWidth={activeIndex === index ? 2 : 0}
								/>
							))}
						</Pie>
						<Tooltip
							contentStyle={chartTooltipStyle}
							labelStyle={chartTooltipLabelStyle}
							itemStyle={chartTooltipItemStyle}
							formatter={(
								value: number,
								_name: string,
								props: { payload: { saldoActual: number; moneda: string } },
							) => [
								formatCurrency(value, props.payload.moneda),
								props.payload.name,
							]}
						/>
						<Legend
							formatter={(value: string) => (
								<span className="text-xs text-muted-foreground">{value}</span>
							)}
							iconSize={10}
							wrapperStyle={{ fontSize: "11px", paddingTop: "8px" }}
						/>
					</PieChart>
				</ResponsiveContainer>
			</div>
		</div>
	);
}
