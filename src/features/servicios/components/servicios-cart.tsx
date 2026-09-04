"use client";

import { useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { Input } from "@/components/ui/input";
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogFooter,
	DialogHeader,
	DialogTitle,
} from "@/components/ui/dialog";
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@/components/ui/select";
import {
	Tabs,
	TabsContent,
	TabsList,
	TabsTrigger,
} from "@/components/ui/tabs";
import { formatCurrency } from "@/lib/utils";
import { resumirCarritoPorMoneda, monedasOrdenadas } from "@/features/servicios/lib/carrito-resumen";
import { createVentaServicioAction } from "@/features/venta-servicios/actions";
import { createCompraServicioAction } from "@/features/compras-servicios/actions";
import { useClientes } from "@/features/clientes/hooks/use-clientes";
import { useVendors } from "@/features/vendors/hooks/use-vendors";
import { toast } from "sonner";
import { CreditCard, Plus, Minus, X, ShoppingCart } from "lucide-react";

interface ServicioItem {
	cartItemId: string;
	servicioId: string;
	nombre: string;
	precio: number;
	costo: number;
	descripcion: string;
	cantidad: number;
	moneda?: string;
}

interface ServiciosCartProps {
	cart: ServicioItem[];
	setCart: React.Dispatch<React.SetStateAction<ServicioItem[]>>;
	isOpen: boolean;
	onOpenChange: (open: boolean) => void;
}

