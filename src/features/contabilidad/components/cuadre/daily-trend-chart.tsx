/**
 * @description Gráfico de barras que muestra la tendencia diaria de ingresos y egresos.
 * Cada día del período muestra una barra apilada o agrupada de ingresos vs egresos.
 */
"use client";

import { useState } from "react";
import { motion } from "framer-motion";
import {
	BarChart,
	Bar,
	XAxis,
	YAxis,
	CartesianGrid,
	ResponsiveContainer,
	Tooltip,
	Legend,
} from "recharts";
import { TrendingUp as TrendingIcon } from "lucide-react";
import {
	chartTooltipStyle,
	chartTooltipLabelStyle,
	chartTooltipItemStyle,
	formatCurrency,
} from "./chart-theme";
import type { ResumenDiarioItem } from "../../cuadre-queries";

interface DailyTrendChartProps {
	data: ResumenDiarioItem[];
}

export function DailyTrendChart({ data }: DailyTrendChartProps) {
	const [activeBar, setActiveBar] = useState<string | null>(null);

	if (data.length === 0) return null;

	// Preparar datos: orden ascendente por fecha y limitar a últimos 31 días
	const chartData = [...data]
		.sort((a, b) => a.fecha.localeCompare(b.fecha))
		.slice(-31)
		.map((d) => ({
			name: d.fecha.slice(5), // "MM-DD"
			Ingresos: d.totalIngresos,
			Egresos: d.totalEgresos,
			Neto: d.neto,
			fullDate: d.fecha,
		}));

	return (
		<motion.div
			initial={{ opacity: 0, y: 16 }}
			animate={{ opacity: 1, y: 0 }}
			transition={{ duration: 0.4, ease: "easeOut", delay: 0.1 }}
			className="bg-card border rounded-lg p-4 h-full"
		>
			<div className="flex items-center gap-2 mb-3">
				<TrendingIcon className="h-4 w-4 text-muted-foreground" />
				<h3 className="text-sm font-semibold">Tendencia Diaria</h3>
				<span className="text-[10px] text-muted-foreground ml-auto">
					Ingresos vs Egresos por día
				</span>
			</div>
			<div className="h-[240px]">
				<ResponsiveContainer width="100%" height="100%">
					<BarChart
						data={chartData}
						onMouseMove={(e) => {
							if (e.activeLabel) setActiveBar(e.activeLabel);
						}}
						onMouseLeave={() => setActiveBar(null)}
					>
						<CartesianGrid
							strokeDasharray="3 3"
							vertical={false}
							stroke="hsl(var(--border))"
							opacity={0.3}
						/>
						<XAxis
							dataKey="name"
							axisLine={false}
							tickLine={false}
							tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }}
							interval="preserveStartEnd"
						/>
						<YAxis
							axisLine={false}
							tickLine={false}
							tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }}
							tickFormatter={(v: number) => `${(v / 1000).toFixed(0)}k`}
						/>
						<Tooltip
							contentStyle={chartTooltipStyle}
							labelStyle={chartTooltipLabelStyle}
							itemStyle={chartTooltipItemStyle}
							formatter={(value: number, name: string) => [
								formatCurrency(value, "$"),
								name === "Ingresos" ? "Ingresos" : "Egresos",
							]}
							labelFormatter={(label: string) => `Día ${label}`}
						/>
						<Legend
							iconSize={10}
							wrapperStyle={{ fontSize: "11px", paddingTop: "4px" }}
						/>
						<Bar
							dataKey="Ingresos"
							fill="#14b8a6"
							radius={[3, 3, 0, 0]}
							barSize={10}
							opacity={
								activeBar
									? (bar: any) => (bar?.name === activeBar ? 1 : 0.5)
									: 1
							}
							animationDuration={400}
							animationEasing="ease-out"
						/>
						<Bar
							dataKey="Egresos"
							fill="#f43f5e"
							radius={[3, 3, 0, 0]}
							barSize={10}
							opacity={
								activeBar
									? (bar: any) => (bar?.name === activeBar ? 1 : 0.5)
									: 1
							}
							animationDuration={400}
							animationEasing="ease-out"
						/>
					</BarChart>
				</ResponsiveContainer>
			</div>
		</motion.div>
	);
}
