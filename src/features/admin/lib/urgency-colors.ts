/**
 * @description Devuelve las clases de Tailwind para badges de urgencia/estado.
 * Unifica convención: rojo=urgente, amarillo=atención, verde=ok.
 * @param {number} days - Cantidad de días (o minutos escalados)
 * @returns {string} Clases de Tailwind para Badge variant="outline"
 */
export function getUrgencyColor(days: number): string {
	if (days <= 3) return "border-rose-500/50 bg-rose-500/10 text-rose-700"
	if (days <= 7) return "border-amber-500/50 bg-amber-500/10 text-amber-700"
	return "border-emerald-500/50 bg-emerald-500/10 text-emerald-700"
}
