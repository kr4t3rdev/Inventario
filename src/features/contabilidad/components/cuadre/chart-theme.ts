/**
 * @description Tema de colores y utilidades para gráficos del cuadre de período.
 * Paleta profesional para dashboard financiero con alta accesibilidad (WCAG AA+).
 */

/* ─── Paleta principal ─── */

export const cuadreChartPalette = {
	primary: "#2563eb",
	primaryLight: "#3b82f6",
	primaryDark: "#1d4ed8",
	income: "#059669",
	incomeLight: "#10b981",
	incomeBg: "#ecfdf5",
	expense: "#dc2626",
	expenseLight: "#ef4444",
	expenseBg: "#fef2f2",
	neutral: "#64748b",
	neutralLight: "#94a3b8",
	neutralBg: "#f1f5f9",
	accent: "#f59e0b",
	sequence: [
		"#2563eb",
		"#059669",
		"#f59e0b",
		"#dc2626",
		"#8b5cf6",
		"#06b6d4",
		"#84cc16",
		"#ec4899",
		"#f97316",
		"#6366f1",
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
