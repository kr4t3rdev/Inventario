/**
 * @description Selector de productos con búsqueda, scroll virtual y estados de stock.
 * Extraído de transferencias-form.tsx para reducir su tamaño.
 *
 * @module features/transferencias/components/producto-selector
 */

"use client";

import { useState, useEffect, useRef } from "react";
import { Search, X, Check, AlertTriangle } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
	Popover,
	PopoverContent,
	PopoverTrigger,
} from "@/components/ui/popover";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
	Tooltip,
	TooltipContent,
	TooltipProvider,
	TooltipTrigger,
} from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";

/**
 * @description Props del selector de productos.
 */
export interface ProductoSelectorProps {
	value: string;
	onChange: (v: string) => void;
	productos: Array<any>;
	disabled?: boolean;
	triggerId?: string;
	showOutOfStock?: boolean;
	minStockThreshold?: number;
}

/**
 * @description Selector de productos con búsqueda tipo combobox.
 * Muestra nombre, stock y precio de costo. Resalta coincidencias de búsqueda.
 * Soporta navegación por teclado (ArrowUp/Down/Enter/Escape).
 *
 * @param {ProductoSelectorProps} props - Props del componente
 * @returns {JSX.Element} Popover de selección de productos
 */
export function ProductoSelector({
	value,
	onChange,
	productos,
	disabled,
	triggerId,
	showOutOfStock = false,
	minStockThreshold = 10,
}: ProductoSelectorProps) {
	const [open, setOpen] = useState(false);
	const [query, setQuery] = useState("");
	const [highlighted, setHighlighted] = useState(0);
	const itemRefs = useRef<(HTMLButtonElement | null)[]>([]);

	const selected = productos?.find((p) => p.id === value);

	const filteredProducts = (productos || []).filter((p) => {
		const stock = p.stockUbicacion ?? p.stock ?? 0;
		const matchesQuery = query
			? p.nombre.toLowerCase().includes(query.toLowerCase())
			: true;

		if (p.id === value) return true;
		if (p.productoPadreId) return false;
		if (!showOutOfStock && stock <= 0) return false;
		return matchesQuery;
	});

	useEffect(() => {
		setHighlighted(0);
	}, [query]);

	useEffect(() => {
		itemRefs.current = [];
	}, [filteredProducts.length]);

	useEffect(() => {
		const highlightedElement = itemRefs.current[highlighted];
		if (highlightedElement) {
			highlightedElement.scrollIntoView({
				behavior: "smooth",
				block: "nearest",
			});
		}
	}, [highlighted]);

	const renderHighlighted = (text: string) => {
		if (!query) return text;
		const lower = text.toLowerCase();
		const q = query.toLowerCase();
		const idx = lower.indexOf(q);
		if (idx === -1) return text;
		const before = text.slice(0, idx);
		const match = text.slice(idx, idx + q.length);
		const after = text.slice(idx + q.length);
		return (
			<>
				{before}
				<span className="font-semibold bg-yellow-200/50 dark:bg-yellow-500/30 text-foreground rounded px-0.5">
					{match}
				</span>
				{after}
			</>
		);
	};

	return (
		<Popover open={open} onOpenChange={setOpen}>
			<PopoverTrigger asChild>
				<Button
					id={triggerId}
					type="button"
					variant="outline"
					role="combobox"
					aria-expanded={open}
					aria-controls="transferencia-producto-listbox"
					disabled={disabled}
					className={cn(
						"w-full justify-between bg-background hover:bg-accent/50 transition-colors",
						!value && "text-muted-foreground",
					)}
				>
					{selected ? (
						<span className="truncate text-left font-medium">
							{selected.nombre}
						</span>
					) : (
						<span className="text-muted-foreground">
							Seleccionar producto...
						</span>
					)}
					<Search className="ml-2 h-4 w-4 shrink-0 opacity-50" />
				</Button>
			</PopoverTrigger>
			<PopoverContent
				id="transferencia-producto-listbox"
				className="w-87.5 p-0"
				align="start"
			>
				<div className="flex items-center border-b px-3">
					<Search className="mr-2 h-4 w-4 shrink-0 opacity-50" />
					<Input
						className="flex h-11 w-full rounded-md bg-transparent py-3 text-sm outline-none placeholder:text-muted-foreground disabled:cursor-not-allowed disabled:opacity-50 border-0 focus-visible:ring-0 px-0"
						placeholder="Buscar producto..."
						value={query}
						onChange={(e) => setQuery(e.target.value)}
						onKeyDown={(e) => {
							if (!filteredProducts.length) return;
							if (e.key === "ArrowDown") {
								e.preventDefault();
								setHighlighted((h) =>
									Math.min(h + 1, filteredProducts.length - 1),
								);
							} else if (e.key === "ArrowUp") {
								e.preventDefault();
								setHighlighted((h) => Math.max(h - 1, 0));
							} else if (e.key === "Enter") {
								e.preventDefault();
								const p = filteredProducts[highlighted];
								if (p) {
									onChange(p.id);
									setOpen(false);
									setQuery("");
								}
							} else if (e.key === "Escape") {
								e.preventDefault();
								setOpen(false);
							}
						}}
					/>
				</div>

				{selected && (
					<div className="p-1 border-b bg-muted/30">
						<Button
							type="button"
							size="sm"
							variant="ghost"
							className="w-full h-8 px-2 text-xs justify-start text-muted-foreground hover:text-foreground"
							onClick={() => {
								onChange("");
								setOpen(false);
								setQuery("");
							}}
						>
							<X className="mr-2 h-3 w-3" />
							Limpiar selección actual
						</Button>
					</div>
				)}

				<ScrollArea className="h-72">
					{filteredProducts.length ? (
						<ul className="p-1">
							{filteredProducts.map((p: any, i: number) => {
								const stock = p.stockUbicacion ?? p.stock ?? 0;
								const isOutOfStock = stock <= 0;
								const isLowStock =
									stock > 0 && stock < minStockThreshold;
								const isDisabled =
									isOutOfStock && !showOutOfStock;

								return (
									<li key={p.id}>
										<TooltipProvider delayDuration={100}>
											<Tooltip>
												<TooltipTrigger asChild>
													<button
														ref={(el) => {
															itemRefs.current[i] = el;
														}}
														type="button"
														disabled={isDisabled}
														className={cn(
															"w-full text-left px-3 py-2.5 rounded-sm flex items-center justify-between text-sm transition-colors",
															i === highlighted
																? "bg-accent text-accent-foreground"
																: "hover:bg-accent/50 hover:text-accent-foreground",
															value === p.id &&
																"bg-accent/80 font-medium",
															isDisabled &&
																"opacity-50 cursor-not-allowed",
														)}
														onMouseEnter={() =>
															setHighlighted(i)
														}
														onClick={() => {
															if (!isDisabled) {
																onChange(p.id);
																setOpen(false);
																setQuery("");
															}
														}}
													>
														<div className="min-w-0 flex-1 pr-3">
															<div className="flex items-center gap-2">
																<div className="truncate flex-1">
																	{renderHighlighted(
																		p.nombre,
																	)}
																</div>
																{isLowStock && (
																	<AlertTriangle className="h-3.5 w-3.5 text-amber-500 shrink-0" />
																)}
																{isOutOfStock && (
																	<Badge
																		variant="destructive"
																		className="text-[10px] px-1.5 py-0 h-4 shrink-0"
																	>
																		Sin Stock
																	</Badge>
																)}
															</div>
															<div className="flex items-center gap-2 text-xs text-muted-foreground mt-0.5">
																<span>
																	Stock:{" "}
																	<span
																		className={cn(
																			isOutOfStock
																				? "text-red-500"
																				: isLowStock
																					? "text-amber-500"
																					: "text-green-600 dark:text-green-400",
																		)}
																	>
																		{stock}
																	</span>{" "}
																	{p.unidad
																		?.simbolo}
																</span>
																<span>·</span>
																<span>
																	${p.precioCosto}
																</span>
															</div>
														</div>
														{value === p.id && (
															<Check className="h-4 w-4 text-primary shrink-0" />
														)}
													</button>
												</TooltipTrigger>
												<TooltipContent
													side="right"
													className="max-w-xs"
												>
													<div className="space-y-1">
														<p className="font-medium">
															{p.nombre}
														</p>
														<p className="text-xs text-muted-foreground">
															Stock disponible:{" "}
															{stock}{" "}
															{p.unidad?.simbolo}
														</p>
														{isLowStock && (
															<p className="text-xs text-amber-500 flex items-center gap-1">
																<AlertTriangle className="h-3 w-3" />
																Stock bajo (&lt;{" "}
																{minStockThreshold}{" "}
																unidades)
															</p>
														)}
														{isOutOfStock && (
															<p className="text-xs text-destructive font-medium">
																Producto sin stock
																disponible
															</p>
														)}
													</div>
												</TooltipContent>
											</Tooltip>
										</TooltipProvider>
									</li>
								);
							})}
						</ul>
					) : (
						<div className="py-6 text-center text-sm text-muted-foreground">
							No se encontraron productos.
						</div>
					)}
				</ScrollArea>
			</PopoverContent>
		</Popover>
	);
}
