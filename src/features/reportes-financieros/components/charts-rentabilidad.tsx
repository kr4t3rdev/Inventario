"use client";

import {
	Card,
	CardContent,
	CardDescription,
	CardHeader,
	CardTitle,
} from "@/components/ui/card";
import { cn } from "@/lib/utils";
import {
	BarChart,
	Bar,
	XAxis,
	YAxis,
	CartesianGrid,
	Tooltip,
	Legend,
	ResponsiveContainer,
	PieChart,
	Pie,
	Cell,
} from "recharts";
import type { ProductoAnalisis } from "@/features/reportes-financieros/actions-rentabilidad-compra";

const surfaceCardClass = cn(
	"relative overflow-hidden border-slate-200/60 bg-white/70 shadow-sm backdrop-blur-xl",
	"dark:border-slate-800/60 dark:bg-slate-900/10",
);

const COLORS = [
	"#10b981",
	"#f59e0b",
	"#3b82f6",
	"#8b5cf6",
	"#ef4444",
	"#06b6d4",
	"#f97316",
	"#6366f1",
];

interface ChartsRentabilidadProps {
	productos: ProductoAnalisis[];
}

/** Formatea nombre de producto para mostrar en eje */
function shortName(name: string, max = 18): string {
	return name.length > max ? `${name.slice(0, max)}...` : name;
}

/**
 * @description Gráficos de rentabilidad: Ingresos vs Costo, Ganancia, Días para vender.
 *
 * @param {ChartsRentabilidadProps} props - Productos del análisis.
 * @returns {JSX.Element} Grid de 3 charts + pie chart de distribución.
 */
