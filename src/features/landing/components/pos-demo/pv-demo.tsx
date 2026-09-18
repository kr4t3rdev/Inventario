'use client';

import * as React from 'react';
import { useEffect, useMemo, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import {
	Filter,
	LayoutGrid,
	List,
	Loader2,
	Package,
	Plus,
	Search,
	ShoppingCart,
	Store,
	Table as TableIcon,
} from 'lucide-react';
import { toast } from 'sonner';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
	Card,
	CardContent,
	CardFooter,
	CardHeader,
	CardTitle,
} from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from '@/components/ui/select';
import { Separator } from '@/components/ui/separator';
import { Skeleton } from '@/components/ui/skeleton';
import { Textarea } from '@/components/ui/textarea';

import { ProductoCard } from '@/features/ventas/components/producto-card';
import { CartItem } from '@/features/ventas/components/cart-item';
import {
	DEMO_CATEGORIAS,
	DEMO_PRODUCTOS,
	DEMO_PUNTO_VENTA,
	type DemoTurnoActivo,
} from '@/features/landing/components/pos-demo/mock-data';
import { CabeceraTurno } from '@/features/turnos-pos/components/cabecera-turno';
import { CierreTurnoDialog } from '@/features/turnos-pos/components/cierre-turno-dialog';
import { DemoAperturaTurnoDialog } from '@/features/landing/components/pos-demo/turnos/demo-apertura-turno-dialog';
import { DemoArqueoForm } from '@/features/landing/components/pos-demo/turnos/demo-arqueo-form';
import type { DemoArqueoResultado } from '@/features/landing/components/pos-demo/turnos/demo-arqueo-form';
import { DemoCuadreTurnoDialog } from '@/features/landing/components/pos-demo/turnos/demo-cuadre-turno-dialog';
import { PosDemoDialog } from '@/features/landing/components/pos-demo/pos-demo-dialog';

type FormaPago = 'efectivo' | 'tarjeta' | 'transferencia';

interface DemoCartProduct {
	cartId: string;
	id: string;
	nombre: string;
	precioVenta: number;
	cantidad: number;
	stock: number;
	unidad?: { simbolo: string };
}

interface DemoVentaTicket {
	id: string;
	total: number;
	items: number;
	formaPago: FormaPago;
	createdAt: string;
}

interface DemoVentaItem {
	productoId: string;
	cantidad: number;
	precioUnitario: number; // en pesos (no centavos)
	formaPago: FormaPago;
	total: number; // en pesos (no centavos)
}

/**
 * @description Distribuye el total final de una venta entre sus líneas para que
 *              descuentos y redondeos no alteren el total del ticket.
 * @param {Array<{ cantidad: number; precioVenta: number }>} items - Líneas brutas.
 * @param {number} totalFinal - Total final de la venta.
 * @returns {number[]} Totales por línea, con dos decimales y suma exacta.
 */
export function allocateDemoLineTotals(
	items: Array<Pick<DemoCartProduct, 'cantidad' | 'precioVenta'>>,
	totalFinal: number,
): number[] {
	const grossTotal = items.reduce((sum, item) => sum + item.cantidad * item.precioVenta, 0);
	const normalizedTotal = Math.max(0, Number.isFinite(totalFinal) ? totalFinal : 0);
	let remaining = normalizedTotal;

	return items.map((item, index) => {
		if (index === items.length - 1) return Number(remaining.toFixed(2));

		const grossLine = item.cantidad * item.precioVenta;
		const proportionalLine = grossTotal > 0 ? (normalizedTotal * grossLine) / grossTotal : 0;
		const roundedLine = Number(proportionalLine.toFixed(2));
		remaining = Math.max(0, remaining - roundedLine);
		return roundedLine;
	});
}

const FORMAS_PAGO: { id: FormaPago; label: string }[] = [
	{ id: 'efectivo', label: 'Efectivo' },
	{ id: 'tarjeta', label: 'Tarjeta' },
	{ id: 'transferencia', label: 'Transferencia' },
];

/**
 * @description Demo interactiva del POS de FinanceMDM para el landing público.
 *              Replica visual del POS de producción, con datos mockeados y sin
 *              tocar APIs reales. Soporta búsqueda, filtros, 3 vistas, barcode
 *              scan, edición de cantidades/precios, descuentos, observaciones,
 *              checkout con elección de forma de pago y emisión de ticket simulado.
 * @param {{ reduceMotion?: boolean }} props - Desactiva animaciones no esenciales.
 * @returns {JSX.Element} Interfaz POS demo embebible en el landing.
 */
