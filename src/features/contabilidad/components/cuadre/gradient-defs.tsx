/**
 * @description Gradientes SVG para gráficos del cuadre de período.
 * Usa los mismos IDs definidos en chart-theme.ts (GRADIENT_ID).
 */
import { cuadreChartPalette, GRADIENT_ID } from "./chart-theme";

export function GradientDefs() {
	return (
		<defs>
			<linearGradient
				id={GRADIENT_ID.income}
				x1="0"
				y1="0"
				x2="0"
				y2="1"
			>
				<stop offset="0%" stopColor={cuadreChartPalette.incomeLight} />
				<stop offset="100%" stopColor={cuadreChartPalette.income} />
			</linearGradient>
			<linearGradient
				id={GRADIENT_ID.expense}
				x1="0"
				y1="0"
				x2="0"
				y2="1"
			>
				<stop offset="0%" stopColor={cuadreChartPalette.expenseLight} />
				<stop offset="100%" stopColor={cuadreChartPalette.expense} />
			</linearGradient>
			{cuadreChartPalette.sequence.map((color, i) => (
				<linearGradient
					key={GRADIENT_ID.pie(i)}
					id={GRADIENT_ID.pie(i)}
					x1="0"
					y1="0"
					x2="1"
					y2="1"
				>
					<stop offset="0%" stopColor={color} stopOpacity={1} />
					<stop offset="100%" stopColor={color} stopOpacity={0.75} />
				</linearGradient>
			))}
		</defs>
	);
}
