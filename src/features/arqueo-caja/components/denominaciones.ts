/**
 * @description Tabla de denominaciones de billetes para CUP y USD.
 * Cada entrada tiene clave, etiqueta, valor facial en centavos, y moneda.
 */

export interface Denominacion {
	key: string;
	label: string;
	valor: number; // en centavos
	moneda: "CUP" | "USD";
}

export const DENOMINACIONES_CUP: Denominacion[] = [
	{ key: "billetes1000Cup", label: "$1000", valor: 100000, moneda: "CUP" },
	{ key: "billetes500Cup", label: "$500", valor: 50000, moneda: "CUP" },
	{ key: "billetes200Cup", label: "$200", valor: 20000, moneda: "CUP" },
	{ key: "billetes100Cup", label: "$100", valor: 10000, moneda: "CUP" },
	{ key: "billetes50Cup", label: "$50", valor: 5000, moneda: "CUP" },
	{ key: "billetes20Cup", label: "$20", valor: 2000, moneda: "CUP" },
	{ key: "billetes10Cup", label: "$10", valor: 1000, moneda: "CUP" },
	{ key: "billetes5Cup", label: "$5", valor: 500, moneda: "CUP" },
	{ key: "billetes1Cup", label: "$1", valor: 100, moneda: "CUP" },
	{ key: "monedasCup", label: "Monedas", valor: 1, moneda: "CUP" },
];

export const DENOMINACIONES_USD: Denominacion[] = [
	{ key: "billetes100Usd", label: "$100 USD", valor: 10000, moneda: "USD" },
	{ key: "billetes50Usd", label: "$50 USD", valor: 5000, moneda: "USD" },
	{ key: "billetes20Usd", label: "$20 USD", valor: 2000, moneda: "USD" },
	{ key: "billetes10Usd", label: "$10 USD", valor: 1000, moneda: "USD" },
	{ key: "billetes5Usd", label: "$5 USD", valor: 500, moneda: "USD" },
	{ key: "billetes1Usd", label: "$1 USD", valor: 100, moneda: "USD" },
	{ key: "monedasUsd", label: "Monedas USD", valor: 1, moneda: "USD" },
];
