/**
 * @description Gráfico de barras con gradientes que muestra la tendencia diaria
 * de ingresos vs egresos del período. Incluye hover interactivo, tooltip
 * detallado y máx 31 días.
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
	ReferenceLine,
} from "recharts";
import { TrendingUp as TrendingIcon } from "lucide-react";
import {
	chartTooltipStyle,
	chartTooltipLabelStyle,
	chartTooltipItemStyle,
	formatCurrency,
	cuadreChartPalette,
	GRADIENT_ID,
} from "./chart-theme";
import { GradientDefs } from "./gradient-defs";
import type { ResumenDiarioItem } from "../../cuadre-queries";

interface DailyTrendChartProps {
	data: ResumenDiarioItem[];
}

const CustomLegend = (props: any) => {
	const { payload } = props;
	return (
		<div className="flex justify-center gap-6 pt-1 text-xs">
			{payload?.map((entry: any, index: number) => (
				<div key={`legend-${index}`} className="flex items-center gap-1.5">
					<span
						className="inline-block w-3 h-3 rounded"
						style={{
							background: entry.color,
						}}
					/>
					<span className="text-muted-foreground">{entry.value}</span>
				</div>
			))}
		</div>
	);
};

export function DailyTrendChart({ data }: DailyTrendChartProps) {
	const [activeBar, setActiveBar] = useState<string | null>(null);

	if (data.length === 0) return null;

	const chartData = [...data]
		.sort((a, b) => a.fecha.localeCompare(b.fecha))
		.slice(-31)
		.map((d) => ({
			name: d.fecha.slice(5),
			ingresos: d.totalIngresos,
			egresos: d.totalEgresos,
			neto: d.neto,
			label: d.fecha,
		}));

	return (
		<motion.div
			initial={{ opacity: 0, y: 16 }}
			animate={{ opacity: 1, y: 0 }}
			transition={{ duration: 0.4, ease: "easeOut", delay: 0.1 }}
			className="bg-card border rounded-xl p-5 h-full shadow-sm"
		>
			<div className="flex items-center gap-2 mb-3">
				<div className="p-1.5 rounded-lg bg-emerald-50">
					<TrendingIcon className="h-4 w-4 text-emerald-600" />
				</div>
				<div>
					<h3 className="text-sm font-semibold">Tendencia Diaria</h3>
				</div>
				<span className="text-[10px] text-muted-foreground ml-auto">
					{chartData.length} días
				</span>
			</div>

			<div className="h-[260px]">
				<ResponsiveContainer width="100%" height="100%">
					<BarChart
						data={chartData}
						barGap={2}
						barCategoryGap="20%"
						onMouseMove={(e) => {
							if (e.activeLabel) setActiveBar(e.activeLabel);
						}}
						onMouseLeave={() => setActiveBar(null)}
					>
						<GradientDefs />
						<CartesianGrid
							strokeDasharray="3 3"
							vertical={false}
							stroke="hsl(var(--border))"
							opacity={0.25}
						/>
						<ReferenceLine
							y={0}
							stroke="hsl(var(--border))"
							strokeDasharray="4 4"
						/>
						<XAxis
							dataKey="name"
							axisLine={false}
							tickLine={false}
							tick={{
								fontSize: 10,
								fill: "hsl(var(--muted-foreground))",
							}}
							interval="preserveStartEnd"
						/>
						<YAxis
							axisLine={false}
							tickLine={false}
							tick={{
								fontSize: 10,
								fill: "hsl(var(--muted-foreground))",
							}}
							tickFormatter={(v: number) =>
								`$${(v / 1000).toFixed(0)}k`
							}
						/>
						<Tooltip
							contentStyle={chartTooltipStyle}
							labelStyle={chartTooltipLabelStyle}
							itemStyle={chartTooltipItemStyle}
							formatter={(value: number, name: string) => [
								formatCurrency(value, "$"),
								name === "ingresos" ? "Ingresos" : "Egresos",
							]}
							labelFormatter={(label: string, payload: any[]) => {
								const full = payload?.[0]?.payload?.label;
								return full ? `${full}` : label;
							}}
						/>
						<Legend content={CustomLegend} />
						<Bar
							dataKey="ingresos"
							fill={`url(#${GRADIENT_ID.income})`}
							radius={[4, 4, 0, 0]}
							barSize={12}
							opacity={
								activeBar
									? (d: any) => (d?.name === activeBar ? 1 : 0.5)
									: 1
							}
							animationDuration={500}
							animationEasing="ease-out"
							animationBegin={300}
						/>
						<Bar
							dataKey="egresos"
							fill={`url(#${GRADIENT_ID.expense})`}
							radius={[4, 4, 0, 0]}
							barSize={12}
							opacity={
								activeBar
									? (d: any) => (d?.name === activeBar ? 1 : 0.5)
									: 1
							}
							animationDuration={500}
							animationEasing="ease-out"
							animationBegin={400}
						/>
					</BarChart>
				</ResponsiveContainer>
			</div>
		</motion.div>
	);
}
