"use client";

import * as React from "react";
import {
	AnimatePresence,
	LazyMotion,
	m as motion,
	useReducedMotion,
} from "framer-motion";
import {
	Activity,
	BarChart3,
	Lock,
	PieChart as PieChartIcon,
	Target,
	TrendingDown,
	TrendingUp,
	UserPlus,
	Users,
} from "lucide-react";
import {
	Area,
	AreaChart,
	Bar,
	BarChart,
	CartesianGrid,
	Cell,
	Legend,
	Line,
	LineChart,
	Pie,
	PieChart,
	ResponsiveContainer,
	Tooltip,
	XAxis,
	YAxis,
} from "recharts";

import {
	AdminCardsLoader,
	AdminReveal,
} from "@/features/admin/components/animations";
import { Badge } from "@/components/ui/badge";
import {
	Card,
	CardContent,
	CardDescription,
	CardHeader,
	CardTitle,
} from "@/components/ui/card";
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { getUserMetricsAction } from "@/features/admin/actions";

interface MonthlyData {
	year: number;
	month: string;
	yearMonth: string;
	usersCreated: number;
	activeUsersStart: number;
	activeUsersEnd: number;
	inactiveUsers: number;
	logins: number;
	logouts: number;
	blockedUsers: number;
	newUsersByRole: {
		admin: number;
		manager: number;
		economico: number;
		dependiente: number;
		regularUser: number;
	};
}

interface ChartRow extends MonthlyData {
	admin: number;
	manager: number;
	economico: number;
	dependiente: number;
	regularUser: number;
}

type MetricTab = "overview" | "growth" | "activity" | "roles";

const TOOLTIP_STYLE = {
	backgroundColor: "var(--card)",
	border: "1px solid var(--border)",
	borderRadius: "0.75rem",
};

const PIE_COLORS = ["var(--chart-primary-light)", "var(--chart-accent)", "var(--chart-neutral)"];

function monthTickFormatter(value: string): string {
	const [, month] = value.split("-");
	return month;
}

function calculateGrowth(current: number, previous: number): number {
	if (previous === 0) return current > 0 ? 100 : 0;
	return ((current - previous) / previous) * 100;
}

