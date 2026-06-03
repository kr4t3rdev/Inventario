/**
 * @description Paleta de colores para gráficos del cuadre de período.
 */
export const cuadreChartPalette = {
	primary: "#2563eb",
	secondary: "#14b8a6",
	accent: "#f59e0b",
	alert: "#f43f5e",
	neutral: "#64748b",
};

export const chartTooltipStyle = {
	borderRadius: "10px",
	border: "1px solid hsl(var(--border))",
	backgroundColor: "hsl(var(--card))",
	color: "hsl(var(--card-foreground))",
	boxShadow: "0 10px 25px -10px rgb(0 0 0 / 0.25)",
	padding: "8px 10px",
	fontSize: "12px",
};

export const chartTooltipLabelStyle = {
	color: "hsl(var(--muted-foreground))",
	fontSize: "11px",
	fontWeight: 600,
};

export const chartTooltipItemStyle = {
	color: "hsl(var(--foreground))",
	fontSize: "12px",
	fontWeight: 600,
};

/**
 * @description Formatea un valor monetario con separador de miles y 2 decimales.
 * @param value - Valor numérico
 * @param moneda - Símbolo de moneda (CUP, USD, EUR, etc.)
 * @returns Valor formateado
 */
export function formatCurrency(value: number, moneda = "$"): string {
	return `${moneda} ${Math.abs(value).toLocaleString("es-CU", {
		minimumFractionDigits: 2,
		maximumFractionDigits: 2,
	})}`;
}

/**
 * @description Color para barras según tipo (ingreso/egreso)
 */
export function getBarColor(tipo: "ingreso" | "egreso"): string {
	return tipo === "ingreso"
		? cuadreChartPalette.secondary
		: cuadreChartPalette.alert;
}
