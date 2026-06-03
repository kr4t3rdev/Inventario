/**
 * @description Gráfico de dona con gradientes que muestra la distribución del balance
 * por cuenta bancaria. Incluye total en el centro, colores por gradiente,
 * hover con realce y tooltip mejorado.
 */
"use client";

import { useState } from "react";
import { motion } from "framer-motion";
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
	cuadreChartPalette,
} from "./chart-theme";
import { GradientDefs } from "./gradient-defs";
import type { SaldoCuentaData } from "../../cuadre-queries";

interface BalancePieChartProps {
	saldosPorCuenta: SaldoCuentaData[];
}

const CUSTOMIZED_LEGEND = (props: any) => {
	const { payload } = props;
	return (
		<ul className="flex flex-wrap justify-center gap-x-4 gap-y-1 pt-2 text-xs">
			{payload.map((entry: any, index: number) => (
				<li key={`legend-${index}`} className="flex items-center gap-1.5">
					<span
						className="inline-block w-2.5 h-2.5 rounded-full"
						style={{ background: entry.color }}
					/>
					<span className="text-muted-foreground">{entry.value}</span>
				</li>
			))}
		</ul>
	);
};

function renderCustomizedLabel({
	cx,
	cy,
}: {
	cx: number;
	cy: number;
	totalSaldo: number;
}) {
	// Don't render — we use a positioned overlay instead
	return null;
}

export function BalancePieChart({ saldosPorCuenta }: BalancePieChartProps) {
	const [activeIndex, setActiveIndex] = useState<number | null>(null);

	if (saldosPorCuenta.length === 0) return null;

	const data = saldosPorCuenta
		.filter((c) => c.saldoActual !== 0)
		.map((c) => ({
			name: c.nombre,
			value: Math.abs(c.saldoActual),
			moneda: c.moneda,
			saldoActual: c.saldoActual,
		}))
		.sort((a, b) => b.value - a.value);

	if (data.length === 0) return null;

	const totalSaldo = data.reduce((s, d) => s + d.saldoActual, 0);
	const totalSign = totalSaldo >= 0 ? "" : "-";
	const totalAbs = Math.abs(totalSaldo);

	return (
		<motion.div
			initial={{ opacity: 0, y: 16 }}
			animate={{ opacity: 1, y: 0 }}
			transition={{ duration: 0.4, ease: "easeOut" }}
			className="bg-card border rounded-xl p-5 h-full shadow-sm"
		>
			<div className="flex items-center gap-2 mb-3">
				<div className="p-1.5 rounded-lg bg-primary/10">
					<PieChartIcon className="h-4 w-4 text-primary" />
				</div>
				<h3 className="text-sm font-semibold">
					Distribución del Balance
				</h3>
			</div>

			<div className="relative h-[260px]">
				<ResponsiveContainer width="100%" height="100%">
					<PieChart>
						<GradientDefs />
						<Pie
							data={data}
							cx="50%"
							cy="50%"
							innerRadius={58}
							outerRadius={98}
							paddingAngle={3}
							dataKey="value"
							strokeWidth={2}
							stroke="hsl(var(--background))"
							onMouseEnter={(_, index) => setActiveIndex(index)}
							onMouseLeave={() => setActiveIndex(null)}
							animationBegin={200}
							animationDuration={600}
							animationEasing="ease-out"
						>
							{data.map((_entry, index) => (
								<Cell
									key={`cell-${index}`}
									fill={`url(#${`pieGradient-${index}`})`}
									opacity={
										activeIndex === null || activeIndex === index ? 1 : 0.4
									}
									stroke={
										activeIndex === index
											? "hsl(var(--foreground))"
											: "hsl(var(--background))"
									}
									strokeWidth={activeIndex === index ? 2.5 : 2}
									style={{ cursor: "pointer" }}
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
								"Saldo",
							]}
						/>
						<Legend content={CUSTOMIZED_LEGEND} />
					</PieChart>
				</ResponsiveContainer>

				{/* Total en el centro de la dona */}
				<div className="absolute inset-0 flex items-center justify-center pointer-events-none">
					<div className="text-center">
						<p className="text-[10px] text-muted-foreground uppercase tracking-wider">
							Total
						</p>
						<p className="text-base font-bold">
							{totalSign}${" "}
							{totalAbs.toLocaleString("es-CU", {
								minimumFractionDigits: 2,
								maximumFractionDigits: 2,
							})}
						</p>
					</div>
				</div>
			</div>
		</motion.div>
	);
}
