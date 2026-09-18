/**
 * @description Tema de colores y utilidades para gráficos del cuadre de período.
 * Paleta profesional para dashboard financiero con alta accesibilidad (WCAG AA+).
 */

/* ─── Paleta principal ─── */

export const cuadreChartPalette = {
	primary: "var(--chart-primary)",
	primaryLight: "var(--chart-primary-light)",
	primaryDark: "var(--chart-primary-dark)",
	income: "var(--chart-income)",
	incomeLight: "var(--chart-income-light)",
	incomeBg: "var(--chart-income-bg)",
	expense: "var(--chart-expense)",
	expenseLight: "var(--chart-expense-light)",
	expenseBg: "var(--chart-expense-bg)",
	neutral: "var(--chart-neutral)",
	neutralLight: "var(--chart-neutral-light)",
	neutralBg: "var(--chart-neutral-bg)",
	accent: "var(--chart-accent)",
	sequence: [
		"var(--chart-primary)",
		"var(--chart-income)",
		"var(--chart-accent)",
		"var(--chart-expense)",
		"var(--chart-series-violet)",
		"var(--chart-series-cyan)",
		"var(--chart-series-lime)",
		"var(--chart-series-pink)",
		"var(--chart-series-orange)",
		"var(--chart-series-indigo)",
	],
};

/* ─── IDs de gradientes SVG (deprecated — se usan colores sólidos por compatibilidad con Recharts) ─── */

/* ─── Estilos de tooltip ─── */

export const chartTooltipStyle: Record<string, string | number> = {
	borderRadius: "10px",
	border: "1px solid hsl(var(--border))",
	backgroundColor: "hsl(var(--card))",
	color: "hsl(var(--card-foreground))",
	boxShadow: "0 10px 30px -10px rgb(0 0 0 / 0.3)",
	padding: "10px 14px",
	fontSize: "13px",
};

export const chartTooltipLabelStyle: Record<string, string | number> = {
	color: "hsl(var(--muted-foreground))",
	fontSize: "11px",
	fontWeight: 600,
	textTransform: "uppercase" as const,
	letterSpacing: "0.5px",
};

export const chartTooltipItemStyle: Record<string, string | number> = {
	color: "hsl(var(--foreground))",
	fontSize: "13px",
	fontWeight: 700,
};

/* ─── Formateo ─── */

export function formatCurrency(value: number, moneda = "$"): string {
	const sign = value < 0 ? "-" : "";
	return `${sign}${moneda} ${Math.abs(value).toLocaleString("es-CU", {
		minimumFractionDigits: 2,
		maximumFractionDigits: 2,
	})}`;
}