export function PvDemoInteractive({ reduceMotion = false }: { reduceMotion?: boolean }): React.JSX.Element {
	const [searchTerm, setSearchTerm] = useState('');
	const [selectedCategoriaId, setSelectedCategoriaId] = useState<string>('all');
	const [soloConStock, setSoloConStock] = useState<boolean>(false);
	const [showFilters, setShowFilters] = useState<boolean>(true);
	const [barcodeInput, setBarcodeInput] = useState<string>('');
	const [viewMode, setViewMode] = useState<'grid' | 'list' | 'table'>('grid');
	const [cart, setCart] = useState<DemoCartProduct[]>([]);
	const [descuento, setDescuento] = useState<number>(0);
	const [observaciones, setObservaciones] = useState<string>('');
	const [isProcessing, setIsProcessing] = useState(false);
	const [isCheckoutOpen, setIsCheckoutOpen] = useState(false);
	const [formaPago, setFormaPago] = useState<FormaPago>('efectivo');
	const [ticket, setTicket] = useState<DemoVentaTicket | null>(null);

	// === Turno POS demo (no acoplado al backend) ===
	const [turnoActivo, setTurnoActivo] = useState<DemoTurnoActivo | null>(null);
	const [isAperturaDialogOpen, setIsAperturaDialogOpen] = useState(false);
	const [isCierreDialogOpen, setIsCierreDialogOpen] = useState(false);
	const [isArqueoDialogOpen, setIsArqueoDialogOpen] = useState(false);
	const [isCuadreDialogOpen, setIsCuadreDialogOpen] = useState(false);
	const [ultimoArqueo, setUltimoArqueo] = useState<DemoArqueoResultado | null>(null);
	const cartSectionRef = useRef<HTMLDivElement>(null);
	const checkoutButtonRef = useRef<HTMLButtonElement>(null);
	const checkoutWasVisibleRef = useRef(false);

	useEffect(() => {
		const checkoutIsVisible = isCheckoutOpen || isProcessing;

		if (checkoutWasVisibleRef.current && !checkoutIsVisible && ticket === null) {
			checkoutButtonRef.current?.focus();
		}

		checkoutWasVisibleRef.current = checkoutIsVisible;
	}, [isCheckoutOpen, isProcessing, ticket]);

	// Items vendidos en el turno actual, agrupados por item.
	const [ventasItems, setVentasItems] = useState<DemoVentaItem[]>([]);
	const [ventasTickets, setVentasTickets] = useState<DemoVentaTicket[]>([]);

	const resetTurnoFlow = () => {
		setIsCierreDialogOpen(false);
		setIsArqueoDialogOpen(false);
		setIsCuadreDialogOpen(false);
	};

	const productos = DEMO_PRODUCTOS;
	const categorias = DEMO_CATEGORIAS;
	const selectedPuntoVenta = DEMO_PUNTO_VENTA;

	const filteredProducts = useMemo(() => {
		return productos.filter((producto) => {
			const matchSearch =
				searchTerm === '' ||
				producto.nombre.toLowerCase().includes(searchTerm.toLowerCase()) ||
				producto.descripcion?.toLowerCase().includes(searchTerm.toLowerCase()) ||
				producto.codigoBarras?.toLowerCase().includes(searchTerm.toLowerCase());

			const matchCategoria =
				selectedCategoriaId === 'all' || producto.categoriaId === selectedCategoriaId;

			const matchStock = !soloConStock || producto.stockEnUbicacion > 0;

			return matchSearch && matchCategoria && matchStock;
		});
	}, [productos, searchTerm, selectedCategoriaId, soloConStock]);

	const highlightTextFn = (text: string, term: string) => {
		if (!term) return text;
		try {
			const regex = new RegExp(`(${term})`, 'gi');
			const parts = text.split(regex);
			return parts.map((part, idx) =>
				regex.test(part) ? (
					<span
						key={idx}
						className="bg-yellow-200 dark:bg-yellow-800/50 rounded px-0.5"
					>
						{part}
					</span>
				) : (
					part
				),
			);
		} catch {
			return text;
		}
	};

	const addToCart = (product: Omit<DemoCartProduct, 'cartId'>) => {
		const existingItem = cart.find(
			(item) => item.id === product.id && item.precioVenta === product.precioVenta,
		);

		if (existingItem) {
			setCart(
				cart.map((item) =>
					item.cartId === existingItem.cartId
						? { ...item, cantidad: Math.min(item.cantidad + 1, item.stock) }
						: item,
				),
			);
			if (existingItem.cantidad >= product.stock) {
				toast(`No hay más unidades disponibles de ${product.nombre}`);
			}
		} else {
			setCart([...cart, { ...product, cartId: crypto.randomUUID(), cantidad: 1 }]);
		}
	};

	const updateQuantity = (cartId: string, newQuantity: number) => {
		const product = cart.find((item) => item.cartId === cartId);
		if (!product) return;

		if (newQuantity > 0 && newQuantity <= product.stock) {
			setCart(
				cart.map((item) =>
					item.cartId === cartId ? { ...item, cantidad: newQuantity } : item,
				),
			);
		} else if (newQuantity <= 0) {
			removeFromCart(cartId);
		} else if (newQuantity > product.stock) {
			toast(`Solo hay ${product.stock} unidades disponibles de ${product.nombre}`);
		}
	};

	const updatePrice = (cartId: string, newPrice: number) => {
		if (newPrice < 0) return;
		setCart(
			cart.map((item) =>
				item.cartId === cartId ? { ...item, precioVenta: newPrice } : item,
			),
		);
	};

	const removeFromCart = (cartId: string) => {
		setCart(cart.filter((item) => item.cartId !== cartId));
	};

	const focusCartOnMobile = () => {
		cartSectionRef.current?.scrollIntoView({
			behavior: reduceMotion ? 'auto' : 'smooth',
			block: 'start',
		});
	};

	const handleBarcodeScan = (e: React.KeyboardEvent<HTMLInputElement>) => {
		if (e.key !== 'Enter' || !barcodeInput.trim()) return;
		const product = productos.find((p) => p.codigoBarras === barcodeInput.trim());
		if (product) {
			addToCart({
				id: product.id,
				nombre: product.nombre,
				precioVenta: product.precioVenta,
				cantidad: 1,
				stock: product.stockEnUbicacion,
				unidad: product.unidad,
			});
			toast(`Producto "${product.nombre}" añadido al carrito`);
			setBarcodeInput('');
		} else {
			toast.error('Producto no encontrado con este código de barras');
			setBarcodeInput('');
		}
	};

	const cartTotal = cart.reduce(
		(total, item) => total + item.precioVenta * item.cantidad,
		0,
	);
	const totalConDescuento = Math.max(
		0,
		cartTotal - (Number.isFinite(descuento) ? descuento : 0),
	);

	// === Métricas del turno para arqueo/cuadre ===
	const ventasPorFormaPago = useMemo(() => {
		const cents = (p: number) => Math.round(p * 100);
		const agg = { efectivo: 0, efectivoUsd: 0, tarjeta: 0, transferencia: 0, credito: 0 };
		for (const v of ventasItems) {
			if (v.formaPago === 'efectivo') agg.efectivo += cents(v.total);
			else if (v.formaPago === 'tarjeta') agg.tarjeta += cents(v.total);
			else if (v.formaPago === 'transferencia') agg.transferencia += cents(v.total);
		}
		return agg;
	}, [ventasItems]);

	const totalVentaTurno = useMemo(
		() => ventasTickets.reduce((acc, venta) => acc + venta.total, 0),
		[ventasTickets],
	);

	const totalTicketsTurno = ventasTickets.length;

	const processDemoVenta = async () => {
		if (cart.length === 0) {
			toast('Añada productos al carrito para realizar una venta');
			return;
		}
		setIsProcessing(true);
		await new Promise((resolve) => setTimeout(resolve, 850));

		const newTicket: DemoVentaTicket = {
			id: `TKT-${Date.now().toString().slice(-6)}`,
			total: totalConDescuento,
			items: cart.reduce((acc, item) => acc + item.cantidad, 0),
			formaPago,
				createdAt: new Date().toLocaleString('es-ES', {
				dateStyle: 'short',
				timeStyle: 'short',
			}),
		};

		setTicket(newTicket);
		setCart([]);
		setDescuento(0);
		setObservaciones('');
		setIsCheckoutOpen(false);
		setIsProcessing(false);

		// Si hay turno activo, registrar los items vendidos para el cuadre.
		if (turnoActivo) {
			const lineTotals = allocateDemoLineTotals(cart, totalConDescuento);
			const nuevasVentas: DemoVentaItem[] = cart.map((item, index) => ({
				productoId: item.id,
				cantidad: item.cantidad,
				precioUnitario: item.precioVenta,
				formaPago,
				total: lineTotals[index],
			}));
			setVentasItems((prev) => [...prev, ...nuevasVentas]);
			setVentasTickets((prev) => [...prev, newTicket]);
		}

		toast(`Demo: se ha registrado la venta por $${totalConDescuento.toFixed(2)}`);
	};

	const renderProductosGrid = () => (
		<motion.div
			key="grid-view"
			className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3"
			initial={reduceMotion ? false : {}}
			animate={reduceMotion ? undefined : { opacity: 1 }}
			exit={reduceMotion ? undefined : {}}
			transition={{ duration: 0.2 }}
		>
			{filteredProducts.map((producto, index) => (
				<motion.div
					key={producto.id}
					initial={reduceMotion ? false : { y: 20 }}
					animate={reduceMotion ? undefined : { opacity: 1, y: 0 }}
					transition={{ delay: index * 0.03, duration: 0.3 }}
				>
					<ProductoCard
						producto={{
							id: producto.id,
							nombre: producto.nombre,
							descripcion: producto.descripcion,
							precioVenta: producto.precioVenta,
							stock: producto.stockEnUbicacion,
							fotos: producto.fotos,
							unidad: producto.unidad,
										categoria: producto.categoria,
										}}
										reduceMotion={reduceMotion}
										onAddToCart={() =>
							addToCart({
								id: producto.id,
								nombre: producto.nombre,
								precioVenta: producto.precioVenta,
								cantidad: 1,
								stock: producto.stockEnUbicacion,
								unidad: producto.unidad,
							})
						}
						searchTerm={searchTerm}
					/>
				</motion.div>
			))}
		</motion.div>
	);

	const renderProductosList = () => (
		<motion.div
			key="list-view"
			className="space-y-2"
			initial={reduceMotion ? false : {}}
			animate={reduceMotion ? undefined : { opacity: 1 }}
			exit={reduceMotion ? undefined : {}}
			transition={{ duration: 0.2 }}
		>
			{filteredProducts.map((producto, index) => (
				<motion.div
					key={producto.id}
					initial={reduceMotion ? false : { x: -20 }}
					animate={reduceMotion ? undefined : { opacity: 1, x: 0 }}
					transition={{ delay: index * 0.02, duration: 0.3 }}
					whileHover={reduceMotion ? undefined : { scale: 1.005 }}
										className="flex items-center gap-4 p-3 border rounded-lg hover:border-primary/50 hover:bg-muted/30 transition-colors"
				>
					<div className="w-12 h-12 bg-linear-to-br from-orange-500 to-red-600 rounded-lg flex items-center justify-center flex-shrink-0">
						<Package className="h-5 w-5 text-white" />
					</div>
					<div className="flex-1 min-w-0">
						<h3 className="font-medium truncate">
							{highlightTextFn(producto.nombre, searchTerm)}
						</h3>
						<div className="flex items-center gap-2 text-sm text-muted-foreground">
							{producto.categoria?.nombre && (
								<Badge variant="outline" className="text-[10px]">
									{producto.categoria.nombre}
								</Badge>
							)}
							<span
								className={
									producto.stockEnUbicacion === 0
										? 'text-red-500'
										: producto.stockEnUbicacion < 5
											? 'text-yellow-500'
											: ''
								}
							>
								Stock: {producto.stockEnUbicacion} {producto.unidad?.simbolo || 'u'}
							</span>
						</div>
					</div>
					<div className="text-right flex-shrink-0">
						<span className="text-lg font-bold text-primary">
							${producto.precioVenta.toFixed(2)}
						</span>
						<motion.button
							whileHover={reduceMotion ? undefined : { scale: 1.1 }}
							whileTap={reduceMotion ? undefined : { scale: 0.9 }}
														className="ml-1 size-11 rounded-full bg-primary/10 p-2.5 text-primary transition-colors hover:bg-primary hover:text-white sm:ml-2"
													disabled={producto.stockEnUbicacion === 0}
													aria-label={`Añadir ${producto.nombre} al carrito`}
													type="button"
													onClick={() =>
													addToCart({
														id: producto.id,
														nombre: producto.nombre,
														precioVenta: producto.precioVenta,
														cantidad: 1,
														stock: producto.stockEnUbicacion,
														unidad: producto.unidad,
													})
												}
											>
							<Plus className="h-4 w-4" />
						</motion.button>
					</div>
				</motion.div>
			))}
		</motion.div>
	);

	const renderProductosTable = () => (
		<motion.div
			key="table-view"
			className="overflow-x-auto"
			initial={reduceMotion ? false : {}}
			animate={reduceMotion ? undefined : { opacity: 1 }}
			exit={reduceMotion ? undefined : {}}
			transition={{ duration: 0.2 }}
		>
			<table className="w-full">
				<thead>
					<tr className="border-b">
						<th className="text-left p-3 font-medium text-muted-foreground">Producto</th>
						<th className="text-left p-3 font-medium text-muted-foreground">Categoría</th>
						<th className="text-right p-3 font-medium text-muted-foreground">Precio</th>
						<th className="text-center p-3 font-medium text-muted-foreground">Stock</th>
						<th className="text-center p-3 font-medium text-muted-foreground">Acción</th>
					</tr>
				</thead>
				<tbody>
					{filteredProducts.map((producto, index) => (
						<motion.tr
							key={producto.id}
							initial={reduceMotion ? false : { y: 10 }}
							animate={reduceMotion ? undefined : { opacity: 1, y: 0 }}
							transition={{ delay: index * 0.02, duration: 0.2 }}
							className="border-b hover:bg-muted/30 transition-colors"
						>
							<td className="p-3">
								<div className="font-medium">
									{highlightTextFn(producto.nombre, searchTerm)}
								</div>
								{producto.descripcion && (
									<div className="text-sm text-muted-foreground truncate max-w-[200px]">
										{producto.descripcion}
									</div>
								)}
							</td>
							<td className="p-3">
								{producto.categoria?.nombre && (
									<Badge variant="outline" className="text-xs">
										{producto.categoria.nombre}
									</Badge>
								)}
							</td>
							<td className="p-3 text-right">
								<span className="font-bold text-primary">
									${producto.precioVenta.toFixed(2)}
								</span>
							</td>
							<td className="p-3 text-center">
								<Badge
									variant={
										producto.stockEnUbicacion === 0
											? 'destructive'
											: producto.stockEnUbicacion < 5
												? 'secondary'
												: 'outline'
									}
								>
									{producto.stockEnUbicacion} {producto.unidad?.simbolo || 'u'}
								</Badge>
							</td>
							<td className="p-3 text-center">
								<motion.button
									whileHover={reduceMotion ? undefined : { scale: 1.1 }}
									whileTap={reduceMotion ? undefined : { scale: 0.9 }}
									onClick={() =>
										addToCart({
											id: producto.id,
											nombre: producto.nombre,
											precioVenta: producto.precioVenta,
											cantidad: 1,
											stock: producto.stockEnUbicacion,
											unidad: producto.unidad,
										})
									}
											className="size-11 rounded-lg bg-primary/10 p-2.5 text-primary transition-colors hover:bg-primary hover:text-white disabled:cursor-not-allowed disabled:opacity-50"
										disabled={producto.stockEnUbicacion === 0}
										aria-label={`Añadir ${producto.nombre} al carrito`}
										type="button"
									>
									<Plus className="h-4 w-4" />
								</motion.button>
							</td>
						</motion.tr>
					))}
				</tbody>
			</table>
		</motion.div>
	);

	const renderProductosContent = () => {
		if (filteredProducts.length === 0) {
			return (
				<motion.div
					key="empty"
					className="flex flex-col items-center justify-center h-64 text-center"
					initial={reduceMotion ? false : { scale: 0.9 }}
					animate={reduceMotion ? undefined : { opacity: 1, scale: 1 }}
					exit={reduceMotion ? undefined : { scale: 0.9 }}
					transition={{ duration: 0.3 }}
				>
					<motion.div
						animate={reduceMotion ? undefined : { rotate: [0, 8, -8, 0] }}
						transition={{
							duration: 2,
							repeat: Infinity,
							repeatDelay: 3,
							ease: 'easeInOut',
						}}
					>
						<Package className="h-12 w-12 text-muted-foreground mb-2" />
					</motion.div>
					<h3 className="text-lg font-medium">No se encontraron productos</h3>
					<p className="text-muted-foreground">
						{searchTerm
							? 'No hay productos que coincidan con su búsqueda'
							: 'No hay productos disponibles en este punto de venta'}
					</p>
				</motion.div>
			);
		}
		if (viewMode === 'grid') return renderProductosGrid();
		if (viewMode === 'list') return renderProductosList();
		// Tabla: forzar vista de lista en mobile (mejor UX que scroll horizontal estrecho)
		if (typeof window !== 'undefined' && window.innerWidth < 640) {
			return renderProductosList();
		}
		return renderProductosTable();
	};

	return (
			<div
				data-pos-demo
				data-reduce-motion={reduceMotion}
				className="relative"
			>
				{cart.length > 0 && (
					<div className="sticky bottom-2 z-20 mx-1 mb-3 md:hidden">
						<Button
							variant="outline"
							className="min-h-11 w-full border-primary bg-background/95 px-3 shadow-lg backdrop-blur"
							onClick={focusCartOnMobile}
							aria-controls="demo-pos-cart"
							aria-label={`Ver carrito, ${cart.length} ${cart.length === 1 ? 'producto' : 'productos'}`}
						>
							<ShoppingCart className="h-4 w-4" />
							Ver carrito · ${totalConDescuento.toFixed(2)}
						</Button>
					</div>
				)}

			<div className="grid grid-cols-1 gap-4 md:grid-cols-3 md:gap-6">
			{/* === Panel izquierdo: Productos === */}
			<div className="space-y-4 md:col-span-2 md:space-y-6">
				<motion.div
					initial={reduceMotion ? false : { y: 20 }}
					animate={reduceMotion ? undefined : { opacity: 1, y: 0 }}
					transition={{ duration: 0.5 }}
				>
					<Card className="overflow-hidden border-dashed">
						<div className="h-1 bg-linear-to-r from-orange-500 to-red-600" />
						<CardHeader className="px-4 pb-3 sm:px-5">
							<div className="mb-3 flex items-center gap-2 sm:mb-4 sm:gap-3">
								<motion.div
									className="w-10 h-10 bg-linear-to-br from-orange-500 to-red-600 rounded-xl flex items-center justify-center shadow-lg"
									whileHover={reduceMotion ? undefined : { scale: 1.05, rotate: 5 }}
									transition={{ type: 'spring', stiffness: 400, damping: 10 }}
								>
									<Store className="h-5 w-5 text-white" />
								</motion.div>
								<div>
									<h2 className="text-lg font-semibold">Punto de Venta</h2>
									<p className="text-sm text-muted-foreground">
										{DEMO_PUNTO_VENTA.nombre} — demo interactiva
									</p>
								</div>
							</div>

							<div className="flex flex-col md:flex-row gap-4">
								<div className="w-full md:w-1/3">
									<Select value={selectedPuntoVenta.pvId} disabled>
										<SelectTrigger className="transition-all duration-200">
											<SelectValue placeholder="Seleccionar punto de venta" />
										</SelectTrigger>
										<SelectContent>
											<SelectItem value={selectedPuntoVenta.pvId}>
												<span className="flex flex-wrap items-center gap-2">
													<Store className="mr-2 h-4 w-4" />
													{selectedPuntoVenta.nombre}
												</span>
											</SelectItem>
										</SelectContent>
									</Select>
								</div>

								<div className="relative w-full md:w-2/3">
									<Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
									<Input
										type="search"
										aria-label="Buscar productos"
										placeholder="Buscar productos..."
										className="pl-10 pr-10"
										value={searchTerm}
										onChange={(e) => setSearchTerm(e.target.value)}
									/>
								</div>
							</div>

							<div className="relative mt-2">
								<Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
									<Input
										type="text"
										aria-label="Escanear código de barras"
										placeholder="Escanear código de barras y presionar Enter"
									className="pl-10"
									value={barcodeInput}
									onChange={(e) => setBarcodeInput(e.target.value)}
									onKeyDown={handleBarcodeScan}
								/>
							</div>
						</CardHeader>
					</Card>
				</motion.div>

				{/* === Filtros === */}
				<motion.div
					initial={reduceMotion ? false : { y: 20 }}
					animate={reduceMotion ? undefined : { opacity: 1, y: 0 }}
					transition={{ duration: 0.5, delay: 0.1 }}
				>
					<Card className="border-dashed">
						<CardHeader className="px-4 pb-3 sm:px-5">
							<div className="flex items-center justify-between">
								<CardTitle className="text-lg flex items-center gap-2">
									<Filter className="h-4 w-4" />
									Filtros de búsqueda
								</CardTitle>
								<motion.div whileHover={reduceMotion ? undefined : { scale: 1.02 }} whileTap={reduceMotion ? undefined : { scale: 0.98 }}>
										<Button
											variant="outline"
											size="sm"
											onClick={() => setShowFilters(!showFilters)}
											aria-expanded={showFilters}
											aria-controls="demo-pos-filters"
										>
										{showFilters ? 'Ocultar' : 'Mostrar'}
									</Button>
								</motion.div>
							</div>
							<AnimatePresence>
								{showFilters && (
									<motion.div
										initial={reduceMotion ? false : { height: 0 }}
										animate={reduceMotion ? undefined : { opacity: 1, height: 'auto' }}
										exit={reduceMotion ? undefined : { height: 0 }}
										transition={{ duration: 0.3 }}
												className="space-y-4 pt-4 overflow-hidden"
												id="demo-pos-filters"
									>
										<div>
											<Label className="text-sm font-medium mb-2 block">
												Categoría
											</Label>
											<Select
												value={selectedCategoriaId}
												onValueChange={setSelectedCategoriaId}
											>
															<SelectTrigger>
													<SelectValue placeholder="Todas las categorías" />
												</SelectTrigger>
												<SelectContent>
													<SelectItem value="all">Todas las categorías</SelectItem>
													{categorias.map((categoria) => (
														<SelectItem
															key={categoria.catId}
															value={categoria.catId}
														>
															{categoria.nombre}
														</SelectItem>
													))}
												</SelectContent>
											</Select>
										</div>

										<div className="flex items-center space-x-2">
											<Checkbox
												id="demo-stock-filter"
												checked={soloConStock}
												onCheckedChange={(checked) =>
													setSoloConStock(checked as boolean)
												}
											/>
											<Label
												htmlFor="demo-stock-filter"
												className="text-sm font-medium cursor-pointer"
											>
												Mostrar solo productos con stock disponible
											</Label>
										</div>

										<AnimatePresence>
											{(selectedCategoriaId !== 'all' || soloConStock) && (
												<motion.div
													initial={reduceMotion ? false : { y: -10 }}
													animate={reduceMotion ? undefined : { opacity: 1, y: 0 }}
													exit={reduceMotion ? undefined : { y: -10 }}
												>
													<Button
														variant="outline"
														size="sm"
														onClick={() => {
															setSelectedCategoriaId('all');
															setSoloConStock(false);
														}}
													>
														Limpiar filtros
													</Button>
												</motion.div>
											)}
										</AnimatePresence>
									</motion.div>
								)}
							</AnimatePresence>
						</CardHeader>
					</Card>
				</motion.div>

				{/* === Productos === */}
				<motion.div
					initial={reduceMotion ? false : { y: 20 }}
					animate={reduceMotion ? undefined : { opacity: 1, y: 0 }}
					transition={{ duration: 0.5, delay: 0.2 }}
				>
					<Card className="overflow-hidden border-dashed">
						<div className="h-1 bg-linear-to-r from-orange-500 to-red-600" />
						<CardHeader className="px-4 pb-3 sm:px-5">
							<div className="flex flex-wrap items-start justify-between gap-2 sm:items-center sm:gap-4">
								{/* Cabecera de turno activo (mismo componente que el POS real) */}
								{turnoActivo && (
									<CabeceraTurno
										turno={{
											id: turnoActivo.id,
											empleado: turnoActivo.empleado,
											fondoInicialCup: turnoActivo.fondoInicialCup,
											fondoInicialUsd: turnoActivo.fondoInicialUsd,
											_count: { ventas: totalTicketsTurno },
											ventas: [{ total: totalVentaTurno }],
										}}
										onCerrarTurno={() => setIsCierreDialogOpen(true)}
										onArqueo={() => setIsArqueoDialogOpen(true)}
										onCuadre={() => setIsCuadreDialogOpen(true)}
									/>
								)}

								{/* Botón abrir turno si no hay turno activo (igual que el POS real) */}
								{!turnoActivo && (
									<div className="flex items-center gap-2">
										<Button
											variant="outline"
											size="sm"
											onClick={() => setIsAperturaDialogOpen(true)}
											className="gap-1.5"
										>
											Abrir Turno
										</Button>
										<span className="text-xs text-muted-foreground">
											Sin turno abierto — las ventas no se contabilizan
										</span>
									</div>
								)}

							<div className="flex min-w-0 items-center gap-2 sm:gap-3">
								<motion.div
									className="w-8 h-8 bg-linear-to-br from-orange-500 to-red-600 rounded-lg flex items-center justify-center shrink-0"
									whileHover={reduceMotion ? undefined : { scale: 1.05 }}
								>
									<Package className="h-4 w-4 text-white" />
								</motion.div>
								<CardTitle className="min-w-0 truncate">
									Productos en {selectedPuntoVenta.nombre}
								</CardTitle>
							</div>

								{filteredProducts.length > 0 && (
									<motion.div
										initial={reduceMotion ? false : { scale: 0.9 }}
										animate={reduceMotion ? undefined : { opacity: 1, scale: 1 }}
										exit={reduceMotion ? undefined : { scale: 0.9 }}
										className="flex w-full items-center justify-end gap-1 rounded-lg bg-muted/50 p-1 sm:w-auto"
									>
										<motion.button
											whileHover={reduceMotion ? undefined : { scale: 1.05 }}
											whileTap={reduceMotion ? undefined : { scale: 0.95 }}
											onClick={() => setViewMode('grid')}
											className={`size-11 rounded-md p-2.5 transition-all duration-200 ${
												viewMode === 'grid'
													? 'bg-primary text-white shadow-md'
													: 'text-muted-foreground hover:bg-muted'
											}`}
													aria-label="Vista de cuadrícula"
													aria-pressed={viewMode === 'grid'}
													title="Vista de cuadrícula"
										>
											<LayoutGrid className="h-4 w-4" />
										</motion.button>
										<motion.button
											whileHover={reduceMotion ? undefined : { scale: 1.05 }}
											whileTap={reduceMotion ? undefined : { scale: 0.95 }}
											onClick={() => setViewMode('list')}
											className={`size-11 rounded-md p-2.5 transition-all duration-200 ${
												viewMode === 'list'
													? 'bg-primary text-white shadow-md'
													: 'text-muted-foreground hover:bg-muted'
											}`}
													aria-label="Vista de lista"
													aria-pressed={viewMode === 'list'}
													title="Vista de lista"
										>
											<List className="h-4 w-4" />
										</motion.button>
										<motion.button
											whileHover={reduceMotion ? undefined : { scale: 1.05 }}
											whileTap={reduceMotion ? undefined : { scale: 0.95 }}
											onClick={() => setViewMode('table')}
											className={`size-11 rounded-md p-2.5 transition-all duration-200 ${
												viewMode === 'table'
													? 'bg-primary text-white shadow-md'
													: 'text-muted-foreground hover:bg-muted'
											}`}
													aria-label="Vista de tabla"
													aria-pressed={viewMode === 'table'}
													title="Vista de tabla"
										>
											<TableIcon className="h-4 w-4" />
										</motion.button>
									</motion.div>
								)}
							</div>
						</CardHeader>
						<CardContent className="px-4 sm:px-5">
							<AnimatePresence mode="wait">{renderProductosContent()}</AnimatePresence>
						</CardContent>
					</Card>
				</motion.div>
			</div>

			{/* === Panel derecho: Carrito === */}
			<div id="demo-pos-cart" ref={cartSectionRef} className="scroll-mt-24">
				<motion.div
					initial={reduceMotion ? false : { x: 20 }}
					animate={reduceMotion ? undefined : { opacity: 1, x: 0 }}
					transition={{ duration: 0.5, delay: 0.3 }}
				>
						<Card className="overflow-hidden border-dashed md:sticky md:top-20">
						<div className="h-1 bg-linear-to-r from-orange-500 to-red-600" />
						<CardHeader className="px-4 pb-3 sm:px-5">
							<CardTitle className="flex flex-wrap items-center gap-2">
								<motion.div
										className="flex h-8 w-8 items-center justify-center rounded-lg bg-linear-to-br from-orange-500 to-red-600"
									whileHover={reduceMotion ? undefined : { scale: 1.05 }}
								>
									<ShoppingCart className="h-4 w-4 text-white" />
								</motion.div>
								Carrito de compras
								<AnimatePresence>
									{cart.length > 0 && (
										<motion.div
											initial={reduceMotion ? false : { scale: 0 }}
											animate={reduceMotion ? undefined : { scale: 1 }}
											exit={reduceMotion ? undefined : { scale: 0 }}
											transition={{ type: 'spring', stiffness: 500, damping: 15 }}
										>
											<Badge variant="secondary" className="ml-0 sm:ml-2">
												{cart.length} {cart.length === 1 ? 'producto' : 'productos'}
											</Badge>
										</motion.div>
									)}
								</AnimatePresence>
							</CardTitle>
						</CardHeader>
						<CardContent className="px-4 sm:px-5">
							{cart.length === 0 ? (
								<motion.div
									className="flex flex-col items-center justify-center h-64 text-center"
									initial={reduceMotion ? false : { scale: 0.9 }}
									animate={reduceMotion ? undefined : { opacity: 1, scale: 1 }}
									transition={{ duration: 0.3 }}
								>
									<motion.div
										animate={reduceMotion ? undefined : { rotate: [0, -10, 10, 0] }}
										transition={{ duration: 2, repeat: Infinity, repeatDelay: 3 }}
									>
										<ShoppingCart className="h-12 w-12 text-muted-foreground mb-2" />
									</motion.div>
									<h3 className="text-lg font-medium">Carrito vacío</h3>
									<p className="text-muted-foreground">
										Añada productos al carrito para realizar una venta
									</p>
								</motion.div>
							) : (
								<ScrollArea className="h-100 pr-1 sm:pr-4">
									<motion.div
										className="space-y-4"
									initial={reduceMotion ? false : 'hidden'}
									animate={reduceMotion ? undefined : 'visible'}
									variants={reduceMotion ? undefined : {
											hidden: {},
											visible: {
												opacity: 1,
												transition: { staggerChildren: 0.1 },
											},
										}}
									>
										<AnimatePresence mode="popLayout">
											{cart.map((item, index) => (
												<motion.div
													key={item.cartId}
													layout={!reduceMotion}
													initial={reduceMotion ? false : { x: -20 }}
													animate={reduceMotion ? undefined : { opacity: 1, x: 0 }}
													exit={reduceMotion ? undefined : { x: 20 }}
													transition={{ delay: index * 0.05 }}
												>
													<CartItem
														item={item}
														onUpdateQuantity={updateQuantity}
													onUpdatePrice={updatePrice}
													onRemove={removeFromCart}
													reduceMotion={reduceMotion}
												/>
												</motion.div>
											))}
										</AnimatePresence>
									</motion.div>
								</ScrollArea>
							)}
						</CardContent>
						<Separator />
						<CardFooter className="flex flex-col space-y-3 px-4 pt-4 sm:px-5">
							<motion.div
								className="grid grid-cols-1 gap-2 w-full"
								initial={reduceMotion ? false : { y: 10 }}
								animate={reduceMotion ? undefined : { opacity: 1, y: 0 }}
								transition={{ delay: 0.2 }}
							>
								<div>
										<Label htmlFor="demo-pos-discount" className="text-sm font-medium mb-1 flex items-center gap-2">
											Descuento
										</Label>
										<Input
											id="demo-pos-discount"
										type="number"
										min={0}
										value={descuento}
										onChange={(e) => {
											const val = Number(e.target.value);
											setDescuento(Number.isFinite(val) ? Math.max(0, val) : 0);
										}}
										placeholder="0"
									/>
								</div>
								<div>
									<Label htmlFor="demo-pos-notes" className="block text-sm font-medium mb-1">Observaciones</Label>
									<Textarea
										id="demo-pos-notes"
										value={observaciones}
										onChange={(e) => setObservaciones(e.target.value)}
										placeholder="Notas de la venta, comentarios, condiciones, etc."
										className="min-h-[80px]"
									/>
								</div>
							</motion.div>

							<motion.div
								className="space-y-1 w-full"
								initial={reduceMotion ? false : {}}
								animate={reduceMotion ? undefined : { opacity: 1 }}
								transition={{ delay: 0.3 }}
							>
								<div className="flex justify-between text-sm text-muted-foreground">
									<span>Subtotal:</span>
									<span>${cartTotal.toFixed(2)}</span>
								</div>
								<div className="flex justify-between text-sm text-muted-foreground">
									<span>Descuento:</span>
									<span>- ${Math.min(descuento, cartTotal).toFixed(2)}</span>
								</div>
								<Separator />
								<div className="flex justify-between items-center w-full">
									<span className="text-lg font-medium">Total:</span>
									<motion.span
										className="text-xl font-bold text-primary"
										key={totalConDescuento}
										initial={reduceMotion ? false : { scale: 1.2 }}
										animate={reduceMotion ? undefined : { scale: 1 }}
										transition={{ type: 'spring', stiffness: 300, damping: 20 }}
									>
										${totalConDescuento.toFixed(2)}
									</motion.span>
								</div>
							</motion.div>

							<motion.div
								className="w-full"
								whileHover={reduceMotion ? undefined : { scale: 1.02 }}
								whileTap={reduceMotion ? undefined : { scale: 0.98 }}
							>
								<Button
									className="w-full bg-linear-to-r from-orange-500 to-red-600 hover:from-orange-500/90 hover:to-red-600/90 text-white"
									size="lg"
									ref={checkoutButtonRef}
									disabled={cart.length === 0 || isProcessing}
									onClick={() => setIsCheckoutOpen(true)}
								>
									{isProcessing ? (
										<>
											<Loader2 className="mr-2 h-4 w-4 animate-spin" />
											Procesando...
										</>
									) : (
										'Cobrar venta'
									)}
								</Button>
							</motion.div>
						</CardFooter>
					</Card>
				</motion.div>
			</div>

				{/* === Checkout diálogo === */}
				<PosDemoDialog
					open={isCheckoutOpen || isProcessing}
					onOpenChange={(open) => {
						if (!isProcessing) setIsCheckoutOpen(open);
					}}
					title="Cerrar venta — demo"
					description="Seleccione la forma de pago y confirme la venta demo."
					className="max-w-md"
				>
								<Card>
								<CardHeader>
									<CardTitle className="flex items-center gap-2">
										<ShoppingCart className="h-5 w-5 text-primary" />
										Cerrar venta — demo
									</CardTitle>
								</CardHeader>
								<CardContent className="space-y-4">
										<div className="space-y-2">
											<Label className="text-sm font-medium" id="demo-payment-label">
												Forma de pago
											</Label>
											<RadioGroup
												aria-labelledby="demo-payment-label"
												value={formaPago}
												onValueChange={(value) => setFormaPago(value as FormaPago)}
												className="grid grid-cols-1 gap-2 sm:grid-cols-3"
											>
												{FORMAS_PAGO.map((fp) => {
													const selected = formaPago === fp.id;
													return (
														<Label
															key={fp.id}
															className={`flex min-h-11 cursor-pointer items-center gap-2 rounded-lg border-2 p-3 text-sm font-medium transition-all duration-200 ${
																selected
																	? 'border-primary bg-primary/10 text-primary'
																	: 'border-border hover:border-primary/40'
															}`}
														>
															<RadioGroupItem
																value={fp.id}
																aria-label={fp.label}
																className="shrink-0"
															/>
															{fp.label}
														</Label>
													);
												})}
											</RadioGroup>
										</div>
									<Separator />
									<div className="space-y-1">
										<div className="flex justify-between text-sm">
											<span className="text-muted-foreground">Cantidad de ítems:</span>
											<span className="font-medium">
												{cart.reduce((a, i) => a + i.cantidad, 0)}
											</span>
										</div>
										<div className="flex justify-between text-sm">
											<span className="text-muted-foreground">Subtotal:</span>
											<span>${cartTotal.toFixed(2)}</span>
										</div>
										<div className="flex justify-between text-sm">
											<span className="text-muted-foreground">Descuento:</span>
											<span>- ${Math.min(descuento, cartTotal).toFixed(2)}</span>
										</div>
										<Separator />
										<div className="flex justify-between items-center pt-1">
											<span className="text-base font-medium">Total:</span>
											<span className="text-lg font-bold text-primary">
												${totalConDescuento.toFixed(2)}
											</span>
										</div>
									</div>
									{observaciones && (
										<div className="rounded-md bg-muted/60 p-2 text-xs text-muted-foreground">
											<strong>Obs:</strong> {observaciones}
										</div>
									)}
									<div className="rounded-md bg-primary/5 border border-primary/20 p-2 text-[11px] text-muted-foreground">
										Demo sin persistencia. La venta no afecta stock ni contabilidad.
									</div>
								</CardContent>
								<CardFooter className="flex gap-2">
									<Button
										variant="outline"
										className="flex-1"
										onClick={() => !isProcessing && setIsCheckoutOpen(false)}
										disabled={isProcessing}
									>
										Cancelar
									</Button>
									<motion.div
										className="flex-1"
										whileHover={reduceMotion ? undefined : { scale: 1.02 }}
										whileTap={reduceMotion ? undefined : { scale: 0.98 }}
									>
										<Button
											className="w-full bg-linear-to-r from-orange-500 to-red-600 hover:from-orange-500/90 hover:to-red-600/90 text-white"
											onClick={processDemoVenta}
											disabled={isProcessing}
										>
											{isProcessing ? (
												<>
													<Loader2 className="mr-2 h-4 w-4 animate-spin" />
													Procesando...
												</>
											) : (
												'Confirmar venta'
											)}
										</Button>
									</motion.div>
								</CardFooter>
								</Card>
				</PosDemoDialog>

				{/* === Ticket post-venta === */}
				<PosDemoDialog
					open={ticket !== null}
					onOpenChange={(open) => {
						if (!open) setTicket(null);
					}}
					title="Venta registrada"
					description="Resumen del ticket demo emitido."
					className="max-w-sm"
				>
					{ticket && (
								<Card className="relative overflow-hidden">
								<div className="h-1 bg-linear-to-r from-emerald-500 to-emerald-700" />
								<CardHeader className="text-center pb-2">
									<motion.div
										className="mx-auto mb-2 flex h-12 w-12 items-center justify-center rounded-full bg-emerald-500/15"
										initial={reduceMotion ? false : { scale: 0, rotate: 0 }}
										animate={reduceMotion ? undefined : { scale: 1, rotate: [0, 8, -8, 0] }}
										transition={{
											delay: 0.1,
											scale: { type: 'spring', stiffness: 300, damping: 12 },
											rotate: {
												duration: 0.6,
												ease: 'easeInOut',
												delay: 0.4,
											},
										}}
									>
										<Package className="h-6 w-6 text-emerald-500" />
									</motion.div>
									<CardTitle className="text-base">¡Venta registrada!</CardTitle>
									<p className="text-xs text-muted-foreground font-mono">
										Ticket #{ticket.id}
									</p>
								</CardHeader>
								<CardContent className="space-y-2 text-sm">
									<div className="flex justify-between">
										<span className="text-muted-foreground">Forma de pago:</span>
										<span className="capitalize">{ticket.formaPago}</span>
									</div>
									<div className="flex justify-between">
										<span className="text-muted-foreground">Ítems:</span>
										<span>{ticket.items}</span>
									</div>
									<div className="flex justify-between">
										<span className="text-muted-foreground">Fecha:</span>
										<span className="text-xs">{ticket.createdAt}</span>
									</div>
									<Separator />
									<div className="flex justify-between items-center pt-1">
										<span className="font-medium">Total:</span>
										<span className="text-xl font-bold text-emerald-700 dark:text-emerald-400">
											${ticket.total.toFixed(2)}
										</span>
									</div>
									<div className="rounded-md bg-muted/60 p-2 text-[11px] text-muted-foreground text-center">
										Este es un ticket simulado. En la versión real se emite factura
										y se descuenta stock automáticamente.
									</div>
								</CardContent>
								<CardFooter>
									<Button
										className="w-full"
										variant="outline"
										onClick={() => setTicket(null)}
									>
										Cerrar y seguir probando
									</Button>
									</CardFooter>
								</Card>
						)}
				</PosDemoDialog>

			{/* === Diálogo de apertura de turno (demo) === */}
			<DemoAperturaTurnoDialog
				open={isAperturaDialogOpen}
				onOpenChange={setIsAperturaDialogOpen}
				puntoDeVentaNombre={selectedPuntoVenta.nombre}
				 onSuccess={(turno) => {
					setTurnoActivo(turno);
					setVentasItems([]);
					setVentasTickets([]);
					setUltimoArqueo(null);
				}}
			/>

			{/* === Diálogo de cierre de turno (real, UI puro) === */}
			{turnoActivo && (
				<CierreTurnoDialog
					open={isCierreDialogOpen}
					onOpenChange={(open) => {
						if (!open) resetTurnoFlow();
						else setIsCierreDialogOpen(true);
					}}
					totalVentas={totalVentaTurno}
					totalTickets={totalTicketsTurno}
					onIrAArqueo={() => {
						setIsCierreDialogOpen(false);
						setIsArqueoDialogOpen(true);
					}}
				/>
			)}

			{/* === Formulario de arqueo (demo) === */}
			<DemoArqueoForm
				open={isArqueoDialogOpen}
				onOpenChange={setIsArqueoDialogOpen}
				turno={turnoActivo}
				ventasPorFormaPago={ventasPorFormaPago}
				submitLabel="Continuar con el Cuadre"
				onSuccess={(resultado) => {
					setUltimoArqueo(resultado);
					setIsArqueoDialogOpen(false);
					setIsCuadreDialogOpen(true);
				}}
			/>

			{/* === Diálogo de cuadre (demo) === */}
			<DemoCuadreTurnoDialog
				open={isCuadreDialogOpen}
				onOpenChange={(open) => {
					if (!open) resetTurnoFlow();
					else setIsCuadreDialogOpen(true);
				}}
				turno={turnoActivo}
				arqueo={ultimoArqueo}
				productos={DEMO_PRODUCTOS}
				ventasItems={ventasItems}
				totalVentaTurno={totalVentaTurno}
				onRepetirArqueo={() => {
					setIsCuadreDialogOpen(false);
					setIsArqueoDialogOpen(true);
				}}
					onSuccess={() => {
					setIsCuadreDialogOpen(false);
					setTurnoActivo(null);
					setVentasItems([]);
					setVentasTickets([]);
					setUltimoArqueo(null);
				}}
			/>

				<Skeleton className="hidden" />
				</div>
			</div>
	);
}
