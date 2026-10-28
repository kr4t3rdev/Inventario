import { format } from "date-fns";
import type { Locale } from "date-fns";

/**
 * @description Formats an ISO date as a civil day, independent of the local timezone.
 * @param {string | Date} value - Date value whose calendar day must be displayed.
 * @param {string} pattern - date-fns formatting pattern.
 * @param {Locale} [locale] - Optional date-fns locale.
 * @returns {string} Formatted civil date.
 */
export function formatCivilDate(
	value: string | Date,
	pattern: string,
	locale?: Locale,
): string {
	const isoValue = value instanceof Date ? value.toISOString() : value;
	const match = /^(\d{4})-(\d{2})-(\d{2})/.exec(isoValue);
	const date = match
		? new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]))
		: new Date(isoValue);

	return format(date, pattern, locale ? { locale } : undefined);
}