export function UserAnalyticsPanel(): React.JSX.Element {
	const shouldReduceMotion = useReducedMotion();
	const [months, setMonths] = React.useState("6");
	const [selectedTab, setSelectedTab] = React.useState<MetricTab>("overview");

	const [metrics, setMetrics] = React.useState<any>(null);
	const [isLoading, setIsLoading] = React.useState(true);
	const [error, setError] = React.useState<any>(null);

	React.useEffect(() => {
		let cancelled = false;
		setIsLoading(true);
		setError(null);
		getUserMetricsAction({ months: Number.parseInt(months, 10) })
			.then((r) => {
				if (!cancelled) {
					if (r.success) {
						setMetrics(r.data);
					} else {
						setError(new Error(r.error?.message ?? "Error al cargar métricas"));
					}
				}
			})
			.catch((err) => {
				if (!cancelled) setError(err);
			})
			.finally(() => {
				if (!cancelled) setIsLoading(false);
			});
		return () => {
			cancelled = true;
		};
	}, [months]);

	const chartData = React.useMemo<ChartRow[]>(() => {
		const rows = (metrics?.monthlyData || []) as MonthlyData[];
		return rows.map((row) => ({
			...row,
			admin: row.newUsersByRole?.admin || 0,
			manager: row.newUsersByRole?.manager || 0,
			economico: row.newUsersByRole?.economico || 0,
			dependiente: row.newUsersByRole?.dependiente || 0,
			regularUser: row.newUsersByRole?.regularUser || 0,
		}));
	}, [metrics]);

	const latest = chartData[chartData.length - 1];
	const previous = chartData[chartData.length - 2];

	const roleDistribution = React.useMemo(() => {
		if (!latest) return [];
		return [
			{ name: "Admin", value: latest.admin },
			{ name: "Manager", value: latest.manager },
			{ name: "Económico", value: latest.economico },
			{ name: "Usuario legado", value: latest.regularUser },
		];
	}, [latest]);

	const monthlyGrowth = React.useMemo(() => {
		return chartData.map((entry, index) => {
			if (index === 0) return { ...entry, growth: 0 };
			const prev = chartData[index - 1];
			return {
				...entry,
				growth: calculateGrowth(entry.usersCreated, prev.usersCreated),
			};
		});
	}, [chartData]);

	const userGrowth =
		previous && latest
			? calculateGrowth(latest.activeUsersEnd, previous.activeUsersEnd)
			: 0;
	const createdGrowth =
		previous && latest
			? calculateGrowth(latest.usersCreated, previous.usersCreated)
			: 0;
	const loginGrowth =
		previous && latest ? calculateGrowth(latest.logins, previous.logins) : 0;

	const activityRate =
		latest && latest.activeUsersEnd + latest.inactiveUsers > 0
			? Number(
					(
						(latest.activeUsersEnd /
							(latest.activeUsersEnd + latest.inactiveUsers)) *
						100
					).toFixed(1),
				)
			: 0;

	const renderHeader = (): React.JSX.Element => (
		<AdminReveal>
			<div className="flex flex-col gap-3 rounded-xl border bg-card p-4 shadow-sm md:flex-row md:items-center md:justify-between">
				<div className="flex items-center gap-3">
					<div className="relative flex h-10 w-10 items-center justify-center rounded-xl bg-linear-to-br from-primary to-purple shadow-md">
						<BarChart3 className="h-5 w-5 text-white" />
					</div>
					<div>
						<h3 className="bg-linear-to-r from-slate-900 to-slate-600 bg-clip-text text-lg font-semibold text-transparent dark:from-white dark:to-slate-300">
							Analytics de Usuarios
						</h3>
						<p className="text-sm text-muted-foreground">
							Métricas mensuales, tendencias y distribución de roles.
						</p>
					</div>
				</div>
				<Select value={months} onValueChange={setMonths}>
					<SelectTrigger className="w-full md:w-36">
						<SelectValue />
					</SelectTrigger>
					<SelectContent>
						<SelectItem value="3">3 meses</SelectItem>
						<SelectItem value="6">6 meses</SelectItem>
						<SelectItem value="12">12 meses</SelectItem>
						<SelectItem value="18">18 meses</SelectItem>
						<SelectItem value="24">24 meses</SelectItem>
					</SelectContent>
				</Select>
			</div>
		</AdminReveal>
	);

	const renderKPIs = (): React.JSX.Element => (
		<motion.div
			className="grid gap-4 md:grid-cols-2 lg:grid-cols-4"
			initial={shouldReduceMotion ? { opacity: 1 } : { opacity: 0, y: 10 }}
			animate={{ opacity: 1, y: 0 }}
			transition={{ duration: shouldReduceMotion ? 0 : 0.28 }}
		>
			{[
				{
					title: "Usuarios Totales",
					value: latest?.activeUsersEnd ?? 0,
					icon: Users,
					growth: userGrowth,
				},
				{
					title: "Nuevos Usuarios",
					value: latest?.usersCreated ?? 0,
					icon: UserPlus,
					growth: createdGrowth,
				},
				{
					title: "Tasa de Actividad",
					value: activityRate,
					icon: Activity,
					growth: null,
					suffix: "%",
					subtitle: "Usuarios activos del total",
				},
				{
					title: "Logins Totales",
					value: latest?.logins ?? 0,
					icon: Target,
					growth: loginGrowth,
				},
			].map((item, index) => {
				const Icon = item.icon;
				const hasGrowth = typeof item.growth === "number";
				const growthValue = hasGrowth ? item.growth : 0;
				const isPositive = growthValue >= 0;

				return (
					<motion.div
						key={item.title}
						initial={shouldReduceMotion ? false : { opacity: 0, y: 8 }}
						animate={{ opacity: 1, y: 0 }}
						transition={{
							duration: shouldReduceMotion ? 0 : 0.26,
							delay: index * 0.05,
						}}
					>
						<Card className="h-full border bg-card shadow-sm">
							<CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
								<CardTitle className="text-sm font-medium">
									{item.title}
								</CardTitle>
								<Icon className="h-4 w-4 text-muted-foreground" />
							</CardHeader>
							<CardContent>
								<div className="text-2xl font-bold">
									{item.value}
									{item.suffix || ""}
								</div>
								{hasGrowth ? (
									<p className="flex items-center text-xs text-muted-foreground">
										{isPositive ? (
											<TrendingUp className="mr-1 h-3 w-3 text-emerald-500" />
										) : (
											<TrendingDown className="mr-1 h-3 w-3 text-rose-500" />
										)}
										<span
											className={
												isPositive ? "text-emerald-600" : "text-rose-600"
											}
										>
											{Math.abs(growthValue).toFixed(1)}%
										</span>
										<span className="ml-1">vs mes anterior</span>
									</p>
								) : (
									<p className="text-xs text-muted-foreground">
										{item.subtitle}
									</p>
								)}
							</CardContent>
						</Card>
					</motion.div>
				);
			})}
		</motion.div>
	);

	const renderTabBar = (): React.JSX.Element => (
		<div className="flex gap-2 flex-wrap">
			{[
				{ value: "overview" as MetricTab, label: "Resumen" },
				{ value: "growth" as MetricTab, label: "Crecimiento" },
				{ value: "activity" as MetricTab, label: "Actividad" },
				{ value: "roles" as MetricTab, label: "Roles" },
			].map((tab) => (
				<button
					key={tab.value}
					onClick={() => setSelectedTab(tab.value)}
					className={`rounded-lg px-4 py-2 text-sm font-medium transition-all duration-200 ${
						selectedTab === tab.value
							? "bg-primary text-primary-foreground shadow-sm"
							: "bg-muted/40 text-muted-foreground hover:bg-muted/70"
					}`}
				>
					{tab.label}
				</button>
			))}
		</div>
	);

	const renderOverview = (): React.JSX.Element => (
		<div className="grid gap-4 md:grid-cols-2">
			<Card className="col-span-2 border bg-card shadow-sm">
				<CardHeader>
					<CardTitle className="flex items-center gap-2">
						<BarChart3 className="h-4 w-4 text-primary" />
						Evolución de Usuarios
					</CardTitle>
					<CardDescription>
						Creación y actividad de usuarios a lo largo del tiempo.
					</CardDescription>
				</CardHeader>
				<CardContent className="pt-6">
					<div className="h-[400px]">
						<ResponsiveContainer width="100%" height="100%">
							<AreaChart
								data={chartData}
								margin={{ top: 20, right: 24, left: 8, bottom: 10 }}
							>
								<defs>
									<linearGradient
										id="overview-active"
										x1="0"
										y1="0"
										x2="0"
										y2="1"
									>
										<stop offset="5%" stopColor="var(--chart-success-strong)" stopOpacity={0.8} />
										<stop offset="95%" stopColor="var(--chart-success-strong)" stopOpacity={0.1} />
									</linearGradient>
									<linearGradient
										id="overview-created"
										x1="0"
										y1="0"
										x2="0"
										y2="1"
									>
										<stop offset="5%" stopColor="var(--chart-primary-light)" stopOpacity={0.8} />
										<stop offset="95%" stopColor="var(--chart-primary-light)" stopOpacity={0.1} />
									</linearGradient>
								</defs>
								<CartesianGrid vertical={false} />
								<XAxis
									dataKey="yearMonth"
									tickLine={false}
									tickMargin={8}
									axisLine={false}
									tickFormatter={monthTickFormatter}
								/>
								<YAxis tickLine={false} axisLine={false} />
								<Legend verticalAlign="top" height={36} />
								<Tooltip contentStyle={TOOLTIP_STYLE} />
								<Area
									type="monotone"
									name="Activos"
									dataKey="activeUsersEnd"
									stroke="var(--chart-success-strong)"
									strokeWidth={2}
									fill="url(#overview-active)"
									fillOpacity={0.62}
									isAnimationActive={!shouldReduceMotion}
									animationDuration={620}
								/>
								<Area
									type="monotone"
									name="Creados"
									dataKey="usersCreated"
									stroke="var(--chart-primary-light)"
									strokeWidth={2}
									fill="url(#overview-created)"
									fillOpacity={0.62}
									isAnimationActive={!shouldReduceMotion}
									animationDuration={620}
								/>
							</AreaChart>
						</ResponsiveContainer>
					</div>
				</CardContent>
			</Card>

			<Card className="border bg-card shadow-sm">
				<CardHeader>
					<CardTitle className="flex items-center gap-2">
						<PieChartIcon className="h-4 w-4 text-primary" />
						Distribución de Roles
					</CardTitle>
					<CardDescription>
						Nuevos usuarios por rol en el último mes.
					</CardDescription>
				</CardHeader>
				<CardContent className="pt-6">
					<div className="h-[300px]">
						<ResponsiveContainer width="100%" height="100%">
							<PieChart>
								<Pie
									data={roleDistribution}
									cx="50%"
									cy="50%"
									outerRadius={84}
									labelLine={false}
									dataKey="value"
									label={({
										name,
										percent,
									}: {
										name: string;
										percent?: number;
									}) => `${name} ${((percent || 0) * 100).toFixed(0)}%`}
									isAnimationActive={!shouldReduceMotion}
									animationDuration={620}
								>
									{roleDistribution.map((entry, i) => (
										<Cell
											key={`cell-${entry.name}`}
											fill={PIE_COLORS[i % PIE_COLORS.length]}
										/>
									))}
								</Pie>
								<Tooltip
									formatter={(value: number) => `${value} usuarios`}
									contentStyle={TOOLTIP_STYLE}
								/>
							</PieChart>
						</ResponsiveContainer>
					</div>
				</CardContent>
			</Card>

			<Card className="border bg-card shadow-sm">
				<CardHeader>
					<CardTitle>Resumen de Actividad</CardTitle>
					<CardDescription>Métricas clave del último mes.</CardDescription>
				</CardHeader>
				<CardContent className="space-y-4">
					{latest ? (
						<div className="grid grid-cols-2 gap-3">
							<div className="rounded-lg border border-emerald-500/30 bg-emerald-500/10 p-3 text-center">
								<div className="text-2xl font-bold text-emerald-600">
									{latest.logins}
								</div>
								<div className="text-xs text-emerald-700">Logins</div>
							</div>
							<div className="rounded-lg border border-rose-500/30 bg-rose-500/10 p-3 text-center">
								<div className="text-2xl font-bold text-rose-600">
									{latest.logouts}
								</div>
								<div className="text-xs text-rose-700">Logouts</div>
							</div>
							<div className="rounded-lg border border-sky-500/30 bg-sky-500/10 p-3 text-center">
								<div className="text-2xl font-bold text-sky-600">
									{latest.activeUsersEnd}
								</div>
								<div className="text-xs text-sky-700">Activos</div>
							</div>
							<div className="rounded-lg border border-amber-500/30 bg-amber-500/10 p-3 text-center">
								<div className="text-2xl font-bold text-amber-600">
									{latest.inactiveUsers}
								</div>
								<div className="text-xs text-amber-700">Inactivos</div>
							</div>
						</div>
					) : (
						<p className="py-8 text-center text-muted-foreground">Sin datos</p>
					)}
				</CardContent>
			</Card>
		</div>
	);

	const renderGrowth = (): React.JSX.Element => (
		<Card className="border bg-card shadow-sm">
			<CardHeader>
				<CardTitle>Tasa de Crecimiento Mensual</CardTitle>
				<CardDescription>
					Porcentaje de crecimiento de nuevos usuarios.
				</CardDescription>
			</CardHeader>
			<CardContent className="pt-6">
				<div className="h-[400px]">
					<ResponsiveContainer width="100%" height="100%">
						<LineChart
							data={monthlyGrowth}
							margin={{ top: 20, right: 24, left: 8, bottom: 10 }}
						>
							<CartesianGrid vertical={false} strokeDasharray="4 4" />
							<XAxis
								dataKey="yearMonth"
								tickLine={false}
								tickMargin={8}
								axisLine={false}
								tickFormatter={monthTickFormatter}
							/>
							<YAxis
								tickLine={false}
								axisLine={false}
								tickFormatter={(v: number) => `${v}%`}
							/>
							<Tooltip
								formatter={(value: number) => `${value.toFixed(1)}%`}
								contentStyle={TOOLTIP_STYLE}
							/>
							<Line
								type="monotone"
								dataKey="growth"
								stroke="var(--chart-success-strong)"
								strokeWidth={2.4}
								dot={{ fill: "var(--chart-success-strong)", strokeWidth: 2 }}
								isAnimationActive={!shouldReduceMotion}
								animationDuration={640}
							/>
						</LineChart>
					</ResponsiveContainer>
				</div>
			</CardContent>
		</Card>
	);

	const renderActivity = (): React.JSX.Element => (
		<div className="grid gap-4 md:grid-cols-2">
			<Card className="border bg-card shadow-sm">
				<CardHeader>
					<CardTitle>Logins vs Logouts</CardTitle>
					<CardDescription>
						Actividad de inicio y cierre de sesión.
					</CardDescription>
				</CardHeader>
				<CardContent className="pt-6">
					<div className="h-[350px]">
						<ResponsiveContainer width="100%" height="100%">
							<AreaChart
								data={chartData}
								margin={{ top: 20, right: 24, left: 8, bottom: 10 }}
							>
								<defs>
									<linearGradient
										id="activity-login"
										x1="0"
										y1="0"
										x2="0"
										y2="1"
									>
										<stop offset="5%" stopColor="var(--chart-success-strong)" stopOpacity={0.72} />
										<stop offset="95%" stopColor="var(--chart-success-strong)" stopOpacity={0.08} />
									</linearGradient>
									<linearGradient
										id="activity-logout"
										x1="0"
										y1="0"
										x2="0"
										y2="1"
									>
										<stop offset="5%" stopColor="var(--chart-expense-light)" stopOpacity={0.72} />
										<stop offset="95%" stopColor="var(--chart-expense-light)" stopOpacity={0.08} />
									</linearGradient>
								</defs>
								<CartesianGrid vertical={false} strokeDasharray="4 4" />
								<XAxis
									dataKey="yearMonth"
									tickLine={false}
									tickMargin={8}
									axisLine={false}
									tickFormatter={monthTickFormatter}
								/>
								<YAxis tickLine={false} axisLine={false} />
								<Legend verticalAlign="top" height={36} />
								<Tooltip contentStyle={TOOLTIP_STYLE} />
								<Area
									type="monotone"
									name="Login"
									dataKey="logins"
									stroke="var(--chart-success-strong)"
									strokeWidth={2}
									fill="url(#activity-login)"
									fillOpacity={0.7}
									isAnimationActive={!shouldReduceMotion}
									animationDuration={650}
								/>
								<Area
									type="monotone"
									name="Logout"
									dataKey="logouts"
									stroke="var(--chart-expense-light)"
									strokeWidth={2}
									fill="url(#activity-logout)"
									fillOpacity={0.65}
									isAnimationActive={!shouldReduceMotion}
									animationDuration={650}
								/>
							</AreaChart>
						</ResponsiveContainer>
					</div>
				</CardContent>
			</Card>

			<Card className="border bg-card shadow-sm">
				<CardHeader>
					<CardTitle className="flex items-center gap-2">
						<Lock className="h-4 w-4 text-rose-500" />
						Usuarios Bloqueados
					</CardTitle>
					<CardDescription>
						Tendencia de bloqueos por seguridad.
					</CardDescription>
				</CardHeader>
				<CardContent className="pt-6">
					<div className="h-[350px]">
						<ResponsiveContainer width="100%" height="100%">
							<LineChart
								data={chartData}
								margin={{ top: 20, right: 24, left: 8, bottom: 10 }}
							>
								<CartesianGrid vertical={false} strokeDasharray="4 4" />
								<XAxis
									dataKey="yearMonth"
									tickLine={false}
									tickMargin={8}
									axisLine={false}
									tickFormatter={monthTickFormatter}
								/>
								<YAxis tickLine={false} axisLine={false} />
								<Tooltip
									formatter={(value: number) => `${value} bloqueados`}
									contentStyle={TOOLTIP_STYLE}
								/>
								<Line
									type="monotone"
									dataKey="blockedUsers"
									stroke="var(--chart-expense-light)"
									strokeWidth={2.4}
									dot={{ fill: "var(--chart-expense-light)", strokeWidth: 2 }}
									isAnimationActive={!shouldReduceMotion}
									animationDuration={640}
								/>
							</LineChart>
						</ResponsiveContainer>
					</div>
				</CardContent>
			</Card>

			<Card className="md:col-span-2 border bg-card shadow-sm">
				<CardHeader>
					<CardTitle>Usuarios Activos vs Inactivos</CardTitle>
					<CardDescription>
						Evolución de usuarios activos e inactivos por período.
					</CardDescription>
				</CardHeader>
				<CardContent className="pt-6">
					<div className="h-[350px]">
						<ResponsiveContainer width="100%" height="100%">
							<BarChart
								data={chartData}
								margin={{ top: 20, right: 24, left: 8, bottom: 10 }}
							>
								<defs>
									<linearGradient id="bar-active" x1="0" y1="0" x2="0" y2="1">
										<stop offset="5%" stopColor="var(--chart-success-strong)" stopOpacity={0.82} />
										<stop offset="95%" stopColor="var(--chart-success-strong)" stopOpacity={0.18} />
									</linearGradient>
									<linearGradient id="bar-inactive" x1="0" y1="0" x2="0" y2="1">
										<stop offset="5%" stopColor="var(--chart-neutral)" stopOpacity={0.82} />
										<stop offset="95%" stopColor="var(--chart-neutral)" stopOpacity={0.18} />
									</linearGradient>
								</defs>
								<CartesianGrid vertical={false} />
								<XAxis
									dataKey="yearMonth"
									tickLine={false}
									tickMargin={8}
									axisLine={false}
									tickFormatter={monthTickFormatter}
								/>
								<YAxis tickLine={false} axisLine={false} />
								<Legend verticalAlign="top" height={36} />
								<Tooltip
									formatter={(value: number) => `${value} usuarios`}
									contentStyle={TOOLTIP_STYLE}
								/>
								<Bar
									dataKey="activeUsersEnd"
									name="Activos"
									fill="url(#bar-active)"
									radius={[8, 8, 0, 0]}
									isAnimationActive={!shouldReduceMotion}
									animationDuration={620}
								/>
								<Bar
									dataKey="inactiveUsers"
									name="Inactivos"
									fill="url(#bar-inactive)"
									radius={[8, 8, 0, 0]}
									isAnimationActive={!shouldReduceMotion}
									animationDuration={620}
								/>
							</BarChart>
						</ResponsiveContainer>
					</div>
				</CardContent>
			</Card>
		</div>
	);

	const renderRoles = (): React.JSX.Element => (
		<Card className="border bg-card shadow-sm">
			<CardHeader>
				<div className="flex items-center justify-between gap-2">
					<div>
						<CardTitle>Evolución de Roles</CardTitle>
						<CardDescription>
							Creación de usuarios por rol a lo largo del tiempo.
						</CardDescription>
					</div>
					<Badge variant="outline" className="hidden sm:inline-flex">
						{chartData.length} periodos
					</Badge>
				</div>
			</CardHeader>
			<CardContent className="pt-6">
				<div className="h-[400px]">
					<ResponsiveContainer width="100%" height="100%">
						<BarChart
							data={chartData}
							margin={{ top: 20, right: 24, left: 8, bottom: 10 }}
						>
							<CartesianGrid vertical={false} />
							<XAxis
								dataKey="yearMonth"
								tickLine={false}
								tickMargin={8}
								axisLine={false}
								tickFormatter={monthTickFormatter}
							/>
							<YAxis tickLine={false} axisLine={false} />
							<Legend verticalAlign="top" height={36} />
							<Tooltip
								formatter={(value: number, name: string) =>
									`${value} ${name.toLowerCase()}`
								}
								contentStyle={TOOLTIP_STYLE}
							/>
							<Bar
								dataKey="admin"
								name="Admin"
								fill="var(--chart-primary-light)"
								radius={[8, 8, 0, 0]}
								isAnimationActive={!shouldReduceMotion}
								animationDuration={620}
							/>
							<Bar
								dataKey="regularUser"
								name="Usuario legado"
								fill="var(--chart-neutral)"
								radius={[8, 8, 0, 0]}
								isAnimationActive={!shouldReduceMotion}
								animationDuration={620}
							/>
						</BarChart>
					</ResponsiveContainer>
				</div>
			</CardContent>
		</Card>
	);

	if (isLoading) {
		return (
			<div className="space-y-6">
				{renderHeader()}
				<AdminCardsLoader cards={4} />
				<div className="grid gap-4 md:grid-cols-2">
					{Array.from({ length: 2 }).map((_, i) => (
						<Card key={i} className="border bg-card">
							<CardContent className="p-6">
								<Skeleton className="mb-4 h-5 w-52 animate-pulse-subtle" />
								<Skeleton className="h-[300px] w-full animate-pulse" />
							</CardContent>
						</Card>
					))}
				</div>
			</div>
		);
	}

	if (error) {
		return (
			<Card className="border bg-card">
				<CardContent className="flex flex-col items-center justify-center py-12 text-center">
					<p className="text-rose-600">
						Error al cargar los datos: {error.toString()}
					</p>
				</CardContent>
			</Card>
		);
	}

	if (!chartData.length) {
		return (
			<Card className="border bg-card">
				<CardContent className="flex flex-col items-center justify-center py-12 text-center">
					<p className="text-muted-foreground">
						No hay datos disponibles para el período seleccionado.
					</p>
				</CardContent>
			</Card>
		);
	}

	return (
		<div className="space-y-6">
			{renderHeader()}
			{renderKPIs()}
			{renderTabBar()}
			<AnimatePresence mode="wait">
				<motion.div
					key={selectedTab}
					initial={shouldReduceMotion ? { opacity: 1 } : { opacity: 0, y: 14 }}
					animate={{ opacity: 1, y: 0 }}
					exit={shouldReduceMotion ? { opacity: 1 } : { opacity: 0, y: -10 }}
					transition={{ duration: shouldReduceMotion ? 0 : 0.24 }}
					className="space-y-4"
				>
					{selectedTab === "overview" && renderOverview()}
					{selectedTab === "growth" && renderGrowth()}
					{selectedTab === "activity" && renderActivity()}
					{selectedTab === "roles" && renderRoles()}
				</motion.div>
			</AnimatePresence>
		</div>
	);
}
