"use client";

import dynamic from "next/dynamic";
import {
	getProductosAction,
	deleteProductoAction,
	getStockPorUbicacionAction,
} from "@/features/productos/actions";
import type { Producto } from "@/features/productos/types";

import type { ColumnDef } from "@tanstack/react-table";
import {
	ArrowUpDown,
	Pencil,
	Plus,
	Store,
	Trash2,
	Warehouse,
	Package,
	History,
	Tag,
	Boxes,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { SidebarInset, SidebarProvider } from "@/components/ui/sidebar";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import {
	Tooltip,
	TooltipTrigger,
	TooltipContent,
} from "@/components/ui/tooltip";
import { useState, useMemo, useEffect, useTransition } from "react";
import { toast } from "sonner";
import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import {
	AlertDialog,
	AlertDialogAction,
	AlertDialogCancel,
	AlertDialogContent,
	AlertDialogDescription,
	AlertDialogFooter,
	AlertDialogHeader,
	AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { LazyMotion, m as motion, AnimatePresence } from "framer-motion";

// Lazy load heavy components
const EnhancedDataTable = dynamic(
	() =>
		import("@/features/productos/components/enhanced-data-table").then(
			(mod) => ({ default: mod.EnhancedDataTable }),
		),
	{
		loading: () => (
			<motion.div
				className="h-125 w-full flex items-center justify-center bg-muted/30 rounded-lg border-2 border-dashed"
				initial={{ opacity: 0 }}
				animate={{ opacity: 1 }}
				transition={{ duration: 0.3 }}
			>
				<div className="flex flex-col items-center gap-3">
					<motion.div
						className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full"
						animate={{ rotate: 360 }}
						transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
					/>
					<span className="text-muted-foreground">
						Cargando tabla de productos...
					</span>
				</div>
			</motion.div>
		),
	},
);

const RestockDialog = dynamic(
	() =>
		import("@/features/productos/components/restock-dialog").then((mod) => ({
			default: mod.RestockDialog,
		})),
	{
		loading: () => <div className="h-8 w-8 bg-muted rounded animate-pulse" />,
	},
);

const RestockHistoryDialog = dynamic(
	() =>
		import("@/features/productos/components/restock-history-dialog").then(
			(mod) => ({ default: mod.RestockHistoryDialog }),
		),
	{
		loading: () => <div className="h-8 w-8 bg-muted rounded animate-pulse" />,
	},
);

const QuickOfferDialog = dynamic(
	() =>
		import("@/features/ofertas/components/quick-offer-dialog").then((mod) => ({
			default: mod.QuickOfferDialog,
		})),
	{
		loading: () => <div className="h-8 w-8 bg-muted rounded animate-pulse" />,
	},
);

const ProductFilters = dynamic(
	() =>
		import("@/features/productos/components/product-filters").then((mod) => ({
			default: mod.ProductFilters,
		})),
	{
		loading: () => (
			<motion.div
				className="h-25 w-full bg-muted/30 rounded-lg flex items-center justify-center border-2 border-dashed"
				initial={{ opacity: 0 }}
				animate={{ opacity: 1 }}
			>
				<span className="text-muted-foreground">Cargando filtros...</span>
			</motion.div>
		),
	},
);

/**
 * Producto con campos de stock por ubicación agregados
 */
interface ProductoConStock extends Producto {
	stockUbicacion?: number;
	stockTotal?: number;
}

interface UbicacionSeleccionada {
	id: string;
	tipo: "almacen" | "punto_venta";
	nombre: string;
}

interface ProductosContentProps {
	initialProductos: Producto[];
	initialAlmacenes: Array<{ almacenId: string; nombre: string }>;
	initialPuntosVenta: Array<{ pvId: string; nombre: string }>;
	usaEan13: boolean;
	tenantRole?: string;
	planFeatures?: Record<string, boolean>;
}

/**
 * @description Client Component con toda la interactividad de la página de Productos.
 * Recibe datos iniciales desde el Server Component padre.
 */
export function ProductosContent({
	initialProductos,
	initialAlmacenes,
	initialPuntosVenta,
	usaEan13: initialUsaEan13,
	tenantRole,
	planFeatures,
}: ProductosContentProps) {
	const [ubicacionSeleccionada, setUbicacionSeleccionada] =
		useState<UbicacionSeleccionada | null>(null);
	const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
	const [selectedSubcategory, setSelectedSubcategory] = useState<string | null>(
		null,
	);
	const [showZeroStock, setShowZeroStock] = useState(false);
	const [usaEan13] = useState(initialUsaEan13);
	const [productos, setProductos] = useState<Producto[]>(initialProductos);
	const [almacenes] = useState(initialAlmacenes);
	const [puntosVenta] = useState(initialPuntosVenta);
	const [productosConStock, setProductosConStock] = useState<
		ProductoConStock[]
	>([]);
	const [isLoading] = useState(false);
	const [isLoadingStock, setIsLoadingStock] = useState(false);
	const [isPending, startTransition] = useTransition();

	// ─── Permisos ──
	const puedeEditar = tenantRole === "manager" || !tenantRole;

	// ─── Data fetching: stock por ubicación (Server Action) ──
	useEffect(() => {
		if (!ubicacionSeleccionada) return;
		let cancelled = false;
		async function fetchStock() {
			setIsLoadingStock(true);
			const result = await getStockPorUbicacionAction({
				ubicacionId: ubicacionSeleccionada!.id,
				tipoUbicacion: ubicacionSeleccionada!.tipo,
				includeZero: true,
			});
			if (!cancelled) {
				if (result.success)
					setProductosConStock((result.data ?? []) as ProductoConStock[]);
				setIsLoadingStock(false);
			}
		}
		fetchStock();
		return () => {
			cancelled = true;
		};
	}, [ubicacionSeleccionada]);

	const [productToDelete, setProductToDelete] = useState<string | null>(null);

	// ─── Auto-seleccionar primer almacén al cargar ──────────
	useEffect(() => {
		if (almacenes && almacenes.length > 0 && !ubicacionSeleccionada) {
			const primerAlmacen = almacenes[0];
			setUbicacionSeleccionada({
				id: primerAlmacen.almacenId,
				tipo: "almacen",
				nombre: primerAlmacen.nombre,
			});
		}
	}, [almacenes, ubicacionSeleccionada]);

	// Apply category and subcategory filters
	const datosAMostrar = useMemo<ProductoConStock[]>(() => {
		let result: ProductoConStock[] = [];

		if (
			ubicacionSeleccionada &&
			productosConStock &&
			Array.isArray(productosConStock)
		) {
			result = [...productosConStock];
		} else if (
			!ubicacionSeleccionada &&
			productos &&
			Array.isArray(productos)
		) {
			result = [...productos];
		}

		if (selectedSubcategory) {
			result = result.filter(
				(producto) => producto.subcategoriaId === selectedSubcategory,
			);
		} else if (selectedCategory) {
			result = result.filter((producto) => {
				if (producto.categoria?.catId === selectedCategory) return true;
				const parentId = producto.subcategoria?.parentId;
				if (parentId && parentId === selectedCategory) return true;
				return false;
			});
		}

		if (!showZeroStock) {
			result = result.filter((producto) => {
				const stockValue = ubicacionSeleccionada
					? producto.stockUbicacion
					: producto.stock;
				return (stockValue ?? 0) > 0;
			});
		}

		return result;
	}, [
		ubicacionSeleccionada,
		productosConStock,
		productos,
		selectedCategory,
		selectedSubcategory,
		showZeroStock,
	]);

	const DEFAULT_STOCK_MINIMO = 10;

	const stockSummary = useMemo(() => {
		const getStockValue = (producto: ProductoConStock) => {
			return ubicacionSeleccionada
				? (producto.stockUbicacion ?? 0)
				: (producto.stock ?? 0);
		};

		const total = datosAMostrar.length;
		const sinStock = datosAMostrar.filter(
			(producto) => getStockValue(producto) === 0,
		).length;
		const stockBajo = datosAMostrar.filter((producto) => {
			const stockActual = getStockValue(producto);
			const threshold =
				producto.stockMinimo && producto.stockMinimo > 0
					? producto.stockMinimo
					: DEFAULT_STOCK_MINIMO;
			return stockActual > 0 && stockActual <= threshold;
		}).length;
		const stockNormal = total - sinStock - stockBajo;

		return { total, sinStock, stockBajo, stockNormal };
	}, [datosAMostrar, ubicacionSeleccionada]);

	const handleDelete = () => {
		if (!productToDelete) return;
		startTransition(async () => {
			const result = await deleteProductoAction(productToDelete);
			if (result.success) {
				toast.success("El producto ha sido eliminado exitosamente.");
				const refresh = await getProductosAction();
				// @ts-expect-error
				if (refresh.success) setProductos(refresh.data ?? []);
			} else {
				toast.error(
					result.error?.message || "Hubo un error al eliminar el producto.",
				);
			}
			setProductToDelete(null);
		});
	};

	const columns: ColumnDef<Producto>[] = [
		{
			accessorKey: "fotos",
			header: "Imagen",
			cell: ({ row }) => {
				const producto = row.original;
				const primeraFoto =
					producto.fotos && producto.fotos.length > 0
						? producto.fotos[0]
						: null;

				return (
					<div className="flex items-center justify-center">
						{primeraFoto ? (
							<motion.img
								src={primeraFoto}
								alt={producto.nombre}
								className="h-12 w-12 object-cover rounded-md border"
								initial={{ opacity: 0, scale: 0.8 }}
								animate={{ opacity: 1, scale: 1 }}
								transition={{ duration: 0.3 }}
							/>
						) : (
							<motion.div className="h-12 w-12 bg-muted rounded-md flex items-center justify-center border">
								<Package className="h-6 w-6 text-muted-foreground" />
							</motion.div>
						)}
					</div>
				);
			},
		},
		{
			accessorKey: "nombre",
			header: ({ column }) => (
				<Button
					variant="ghost"
					onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
				>
					Nombre
					<ArrowUpDown className="text-center h-4 w-4" />
				</Button>
			),
		},
		{
			accessorKey: usaEan13 ? "codigoNegocio" : "codigoInterno",
			header: ({ column }) => (
				<Button
					variant="ghost"
					onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
				>
					{usaEan13 ? "Código EAN-13" : "Código interno"}
					<ArrowUpDown className="text-center h-4 w-4" />
				</Button>
			),
			cell: ({ row }) => {
				const p = row.original;
				if (usaEan13) {
					const segmentos = [
						p.proveedorCodigo,
						p.idSeccionCodigo,
						p.especificoCodigo,
						p.surtidoCodigo,
						p.dcCodigo,
					];
					if (segmentos.every(Boolean)) {
						return (
							<div className="font-mono text-xs tracking-wider text-center">
								{segmentos.join("-")}
							</div>
						);
					}
					const negocio = p.codigoNegocio;
					if (negocio?.length === 13) {
						return (
							<div className="font-mono text-xs tracking-wider text-center">{`${negocio.slice(0, 2)}-${negocio.slice(2, 4)}-${negocio.slice(4, 8)}-${negocio.slice(8, 12)}-${negocio.slice(12)}`}</div>
						);
					}
					return (
						<div className="text-center font-medium">{negocio || "-"}</div>
					);
				}
				return (
					<div className="text-center font-medium">
						{p.codigoInterno || "-"}
					</div>
				);
			},
		},
		{
			accessorKey: "descripcion",
			header: "Descripción",
			cell: ({ row }) => (
				<div className="truncate max-w-50">
					{row.getValue("descripcion") || "-"}
				</div>
			),
		},
		{
			accessorKey: "categoria.nombre",
			header: ({ column }) => (
				<Button
					variant="ghost"
					onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
				>
					Categoría
					<ArrowUpDown className="text-center h-4 w-4" />
				</Button>
			),
			cell({ row }) {
				const producto = row.original;
				return (
					<div className="flex items-center justify-center">
						<Badge variant="outline">{producto.categoria?.nombre || "-"}</Badge>
					</div>
				);
			},
		},
		{
			accessorKey: "subcategoria.nombre",
			header: ({ column }) => (
				<Button
					variant="ghost"
					onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
				>
					Subcategoría
					<ArrowUpDown className="text-center h-4 w-4" />
				</Button>
			),
			cell({ row }) {
				const producto = row.original;
				return (
					<div className="flex items-center justify-center">
						<Badge variant="secondary" className="text-xs">
							{producto.subcategoria?.nombre || "-"}
						</Badge>
					</div>
				);
			},
		},
		{
			accessorKey: "precioCosto",
			header: ({ column }) => (
				<Button
					variant="ghost"
					onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
				>
					Precio Costo
					<ArrowUpDown className="text-center h-4 w-4" />
				</Button>
			),
			cell: ({ row }) => {
				const amount = Number.parseFloat(row.getValue("precioCosto"));
				const formatted = new Intl.NumberFormat("es-ES", {
					style: "currency",
					currency: "CUP",
				}).format(amount);
				return <div className="text-center font-medium">{formatted}</div>;
			},
		},
		{
			accessorKey: "precioVenta",
			header: ({ column }) => (
				<Button
					variant="ghost"
					onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
				>
					Precio Venta
					<ArrowUpDown className="text-center h-4 w-4" />
				</Button>
			),
			cell: ({ row }) => {
				const amount = Number.parseFloat(row.getValue("precioVenta"));
				const formatted = new Intl.NumberFormat("es-ES", {
					style: "currency",
					currency: "CUP",
				}).format(amount);
				return <div className="text-center font-medium">{formatted}</div>;
			},
		},
		{
			accessorKey: ubicacionSeleccionada ? "stockUbicacion" : "stock",
			header: ({ column }) => (
				<Button
					variant="ghost"
					onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
				>
					{ubicacionSeleccionada
						? `Stock en ${ubicacionSeleccionada.nombre}`
						: "Stock Total"}
					<ArrowUpDown className="ml-2 h-4 w-4" />
				</Button>
			),
			cell: ({ row }) => {
				const stock = Number.parseInt(
					row.getValue(ubicacionSeleccionada ? "stockUbicacion" : "stock"),
				);
				const producto = row.original;
				const stockMinimo = producto.stockMinimo || 0;
				const threshold = stockMinimo > 0 ? stockMinimo : DEFAULT_STOCK_MINIMO;

				let variant: "outline" | "secondary" | "destructive" = "outline";
				if (stock === 0) {
					variant = "destructive";
				} else if (stock <= threshold) {
					variant = "secondary";
				}

				return (
					<div className="max-w-50 text-center">
						<Badge variant={variant}>{stock}</Badge>
					</div>
				);
			},
		},
		{
			accessorKey: "stockMinimo",
			header: ({ column }) => (
				<Button
					variant="ghost"
					onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
				>
					Stock Mínimo
					<ArrowUpDown className="ml-2 h-4 w-4" />
				</Button>
			),
			cell: ({ row }) => {
				const stockMinimo = Number.parseInt(row.getValue("stockMinimo"));
				return (
					<div className="text-center">
						{stockMinimo > 0 ? (
							<Badge variant="outline">{stockMinimo}</Badge>
						) : (
							<Badge variant="secondary">
								Por defecto ({DEFAULT_STOCK_MINIMO})
							</Badge>
						)}
					</div>
				);
			},
		},
		{
			accessorKey: "diferencia",
			header: ({ column }) => (
				<Button
					variant="ghost"
					onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
				>
					Diferencia
					<ArrowUpDown className="ml-2 h-4 w-4" />
				</Button>
			),
			cell: ({ row }) => {
				const stock = Number.parseInt(
					row.getValue(ubicacionSeleccionada ? "stockUbicacion" : "stock"),
				);
				const producto = row.original;
				const stockMinimo = producto.stockMinimo || 0;
				const threshold = stockMinimo > 0 ? stockMinimo : DEFAULT_STOCK_MINIMO;
				const diferencia = stock - threshold;

				return (
					<div className="text-center">
						<Badge variant={diferencia >= 0 ? "outline" : "destructive"}>
							{diferencia >= 0 ? `+${diferencia}` : diferencia}
						</Badge>
					</div>
				);
			},
		},
		{
			accessorKey: "unidad.simbolo",
			header: ({ column }) => (
				<Button
					variant="ghost"
					onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
				>
					Unidad
					<ArrowUpDown className="h-4 w-4" />
				</Button>
			),
			cell({ row }) {
				const producto = row.original;
				return (
					<div className="flex items-center justify-center gap-2">
						{producto.unidad?.simbolo}
					</div>
				);
			},
		},
		{
			accessorKey: "vendor.nombre",
			header: ({ column }) => (
				<Button
					variant="ghost"
					onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
				>
					Proveedor
					<ArrowUpDown className=" h-4 w-4" />
				</Button>
			),
			cell({ row }) {
				const producto = row.original;
				return (
					<div className="flex items-center justify-center gap-2">
						{producto.vendor?.nombre || "Sin proveedor"}
					</div>
				);
			},
		},
		{
			header: "Actions",
			id: "actions",
			cell: ({ row }) => {
				const producto = row.original;
				const isPuntoVenta = ubicacionSeleccionada?.tipo === "punto_venta";

				// Dependiente solo ve crear oferta
				if (!puedeEditar) {
					return (
						<div className="flex items-center gap-1">
							<QuickOfferDialog
								producto={producto}
								trigger={
									<Button
										variant="outline"
										className="h-8 w-8 p-0 cursor-pointer"
										title="Crear oferta rápida"
									>
										<Tag className="h-4 w-4" />
									</Button>
								}
							/>
						</div>
					);
				}

				return (
					<div className="flex items-center gap-1">
						{isPuntoVenta ? (
							<QuickOfferDialog
								producto={producto}
								trigger={
									<Button
										variant="outline"
										className="h-8 w-8 p-0 cursor-pointer"
										title="Crear oferta rápida"
									>
										<Tag className="h-4 w-4" />
									</Button>
								}
							/>
						) : (
							<>
								<Link href={`/busy/products/edit/${producto.id}`}>
									<Button
										variant="outline"
										className="h-8 w-8 p-0 cursor-pointer"
										title="Editar producto"
									>
										<Pencil className="h-4 w-4" />
									</Button>
								</Link>

								<RestockDialog
									producto={producto}
									trigger={
										<Button
											variant="outline"
											className="h-8 w-8 p-0 cursor-pointer"
											title="Restock producto"
										>
											<Package className="h-4 w-4" />
										</Button>
									}
								/>

								<RestockHistoryDialog
									productoId={producto.id}
									productoNombre={producto.nombre}
									trigger={
										<Tooltip>
											<TooltipTrigger asChild>
												<Button
													variant="outline"
													className="h-8 w-8 p-0 cursor-pointer"
													title="Ver historial de restock"
												>
													<History className="h-4 w-4" />
												</Button>
											</TooltipTrigger>
											<TooltipContent side="top">
												Ver historial de restock
											</TooltipContent>
										</Tooltip>
									}
								/>

								<QuickOfferDialog
									producto={producto}
									trigger={
										<Button
											variant="outline"
											className="h-8 w-8 p-0 cursor-pointer"
											title="Crear oferta rápida"
										>
											<Tag className="h-4 w-4" />
										</Button>
									}
								/>

								<Button
									variant="outline"
									className="h-8 w-8 p-0 cursor-pointer"
									onClick={() => setProductToDelete(producto.id)}
									title="Eliminar producto"
								>
									<Trash2 className="h-4 w-4" />
								</Button>
							</>
						)}
					</div>
				);
			},
		},
	];

	const handleUbicacionChange = (value: string) => {
		const [tipo, id] = value.split(":");
		let nombre = "";

		if (tipo === "almacen") {
			const almacen = almacenes?.find((a) => a.almacenId === id);
			nombre = almacen?.nombre || "";
		} else {
			const puntoVenta = puntosVenta?.find((p) => p.pvId === id);
			nombre = puntoVenta?.nombre || "";
		}

		setUbicacionSeleccionada({
			id,
			tipo: tipo as "almacen" | "punto_venta",
			nombre,
		});
	};

	return (
		<SidebarProvider>
			<SidebarInset>
				<motion.div
					className="container mx-auto py-4"
					initial={{ opacity: 0 }}
					animate={{ opacity: 1 }}
					transition={{ duration: 0.5 }}
				>
					{/* Header Section */}
					<motion.div
						className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-6 gap-4"
						initial={{ opacity: 0, y: 20 }}
						animate={{ opacity: 1, y: 0 }}
						transition={{ delay: 0.1, duration: 0.5 }}
					>
						<div className="flex items-center gap-3">
							<motion.div className="relative flex h-10 w-10 items-center justify-center rounded-xl bg-linear-to-br from-primary to-purple-600 shadow-lg">
								<Boxes className="h-5 w-5 text-white" />
							</motion.div>
							<div>
								<h1 className="text-3xl font-bold bg-linear-to-r from-slate-900 to-slate-600 dark:from-white dark:to-slate-300 bg-clip-text text-transparent">
									Productos
								</h1>
								<p className="text-muted-foreground text-sm">
									Gestiona tu inventario de productos
								</p>
							</div>
						</div>
						<div className="flex items-center gap-2">
							{planFeatures?.["productos-stock-masivo"] === true && (
								<Link href="/busy/products/bulk-stock-minimo">
									<Button variant="outline" className="gap-2 border-dashed">
										<Package className="h-4 w-4" />
										Stock Mínimo
									</Button>
								</Link>
							)}
							{puedeEditar && (
								<Link href="/busy/products/new">
									<Button className="gap-2 bg-linear-to-r from-primary to-purple-600 hover:from-primary/90 hover:to-purple-600/90">
										<Plus className="h-4 w-4" />
										Nuevo Producto
									</Button>
								</Link>
							)}
						</div>
					</motion.div>

					{/* Stock Summary Cards */}
					<motion.div
						className="mb-4 grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4"
						initial={{ opacity: 0, y: 16 }}
						animate={{ opacity: 1, y: 0 }}
						transition={{ delay: 0.16, duration: 0.45 }}
					>
						<Card className="border-dashed bg-linear-to-br from-primary/6 to-transparent dark:from-primary/10">
							<CardContent className="pt-4">
								<p className="text-xs uppercase tracking-wide text-muted-foreground">
									Productos visibles
								</p>
								<p className="mt-2 text-2xl font-semibold">
									{stockSummary.total}
								</p>
							</CardContent>
						</Card>
						<Card className="border-dashed bg-linear-to-br from-primary/6 to-transparent dark:from-primary/10">
							<CardContent className="pt-4">
								<p className="text-xs uppercase tracking-wide text-muted-foreground">
									Stock normal
								</p>
								<p className="mt-2 text-2xl font-semibold text-emerald-500">
									{stockSummary.stockNormal}
								</p>
							</CardContent>
						</Card>
						<Card className="border-dashed bg-linear-to-br from-primary/6 to-transparent dark:from-primary/10">
							<CardContent className="pt-4">
								<p className="text-xs uppercase tracking-wide text-muted-foreground">
									Stock bajo
								</p>
								<p className="mt-2 text-2xl font-semibold text-amber-500">
									{stockSummary.stockBajo}
								</p>
							</CardContent>
						</Card>
						<Card className="border-dashed bg-linear-to-br from-primary/6 to-transparent dark:from-primary/10">
							<CardContent className="pt-4">
								<p className="text-xs uppercase tracking-wide text-muted-foreground">
									Sin stock
								</p>
								<p className="mt-2 text-2xl font-semibold text-destructive">
									{stockSummary.sinStock}
								</p>
							</CardContent>
						</Card>
					</motion.div>

					{/* Category and Subcategory Filters */}
					<motion.div
						initial={{ opacity: 0, y: 20 }}
						animate={{ opacity: 1, y: 0 }}
						transition={{ delay: 0.2, duration: 0.5 }}
					>
						<ProductFilters
							onCategoryFilter={setSelectedCategory}
							onSubcategoryFilter={setSelectedSubcategory}
							selectedCategory={selectedCategory}
							selectedSubcategory={selectedSubcategory}
						/>
					</motion.div>

					{/* Location Filter Card */}
					<motion.div
						initial={{ opacity: 0, y: 20 }}
						animate={{ opacity: 1, y: 0 }}
						transition={{ delay: 0.3, duration: 0.5 }}
					>
						<Card className="mb-4 border-dashed bg-linear-to-br from-primary/5 via-background to-purple-500/8 dark:from-primary/10 dark:to-purple-500/10">
							<CardHeader className="pb-3">
								<div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
									<CardTitle className="flex items-center gap-2 text-lg">
										<Warehouse className="h-5 w-5 text-primary" />
										Filtrar por Ubicación
									</CardTitle>
									<div className="flex items-center space-x-2">
										<Switch
											id="show-zero-stock"
											checked={showZeroStock}
											onCheckedChange={setShowZeroStock}
										/>
										<Label htmlFor="show-zero-stock" className="cursor-pointer">
											Mostrar sin stock
										</Label>
									</div>
								</div>
								<div className="text-sm text-muted-foreground">
									{showZeroStock
										? "Mostrando productos con y sin stock disponible."
										: "Solo se muestran productos con stock mayor a 0"}
								</div>
							</CardHeader>
							<CardContent>
								<div className="flex items-center gap-4 flex-wrap">
									<Select
										onValueChange={handleUbicacionChange}
										value={
											ubicacionSeleccionada
												? `${ubicacionSeleccionada.tipo}:${ubicacionSeleccionada.id}`
												: undefined
										}
									>
										<SelectTrigger className="w-75 bg-background/90 transition-all duration-200 focus-visible:ring-primary/30">
											<SelectValue placeholder="Seleccionar ubicación" />
										</SelectTrigger>
										<SelectContent>
											{almacenes && almacenes.length > 0 && (
												<>
													<SelectItem
														disabled
														value="almacenes-header"
														className="font-semibold"
													>
														Almacenes
													</SelectItem>
													{almacenes.map((almacen) => (
														<SelectItem
															key={almacen.almacenId}
															value={`almacen:${almacen.almacenId}`}
														>
															<div className="flex items-center gap-2">
																<Warehouse className="h-4 w-4" />
																{almacen.nombre}
															</div>
														</SelectItem>
													))}
												</>
											)}

											{puntosVenta && puntosVenta.length > 0 && (
												<>
													<SelectItem
														disabled
														value="puntos-venta-header"
														className="font-semibold"
													>
														Puntos de Venta
													</SelectItem>
													{puntosVenta?.map((puntoVenta) => (
														<SelectItem
															key={puntoVenta.pvId}
															value={`punto_venta:${puntoVenta.pvId}`}
														>
															<div className="flex items-center gap-2">
																<Store className="h-4 w-4" />
																{puntoVenta.nombre}
															</div>
														</SelectItem>
													))}
												</>
											)}
										</SelectContent>
									</Select>

									<AnimatePresence mode="wait">
										{ubicacionSeleccionada && (
											<motion.div
												initial={{ opacity: 0, scale: 0.8 }}
												animate={{ opacity: 1, scale: 1 }}
												exit={{ opacity: 0, scale: 0.8 }}
												transition={{ duration: 0.2 }}
											>
												<Badge
													variant="outline"
													className="flex items-center gap-1 px-3 py-1"
												>
													{ubicacionSeleccionada.tipo === "almacen" ? (
														<Warehouse className="h-3 w-3" />
													) : (
														<Store className="h-3 w-3" />
													)}
													{ubicacionSeleccionada.nombre}
												</Badge>
											</motion.div>
										)}
									</AnimatePresence>
								</div>
							</CardContent>
						</Card>
					</motion.div>

					{/* Data Table */}
					{isLoadingStock && ubicacionSeleccionada ? (
						<motion.div
							initial={{ opacity: 0 }}
							animate={{ opacity: 1 }}
							className="h-125 w-full flex items-center justify-center bg-muted/30 rounded-lg border-2 border-dashed"
						>
							<div className="flex flex-col items-center gap-3">
								<motion.div
									className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full"
									animate={{ rotate: 360 }}
									transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
								/>
								<span className="text-muted-foreground">Cargando stock...</span>
							</div>
						</motion.div>
					) : (
						<motion.div
							initial={{ opacity: 0 }}
							animate={{ opacity: 1 }}
							transition={{ delay: 0.4 }}
						>
							<EnhancedDataTable
								columns={columns as ColumnDef<unknown>[]}
								data={(datosAMostrar || []) as Producto[]}
								searchPlaceholder="Buscar por código, nombre, categoría o subcategoría..."
								isLoading={isLoadingStock}
							/>
						</motion.div>
					)}

					{/* Delete Confirmation Dialog */}
					<AlertDialog
						open={!!productToDelete}
						onOpenChange={(open) => !open && setProductToDelete(null)}
					>
						<AlertDialogContent>
							<AlertDialogHeader>
								<AlertDialogTitle>
									¿Está seguro de eliminar este producto?
								</AlertDialogTitle>
								<AlertDialogDescription>
									Esta acción no se puede deshacer. El producto será eliminado
									permanentemente del sistema.
								</AlertDialogDescription>
							</AlertDialogHeader>
							<AlertDialogFooter>
								<AlertDialogCancel>Cancelar</AlertDialogCancel>
								<AlertDialogAction
									onClick={handleDelete}
									disabled={isPending}
									className="bg-destructive text-destructive-foreground"
								>
									{isPending ? "Eliminando..." : "Eliminar Producto"}
								</AlertDialogAction>
							</AlertDialogFooter>
						</AlertDialogContent>
					</AlertDialog>
				</motion.div>
			</SidebarInset>
		</SidebarProvider>
	);
}