export function ChartsRentabilidad({ productos }: ChartsRentabilidadProps) {
	const hasSales = productos.some((p) => p.unidadesVendidas > 0);

	// Data para Ingresos vs Costo
	const ingresosVsCostoData = productos.map((p) => ({
		name: shortName(p.productoNombre),
		Ingresos: p.ingresos,
		Costo: p.costoVendido,
	}));

	// Data para Ganancia
	const gananciaData = productos.map((p) => ({
		name: shortName(p.productoNombre),
		Ganancia: p.ganancia,
	}));

	// Data para Días para vender
	const diasData = productos
		.filter((p) => p.diasPromedioVenta !== null)
		.map((p) => ({
			name: shortName(p.productoNombre),
			días: p.diasPromedioVenta!,
		}));

	// Data para Pie (distribución de ingresos)
	const pieData = productos
		.filter((p) => p.ingresos > 0)
		.map((p, i) => ({
			name: shortName(p.productoNombre, 25),
			value: p.ingresos,
			fill: COLORS[i % COLORS.length],
		}));

	const formatterDollar = (value: number) => [
		`$${value.toLocaleString()}`,
		undefined,
	];

	return (
		<div className="grid gap-6 lg:grid-cols-2">
			{/* Ingresos vs Costo */}
			<Card className={surfaceCardClass}>
				<CardHeader>
					<CardTitle className="text-base">Ingresos vs Costo</CardTitle>
					<CardDescription>Comparación por producto</CardDescription>
				</CardHeader>
				<CardContent className="h-[280px]">
					{hasSales ? (
						<ResponsiveContainer width="100%" height="100%">
							<BarChart data={ingresosVsCostoData}>
								<CartesianGrid
									strokeDasharray="3 3"
									vertical={false}
									opacity={0.3}
								/>
								<XAxis dataKey="name" tick={{ fontSize: 11 }} />
								<YAxis tick={{ fontSize: 11 }} />
								<Tooltip formatter={formatterDollar} />
								<Legend />
								<Bar dataKey="Ingresos" fill="#10b981" radius={[4, 4, 0, 0]} />
								<Bar dataKey="Costo" fill="#f59e0b" radius={[4, 4, 0, 0]} />
							</BarChart>
						</ResponsiveContainer>
					) : (
						<div className="flex h-full items-center justify-center text-sm text-muted-foreground">
							Sin datos de ventas
						</div>
					)}
				</CardContent>
			</Card>

			{/* Ganancia por producto */}
			<Card className={surfaceCardClass}>
				<CardHeader>
					<CardTitle className="text-base">Ganancia por Producto</CardTitle>
					<CardDescription>Resultado neto por producto</CardDescription>
				</CardHeader>
				<CardContent className="h-[280px]">
					{hasSales ? (
						<ResponsiveContainer width="100%" height="100%">
							<BarChart data={gananciaData}>
								<CartesianGrid
									strokeDasharray="3 3"
									vertical={false}
									opacity={0.3}
								/>
								<XAxis dataKey="name" tick={{ fontSize: 11 }} />
								<YAxis tick={{ fontSize: 11 }} />
								<Tooltip formatter={formatterDollar} />
								<Bar
									dataKey="Ganancia"
									radius={[4, 4, 0, 0]}
									shape={(props: any) => {
										const { x, y, width, height, fill } = props;
										const isNegative =
											height < 0 || (props.payload?.Ganancia ?? 0) < 0;
										// Para valores negativos, Recharts dibuja desde y hacia arriba
										// Necesitamos calcular la altura absoluta
										const absHeight = Math.abs(height);
										const adjustedY = height > 0 ? y : y - absHeight;
										return (
											<rect
												x={x}
												y={adjustedY}
												width={width}
												height={absHeight}
												fill={isNegative ? "#ef4444" : "#10b981"}
												rx={4}
											/>
										);
									}}
								/>
							</BarChart>
						</ResponsiveContainer>
					) : (
						<div className="flex h-full items-center justify-center text-sm text-muted-foreground">
							Sin datos de ventas
						</div>
					)}
				</CardContent>
			</Card>

			{/* Días para vender */}
			<Card className={surfaceCardClass}>
				<CardHeader>
					<CardTitle className="text-base">Días para Vender</CardTitle>
					<CardDescription>
						Promedio de días entre compra y venta
					</CardDescription>
				</CardHeader>
				<CardContent className="h-[280px]">
					{diasData.length > 0 ? (
						<ResponsiveContainer width="100%" height="100%">
							<BarChart data={diasData} layout="vertical">
								<CartesianGrid
									strokeDasharray="3 3"
									horizontal={false}
									opacity={0.3}
								/>
								<XAxis type="number" tick={{ fontSize: 11 }} />
								<YAxis
									dataKey="name"
									type="category"
									tick={{ fontSize: 11 }}
									width={120}
								/>
								<Tooltip
									formatter={(value: number) => [
										`${value.toFixed(1)} días`,
										undefined,
									]}
								/>
								<Bar dataKey="días" fill="#3b82f6" radius={[0, 4, 4, 0]} />
							</BarChart>
						</ResponsiveContainer>
					) : (
						<div className="flex h-full items-center justify-center text-sm text-muted-foreground">
							Sin datos suficientes
						</div>
					)}
				</CardContent>
			</Card>

			{/* Distribución de Ingresos */}
			<Card className={surfaceCardClass}>
				<CardHeader>
					<CardTitle className="text-base">Distribución de Ingresos</CardTitle>
					<CardDescription>Participación por producto</CardDescription>
				</CardHeader>
				<CardContent className="h-[280px]">
					{pieData.length > 0 ? (
						<ResponsiveContainer width="100%" height="100%">
							<PieChart>
								<Pie
									data={pieData}
									cx="50%"
									cy="50%"
									labelLine={false}
									label={({ name, percent }) =>
										`${name} ${(percent * 100).toFixed(0)}%`
									}
									outerRadius={80}
									dataKey="value"
								>
									{pieData.map((entry, index) => (
										<Cell
											key={entry.name}
											fill={COLORS[index % COLORS.length]}
										/>
									))}
								</Pie>
								<Tooltip formatter={formatterDollar} />
							</PieChart>
						</ResponsiveContainer>
					) : (
						<div className="flex h-full items-center justify-center text-sm text-muted-foreground">
							Sin datos de ingresos
						</div>
					)}
				</CardContent>
			</Card>
		</div>
	);
}