export default function ServiciosCart({
	cart,
	setCart,
	isOpen,
	onOpenChange,
}: ServiciosCartProps) {
	const { clientes } = useClientes();
	const { vendors } = useVendors();
	const [selectedClienteId, setSelectedClienteId] = useState<string>("");
	const [observaciones, setObservaciones] = useState<string>("");
	const [isProcessing, setIsProcessing] = useState(false);
	// Modo: venta (registra VentaServicio) o compra (registra CompraServicio).
	const [mode, setMode] = useState<"VENTA" | "COMPRA">("VENTA");
	const [selectedProveedorId, setSelectedProveedorId] = useState<string>("");
	const [numeroFactura, setNumeroFactura] = useState<string>("");
	const [formaPago, setFormaPago] = useState<"PAGO_COMPLETO" | "PAGO_PARCIAL">(
		"PAGO_COMPLETO",
	);

	// El carrito puede mezclar monedas: los totales se calculan agrupados por
	// moneda y nunca se suman importes cruzados.
	const resumen = useMemo(() => resumirCarritoPorMoneda(cart), [cart]);

	// Remover servicio del carrito
	const removeFromCart = (cartItemId: string) => {
		setCart(cart.filter((item) => item.cartItemId !== cartItemId));
	};

	// Actualizar cantidad de servicio en carrito
	const updateQuantity = (cartItemId: string, newQuantity: number) => {
		if (newQuantity < 1) return;

		setCart(
			cart.map((item) =>
				item.cartItemId === cartItemId
					? { ...item, cantidad: newQuantity }
					: item,
			),
		);
	};

	// Actualizar precio de servicio en carrito
	const updatePrice = (cartItemId: string, newPrice: number) => {
		if (newPrice < 0) return;

		setCart(
			cart.map((item) =>
				item.cartItemId === cartItemId ? { ...item, precio: newPrice } : item,
			),
		);
	};

	// Actualizar costo de servicio en carrito
	const updateCosto = (cartItemId: string, newCosto: number) => {
		if (newCosto < 0) return;

		setCart(
			cart.map((item) =>
				item.cartItemId === cartItemId ? { ...item, costo: newCosto } : item,
			),
		);
	};

	// Procesar venta o compra de servicios (batch por modo)
	const processCarrito = async () => {
		if (cart.length === 0) {
			toast.error("Añada servicios al carrito para continuar");
			return;
		}

		if (mode === "VENTA" && !selectedClienteId) {
			toast.error("Seleccione un cliente para continuar");
			return;
		}
		if (mode === "COMPRA" && !selectedProveedorId) {
			toast.error("Seleccione un proveedor para continuar");
			return;
		}

		setIsProcessing(true);
		try {
			if (mode === "VENTA") {
				const result = await createVentaServicioAction({
					clienteId: selectedClienteId,
					observaciones: observaciones || undefined,
					lineas: cart.map((item) => ({
						tipoLinea: 'SERVICIO' as const,
						servicioId: item.servicioId,
						cantidad: item.cantidad,
						precioUnitario: Math.round(item.precio),
						costo: Math.round(item.costo),
					})),
				});
				if (!result.success) {
					throw new Error(result.error?.message ?? "Error desconocido");
				}
			} else {
				// Compra: cada línea del carrito se vuelve un registro CompraServicio.
				await Promise.all(
					cart.map((item) =>
						createCompraServicioAction({
							servicioId: item.servicioId,
							cantidad: item.cantidad,
							costoUnitario: Math.round(item.costo),
							proveedorId: selectedProveedorId || null,
							numeroFactura: numeroFactura || null,
							formaPago,
							estado: formaPago === "PAGO_COMPLETO" ? "PAGADA" : "PENDIENTE",
							anticipos: undefined,
						}).then((r) => {
							if (!r.success) {
								throw new Error(r.error?.message ?? "Error desconocido");
							}
						}),
					),
				);
			}

			toast.success(
				mode === "VENTA"
					? "Venta de servicios procesada exitosamente"
					: "Compra de servicios registrada exitosamente",
			);
			setCart([]);
			setSelectedClienteId("");
			setSelectedProveedorId("");
			setNumeroFactura("");
			setObservaciones("");
			setMode("VENTA");
			onOpenChange(false);
		} catch (error) {
			console.error("Error al procesar el carrito:", error);
			toast.error(
				"Hubo un error al procesar. El carrito se ha preservado para reintentar.",
			);
		} finally {
			setIsProcessing(false);
		}
	};

	const isCartEmpty = cart.length === 0;

	return (
		<Dialog open={isOpen} onOpenChange={onOpenChange}>
			<DialogContent className="sm:max-w-4xl max-h-[90vh] overflow-hidden flex flex-col">
				<DialogHeader>
					<DialogTitle className="flex items-center gap-2">
						<ShoppingCart className="h-5 w-5" />
						Carrito de Servicios ({cart.length})
					</DialogTitle>
								<DialogDescription>
									{mode === "VENTA"
										? "Revise y procese la venta de servicios"
										: "Registre servicios recibidos (egresos)"}
								</DialogDescription>
				</DialogHeader>

				<div className="flex-1 overflow-y-auto">
					{isCartEmpty ? (
						<div className="text-center py-12">
							<ShoppingCart className="mx-auto h-16 w-16 text-muted-foreground mb-4" />
							<h3 className="text-lg font-medium mb-2">
								Su carrito está vacío
							</h3>
							<p className="text-muted-foreground">
								Agregue servicios al carrito para continuar
							</p>
						</div>
					) : (
						<div className="space-y-4">
							{/* Lista de productos en el carrito */}
							<div className="rounded-md border">
								<div className="grid grid-cols-12 p-4 text-sm font-medium bg-muted/50">
									<div className="col-span-3">Servicio</div>
									<div className="col-span-2 text-center">Precio</div>
									<div className="col-span-2 text-center">Costo</div>
									<div className="col-span-2 text-center">Cantidad</div>
									<div className="col-span-2 text-center">Subtotal</div>
									<div className="col-span-1 text-right">Acciones</div>
								</div>
								<Separator />
								{cart.map((item) => (
									<div
										key={item.cartItemId}
										className="grid grid-cols-12 p-4 items-center"
									>
										<div className="col-span-3">
											<div className="font-medium">{item.nombre}</div>
											<div className="text-sm text-muted-foreground line-clamp-1">
												{item.descripcion}
											</div>
										</div>
										<div className="col-span-2 flex justify-center">
											<div className="relative w-24">
												<span className="absolute left-2 top-1/2 -translate-y-1/2 text-muted-foreground text-sm">
													$
												</span>
												<Input
													type="number"
													min={0}
													step={1}
													aria-label={`Precio de ${item.nombre}`}
													value={item.precio}
													onChange={(e) =>
														updatePrice(item.cartItemId, Number(e.target.value))
													}
													className="pl-6 h-8 text-center text-sm"
												/>
											</div>
										</div>
										<div className="col-span-2 flex justify-center">
											<div className="relative w-24">
												<span className="absolute left-2 top-1/2 -translate-y-1/2 text-muted-foreground text-sm">
													$
												</span>
												<Input
													type="number"
													min={0}
													step={1}
													aria-label={`Costo de ${item.nombre}`}
													value={item.costo}
													onChange={(e) =>
														updateCosto(item.cartItemId, Number(e.target.value))
													}
													className="pl-6 h-8 text-center text-sm"
												/>
											</div>
										</div>
										<div className="col-span-2 flex justify-center items-center space-x-1">
											<Button
												variant="outline"
												size="icon"
												className="h-7 w-7"
												aria-label={`Restar una unidad de ${item.nombre}`}
												onClick={() =>
													updateQuantity(item.cartItemId, item.cantidad - 1)
												}
												disabled={item.cantidad <= 1}
											>
												<Minus className="h-3 w-3" />
											</Button>
											<span className="w-6 text-center font-medium text-sm">
												{item.cantidad}
											</span>
											<Button
												variant="outline"
												size="icon"
												className="h-7 w-7"
												aria-label={`Sumar una unidad de ${item.nombre}`}
												onClick={() =>
													updateQuantity(item.cartItemId, item.cantidad + 1)
												}
											>
												<Plus className="h-3 w-3" />
											</Button>
										</div>
										<div className="col-span-2 text-center font-medium text-sm">
											{formatCurrency(item.precio * item.cantidad, item.moneda)}
										</div>
										<div className="col-span-1 text-right">
											<Button
												variant="ghost"
												size="icon"
												aria-label={`Quitar ${item.nombre} del carrito`}
												onClick={() => removeFromCart(item.cartItemId)}
												className="text-destructive hover:text-destructive"
											>
												<X className="h-4 w-4" />
											</Button>
										</div>
										<Separator className="col-span-12 mt-4" />
									</div>
								))}
							</div>

									<div className="rounded-md border p-4">
										<div className="mb-2 text-xs font-semibold uppercase text-muted-foreground tracking-wider">
											Tipo de operación
										</div>
										<Tabs
											value={mode}
											onValueChange={(v) => setMode(v as "VENTA" | "COMPRA")}
										>
											<TabsList className="w-full">
												<TabsTrigger value="VENTA" className="flex-1">
													Venta
												</TabsTrigger>
												<TabsTrigger value="COMPRA" className="flex-1">
													Compra (servicio recibido)
												</TabsTrigger>
											</TabsList>
										</Tabs>
									</div>

									{/* Venta: cliente + observaciones */}
									{mode === "VENTA" && (
										<div className="grid grid-cols-1 md:grid-cols-2 gap-4">
											<div className="space-y-2">
												<h4 className="font-medium">Cliente *</h4>
												<Select
													value={selectedClienteId}
													onValueChange={setSelectedClienteId}
												>
													<SelectTrigger>
														<SelectValue placeholder="Seleccione un cliente" />
													</SelectTrigger>
													<SelectContent>
														{clientes?.map((cliente) => (
															<SelectItem
																key={cliente.clienteId}
																value={cliente.clienteId}
															>
																{cliente.nombre}
															</SelectItem>
														))}
													</SelectContent>
												</Select>
											</div>

											<div className="space-y-2">
												<h4 className="font-medium">Observaciones</h4>
												<Input
													placeholder="Observaciones adicionales"
													value={observaciones}
													onChange={(e) => setObservaciones(e.target.value)}
												/>
											</div>
										</div>
									)}

									{/* Compra: proveedor, factura y forma de pago */}
									{mode === "COMPRA" && (
										<div className="space-y-4">
											<div className="grid grid-cols-1 md:grid-cols-2 gap-4">
												<div className="space-y-2">
													<h4 className="font-medium">Proveedor *</h4>
													<Select
														value={selectedProveedorId}
														onValueChange={setSelectedProveedorId}
													>
														<SelectTrigger>
															<SelectValue placeholder="Seleccione un proveedor" />
														</SelectTrigger>
														<SelectContent>
															{vendors?.map((vendor: any) =>
																vendor.vendorId ? (
																	<SelectItem
																		key={vendor.vendorId}
																		value={vendor.vendorId}
																	>
																		{vendor.nombre}
																	</SelectItem>
																) : null,
															)}
														</SelectContent>
													</Select>
												</div>

												<div className="space-y-2">
													<h4 className="font-medium">No. de factura</h4>
													<Input
														placeholder="Ej: F-2026-001 (opcional)"
														value={numeroFactura}
														onChange={(e) =>
															setNumeroFactura(e.target.value)
														}
													/>
												</div>
											</div>

											<div className="grid grid-cols-1 md:grid-cols-2 gap-4">
												<div className="space-y-2">
													<h4 className="font-medium">Forma de pago</h4>
													<Select
														value={formaPago}
														onValueChange={(v) =>
															setFormaPago(
																v as "PAGO_COMPLETO" | "PAGO_PARCIAL",
															)
														}
													>
														<SelectTrigger>
															<SelectValue />
														</SelectTrigger>
														<SelectContent>
															<SelectItem value="PAGO_COMPLETO">
																Pago completo
															</SelectItem>
															<SelectItem value="PAGO_PARCIAL">
																Pago parcial
															</SelectItem>
														</SelectContent>
													</Select>
												</div>

												<div className="space-y-2">
													<h4 className="font-medium text-muted-foreground text-sm">
														Precio unitario = costo actual del ítem
													</h4>
													<p className="text-sm text-muted-foreground">
														El costo del carrito del servicio marca el
														costoUnitario de la compra. Cantidad viene
														de la línea.
													</p>
												</div>
											</div>
										</div>
									)}

									{/* Resumen de la venta, agrupado por moneda */}
							<div className="space-y-4">
								{monedasOrdenadas(resumen.monedas).map((moneda) => {
									const g = resumen.grupos[moneda];
									const itemsMoneda = cart.filter(
										(i) => (i.moneda ?? 'CUP').trim().toUpperCase() === moneda,
									);
									return (
										<div key={moneda} className="rounded-md border p-4 bg-muted/50">
											<h4 className="font-medium mb-3">
												Resumen de {mode === 'VENTA' ? 'la Venta' : 'la Compra'}{resumen.esMultiMoneda ? ` (${moneda})` : ''}
											</h4>
											<div className="space-y-2">
												{itemsMoneda.map((item) => (
													<div
														key={item.cartItemId}
														className="flex justify-between text-sm"
													>
														<span>
															{item.nombre} x{item.cantidad}
														</span>
														<span>{formatCurrency(item.precio * item.cantidad, moneda)}</span>
													</div>
												))}
												<Separator className="my-2" />
												<div className="flex justify-between text-sm">
													<span className="text-muted-foreground">Costo Total</span>
													<span>{formatCurrency(g.costoTotal, moneda)}</span>
												</div>
												<div className="flex justify-between text-sm font-medium">
													<span className="text-muted-foreground">Margen</span>
													<span>{formatCurrency(g.margen, moneda)}</span>
												</div>
												<Separator className="my-2" />
												<div className="flex justify-between font-bold text-lg">
													<span>Total</span>
													<span>{formatCurrency(g.total, moneda)}</span>
												</div>
											</div>
										</div>
									);
								})}
							</div>
						</div>
					)}
				</div>

				<DialogFooter className="flex gap-2">
					<Button
						variant="outline"
						onClick={() => onOpenChange(false)}
						disabled={isProcessing}
					>
						Cerrar
					</Button>
					<Button
						onClick={processCarrito}
						disabled={
							isCartEmpty ||
							isProcessing ||
							(mode === "VENTA" && !selectedClienteId) ||
							(mode === "COMPRA" && !selectedProveedorId)
						}
						className="min-w-35"
					>
						{isProcessing ? (
							<>Procesando...</>
						) : (
							<>
								<CreditCard className="mr-2 h-4 w-4" />
								{mode === "VENTA" ? "Confirmar Venta" : "Registrar Compra"}
							</>
						)}
					</Button>
				</DialogFooter>
			</DialogContent>
		</Dialog>
	);
}
