"use client";

export const dynamic = "force-dynamic";

import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import {
	Plus,
	Edit,
	Trash2,
	DollarSign,
	Users,
	Archive,
	Package,
	Search,
	CheckCircle2,
	XCircle,
	Save,
	X,
	Building2,
	FileText,
	Shield,
	ChevronDown,
	ChevronUp,
	Clock,
} from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogFooter,
	DialogHeader,
	DialogTitle,
} from "@/components/ui/dialog";
import {
	Table,
	TableBody,
	TableCell,
	TableHead,
	TableHeader,
	TableRow,
} from "@/components/ui/table";
import {
	Tooltip,
	TooltipContent,
	TooltipProvider,
	TooltipTrigger,
} from "@/components/ui/tooltip";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import {
	getAdminPlanesAction,
	createAdminPlanAction,
	updateAdminPlanAction,
	deleteAdminPlanAction,
} from "@/features/admin";
import {
	FEATURE_REGISTRY,
	CATEGORY_LABELS,
	CATEGORY_ORDER,
	getFeaturesGrouped,
} from "@/features/planes";
import type { FeatureDef, FeatureCategory } from "@/features/planes";

/* ─── Types ─── */

interface PlanFormData {
	nombre: string;
	descripcion: string;
	precio: string;
	duracionDias: string;
	maxUsuarios: string;
	maxAlmacenes: string;
	maxProductos: string;
	maxClientes: string;
	maxPuntosVenta: string;
	maxFacturasMes: string;
	maxContratos: string;
	incluyeBackups: boolean;
	features: Record<string, boolean>;
}

const defaultFormData: PlanFormData = {
	nombre: "",
	descripcion: "",
	precio: "0",
	duracionDias: "30",
	maxUsuarios: "1",
	maxAlmacenes: "1",
	maxProductos: "100",
	maxClientes: "200",
	maxPuntosVenta: "1",
	maxFacturasMes: "200",
	maxContratos: "0",
	incluyeBackups: false,
	features: {},
};

/* ─── Component ─── */

export default function AdminPlanesPage() {
	const [search, setSearch] = useState("");
	const [dialogOpen, setDialogOpen] = useState(false);
	const [editingPlan, setEditingPlan] = useState<any>(null);
	const [formData, setFormData] = useState<PlanFormData>(defaultFormData);
	const [expandedCats, setExpandedCats] = useState<Set<FeatureCategory>>(
		new Set(CATEGORY_ORDER),
	);

	const [data, setData] = useState<any>(null);
	const [isLoading, setIsLoading] = useState(true);

	useEffect(() => {
		setIsLoading(true);
		getAdminPlanesAction().then((r) => {
			if (r.success)
				setData({ planes: r.data, total: (r.data as any)?.length || 0 });
			setIsLoading(false);
		});
	}, []);

	const planes = data?.planes || [];

	const groupedFeatures = getFeaturesGrouped();

	function resetForm() {
		setFormData(defaultFormData);
		setEditingPlan(null);
	}

	function openEdit(plan: any) {
		const featuresRaw = plan.features || {};
		const features: Record<string, boolean> =
			typeof featuresRaw === "object" && !Array.isArray(featuresRaw)
				? featuresRaw
				: {};

		setEditingPlan(plan);
		setFormData({
			nombre: plan.nombre,
			descripcion: plan.descripcion || "",
			precio: String(plan.precio),
			duracionDias: String(plan.duracionDias),
			maxUsuarios: String(plan.maxUsuarios),
			maxAlmacenes: String(plan.maxAlmacenes),
			maxProductos: String(plan.maxProductos),
			maxClientes: String(plan.maxClientes ?? 200),
			maxPuntosVenta: String(plan.maxPuntosVenta ?? 1),
			maxFacturasMes: String(plan.maxFacturasMes ?? 200),
			maxContratos: String(plan.maxContratos ?? 0),
			incluyeBackups: plan.incluyeBackups ?? false,
			features,
		});
		setDialogOpen(true);
	}

	function toggleFeature(key: string) {
		setFormData((prev) => ({
			...prev,
			features: { ...prev.features, [key]: !prev.features[key] },
		}));
	}

	function toggleCategory(cat: FeatureCategory) {
		setExpandedCats((prev) => {
			const next = new Set(prev);
			if (next.has(cat)) next.delete(cat);
			else next.add(cat);
			return next;
		});
	}

	function enableAllInCategory(cat: FeatureCategory) {
		const features = groupedFeatures[cat];
		if (!features) return;
		setFormData((prev) => {
			const updated = { ...prev.features };
			for (const f of features) updated[f.key] = true;
			return { ...prev, features: updated };
		});
	}

	function disableAllInCategory(cat: FeatureCategory) {
		const features = groupedFeatures[cat];
		if (!features) return;
		setFormData((prev) => {
			const updated = { ...prev.features };
			for (const f of features) updated[f.key] = false;
			return { ...prev, features: updated };
		});
	}

	function buildPayload() {
		return {
			nombre: formData.nombre,
			descripcion: formData.descripcion || null,
			precio: formData.precio ? parseFloat(formData.precio) : 0,
			duracionDias: parseInt(formData.duracionDias) || 30,
			maxUsuarios: parseInt(formData.maxUsuarios) || 1,
			maxAlmacenes: parseInt(formData.maxAlmacenes) || 1,
			maxProductos: parseInt(formData.maxProductos) || 100,
			maxClientes: parseInt(formData.maxClientes) || 200,
			maxPuntosVenta: parseInt(formData.maxPuntosVenta) || 1,
			maxFacturasMes: parseInt(formData.maxFacturasMes) || 200,
			maxContratos: parseInt(formData.maxContratos) || 0,
			incluyeBackups: formData.incluyeBackups,
			features: formData.features,
		};
	}

	async function handleSave() {
		try {
			const body = buildPayload();

			if (editingPlan) {
				const r = await updateAdminPlanAction({
					planId: editingPlan.planId,
					...body,
				});
				if (r.success) {
					toast.success("Plan actualizado");
					resetForm();
					refreshData();
				} else {
					toast.error(r.error?.message || "Error");
				}
			} else {
				const r = await createAdminPlanAction(body);
				if (r.success) {
					toast.success("Plan creado");
					resetForm();
					refreshData();
				} else {
					toast.error(r.error?.message || "Error");
				}
			}
		} catch (error: any) {
			toast.error(error.data?.error || "Error guardando plan");
		}
	}

	async function handleDelete(planId: string) {
		if (!confirm("¿Eliminar este plan? Esta acción no se puede deshacer."))
			return;
		try {
			const r = await deleteAdminPlanAction(planId);
			if (r.success) {
				toast.success("Plan eliminado");
				refreshData();
			} else {
				toast.error(r.error?.message || "Error");
			}
		} catch (error: any) {
			toast.error(error.data?.error || "Error eliminando plan");
		}
	}

	function refreshData() {
		setDialogOpen(false);
		getAdminPlanesAction().then((r) => {
			if (r.success)
				setData({ planes: r.data, total: (r.data as any)?.length || 0 });
		});
	}

	const enabledCount = (plan: any) => {
		const f = plan.features || {};
		return Object.values(f).filter(Boolean).length;
	};

	const totalFeatures = FEATURE_REGISTRY.length;

	return (
		<div className="space-y-6 p-6">
			{/* Header */}
			<motion.div
				initial={{ opacity: 0, y: -10 }}
				animate={{ opacity: 1, y: 0 }}
				className="flex justify-between items-center"
			>
				<div>
					<h1 className="text-3xl font-bold tracking-tight">Planes</h1>
					<p className="text-muted-foreground">
						Gestión de planes de suscripción con módulos y límites
					</p>
				</div>
				<Button
					onClick={() => {
						resetForm();
						setDialogOpen(true);
					}}
				>
					<Plus className="mr-2 h-4 w-4" />
					Nuevo Plan
				</Button>
			</motion.div>

			{/* Search */}
			<div className="relative max-w-md">
				<Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
				<Input
					placeholder="Buscar planes..."
					value={search}
					onChange={(e) => setSearch(e.target.value)}
					className="pl-10"
				/>
			</div>

			{/* Tabla */}
			<div className="rounded-xl border overflow-hidden">
				<Table>
					<TableHeader>
						<TableRow>
							<TableHead>Plan</TableHead>
							<TableHead>Precio</TableHead>
							<TableHead>Duración</TableHead>
							<TableHead>Límites</TableHead>
							<TableHead>Módulos</TableHead>
							<TableHead>Backups</TableHead>
							<TableHead className="text-right">Acciones</TableHead>
						</TableRow>
					</TableHeader>
					<TableBody>
						{isLoading ? (
							<TableRow>
								<TableCell colSpan={7} className="h-24 text-center">
									Cargando...
								</TableCell>
							</TableRow>
						) : !planes?.length ? (
							<TableRow>
								<TableCell
									colSpan={7}
									className="h-24 text-center text-muted-foreground"
								>
									No hay planes configurados
								</TableCell>
							</TableRow>
						) : (
							planes.map((plan: any) => (
								<TableRow key={plan.planId}>
									<TableCell>
										<div>
											<div className="font-medium">{plan.nombre}</div>
											{plan.descripcion && (
												<div className="text-xs text-muted-foreground max-w-[200px] truncate">
													{plan.descripcion}
												</div>
											)}
										</div>
									</TableCell>
									<TableCell>
										<Badge
											variant={plan.precio === 0 ? "secondary" : "default"}
										>
											{plan.precio === 0
												? "Gratis"
												: `$${Number(plan.precio).toLocaleString()}/mes`}
										</Badge>
									</TableCell>
									<TableCell className="text-sm">
										{plan.duracionDias} días
									</TableCell>
									<TableCell>
										<div className="flex flex-wrap gap-2 text-xs text-muted-foreground">
											<TooltipProvider>
												<Tooltip>
													<TooltipTrigger>
														<span className="flex items-center gap-1 cursor-help">
															<Users className="h-3 w-3" />
															{plan.maxUsuarios}
														</span>
													</TooltipTrigger>
													<TooltipContent>Usuarios</TooltipContent>
												</Tooltip>
											</TooltipProvider>
											<TooltipProvider>
												<Tooltip>
													<TooltipTrigger>
														<span className="flex items-center gap-1 cursor-help">
															<Archive className="h-3 w-3" />
															{plan.maxAlmacenes}
														</span>
													</TooltipTrigger>
													<TooltipContent>Almacenes</TooltipContent>
												</Tooltip>
											</TooltipProvider>
											<TooltipProvider>
												<Tooltip>
													<TooltipTrigger>
														<span className="flex items-center gap-1 cursor-help">
															<Package className="h-3 w-3" />
															{plan.maxProductos === 999999
																? "∞"
																: plan.maxProductos}
														</span>
													</TooltipTrigger>
													<TooltipContent>Productos</TooltipContent>
												</Tooltip>
											</TooltipProvider>
											<TooltipProvider>
												<Tooltip>
													<TooltipTrigger>
														<span className="flex items-center gap-1 cursor-help">
															<Building2 className="h-3 w-3" />
															{plan.maxPuntosVenta ?? 1}
														</span>
													</TooltipTrigger>
													<TooltipContent>Puntos de venta</TooltipContent>
												</Tooltip>
											</TooltipProvider>
										</div>
									</TableCell>
									<TableCell>
										<Badge variant="outline" className="text-xs">
											{enabledCount(plan)} / {totalFeatures} módulos
										</Badge>
									</TableCell>
									<TableCell>
										{plan.incluyeBackups ? (
											<Badge
												variant="outline"
												className="bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/30 dark:text-emerald-400"
											>
												<Shield className="h-3 w-3 mr-1" />
												Sí
											</Badge>
										) : (
											<Badge
												variant="outline"
												className="text-muted-foreground"
											>
												No
											</Badge>
										)}
									</TableCell>
									<TableCell className="text-right">
										<div className="flex justify-end gap-2">
											<Button
												variant="outline"
												size="sm"
												onClick={() => openEdit(plan)}
											>
												<Edit className="h-4 w-4" />
											</Button>
											<Button
												variant="ghost"
												size="sm"
												onClick={() => handleDelete(plan.planId)}
												className="text-rose-500 hover:text-rose-600"
											>
												<Trash2 className="h-4 w-4" />
											</Button>
										</div>
									</TableCell>
								</TableRow>
							))
						)}
					</TableBody>
				</Table>
			</div>

			{/* Dialog */}
			<Dialog
				open={dialogOpen}
				onOpenChange={(open) => {
					if (!open) {
						setDialogOpen(false);
						resetForm();
					}
				}}
			>
				<DialogContent className="max-w-3xl max-h-[90vh]" onInteractOutside={(e) => e.preventDefault()}>
					<DialogHeader>
						<DialogTitle>
							{editingPlan ? "Editar Plan" : "Nuevo Plan"}
						</DialogTitle>
						<DialogDescription>
							{editingPlan
								? "Modificá los datos, límites y módulos del plan"
								: "Creá un nuevo plan de suscripción con sus módulos y límites"}
						</DialogDescription>
					</DialogHeader>

					<ScrollArea className="max-h-[calc(90vh-10rem)] pr-4">
						<div className="grid gap-6 py-2">
							{/* ─── Datos Básicos ─── */}
							<div className="space-y-4">
								<h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">
									Datos del Plan
								</h3>
								<div className="grid gap-4">
									<div className="grid grid-cols-2 gap-4">
										<div className="grid gap-2">
											<Label htmlFor="nombre">Nombre *</Label>
											<Input
												id="nombre"
												value={formData.nombre}
												onChange={(e) =>
													setFormData({ ...formData, nombre: e.target.value })
												}
												placeholder="Ej: Profesional"
											/>
										</div>
										<div className="grid gap-2">
											<Label htmlFor="precio">
												<DollarSign className="h-3 w-3 inline mr-1" />
												Precio (USD/mes)
											</Label>
											<Input
												id="precio"
												type="number"
												min="0"
												step="0.01"
												value={formData.precio}
												onChange={(e) =>
													setFormData({ ...formData, precio: e.target.value })
												}
											/>
										</div>
									</div>
									<div className="grid gap-2">
										<Label htmlFor="descripcion">Descripción</Label>
										<Textarea
											id="descripcion"
											value={formData.descripcion}
											onChange={(e) =>
												setFormData({
													...formData,
													descripcion: e.target.value,
												})
											}
											placeholder="Descripción del plan para la landing page"
											rows={2}
										/>
									</div>
									<div className="grid gap-2">
										<Label htmlFor="duracion">
											<Clock className="h-3 w-3 inline mr-1" />
											Duración (días) *
										</Label>
										<Input
											id="duracion"
											type="number"
											min="1"
											value={formData.duracionDias}
											onChange={(e) =>
												setFormData({
													...formData,
													duracionDias: e.target.value,
												})
											}
										/>
									</div>
								</div>
							</div>

							<Separator />

							{/* ─── Límites ─── */}
							<div className="space-y-4">
								<h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">
									Límites del Plan
								</h3>
								<div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
									<div className="grid gap-2">
										<Label htmlFor="maxUsuarios">
											<Users className="h-3 w-3 inline mr-1" />
											Usuarios
										</Label>
										<Input
											id="maxUsuarios"
											type="number"
											min="1"
											value={formData.maxUsuarios}
											onChange={(e) =>
												setFormData({
													...formData,
													maxUsuarios: e.target.value,
												})
											}
										/>
									</div>
									<div className="grid gap-2">
										<Label htmlFor="maxAlmacenes">
											<Archive className="h-3 w-3 inline mr-1" />
											Almacenes
										</Label>
										<Input
											id="maxAlmacenes"
											type="number"
											min="1"
											value={formData.maxAlmacenes}
											onChange={(e) =>
												setFormData({
													...formData,
													maxAlmacenes: e.target.value,
												})
											}
										/>
									</div>
									<div className="grid gap-2">
										<Label htmlFor="maxPuntosVenta">
											<Building2 className="h-3 w-3 inline mr-1" />
											Puntos de venta
										</Label>
										<Input
											id="maxPuntosVenta"
											type="number"
											min="1"
											value={formData.maxPuntosVenta}
											onChange={(e) =>
												setFormData({
													...formData,
													maxPuntosVenta: e.target.value,
												})
											}
										/>
									</div>
									<div className="grid gap-2">
										<Label htmlFor="maxProductos">
											<Package className="h-3 w-3 inline mr-1" />
											Productos
										</Label>
										<Input
											id="maxProductos"
											type="number"
											min="1"
											value={formData.maxProductos}
											onChange={(e) =>
												setFormData({
													...formData,
													maxProductos: e.target.value,
												})
											}
										/>
										<p className="text-[10px] text-muted-foreground">
											Usá 999999 para ilimitado
										</p>
									</div>
									<div className="grid gap-2">
										<Label htmlFor="maxClientes">
											<FileText className="h-3 w-3 inline mr-1" />
											Clientes
										</Label>
										<Input
											id="maxClientes"
											type="number"
											min="0"
											value={formData.maxClientes}
											onChange={(e) =>
												setFormData({
													...formData,
													maxClientes: e.target.value,
												})
											}
										/>
									</div>
									<div className="grid gap-2">
										<Label htmlFor="maxFacturasMes">
											<FileText className="h-3 w-3 inline mr-1" />
											Facturas/mes
										</Label>
										<Input
											id="maxFacturasMes"
											type="number"
											min="0"
											value={formData.maxFacturasMes}
											onChange={(e) =>
												setFormData({
													...formData,
													maxFacturasMes: e.target.value,
												})
											}
										/>
									</div>
									<div className="grid gap-2">
										<Label htmlFor="maxContratos">
											<FileText className="h-3 w-3 inline mr-1" />
											Contratos
										</Label>
										<Input
											id="maxContratos"
											type="number"
											min="0"
											value={formData.maxContratos}
											onChange={(e) =>
												setFormData({
													...formData,
													maxContratos: e.target.value,
												})
											}
										/>
									</div>
									<div className="flex items-end pb-2">
										<div className="flex items-center gap-2">
											<Switch
												id="incluyeBackups"
												checked={formData.incluyeBackups}
												onCheckedChange={(v) =>
													setFormData({ ...formData, incluyeBackups: v })
												}
											/>
											<Label
												htmlFor="incluyeBackups"
												className="cursor-pointer"
											>
												<Shield className="h-3 w-3 inline mr-1" />
												Incluye backups
											</Label>
										</div>
									</div>
								</div>
							</div>

							<Separator />

							{/* ─── Módulos / Features ─── */}
							<div className="space-y-4">
								<div className="flex items-center justify-between">
									<h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">
										Módulos del Sistema
									</h3>
									<Badge variant="outline" className="text-xs">
										{Object.values(formData.features).filter(Boolean).length} /{" "}
										{totalFeatures} activos
									</Badge>
								</div>

								<div className="space-y-3">
									{CATEGORY_ORDER.map((cat) => {
										const features = groupedFeatures[cat];
										if (!features || features.length === 0) return null;
										const isExpanded = expandedCats.has(cat);
										const activeInCat = features.filter(
											(f) => formData.features[f.key],
										).length;

										return (
											<Card key={cat} className="border-border/60">
												<CardHeader
													className="py-3 px-4 cursor-pointer hover:bg-muted/30 transition-colors"
													onClick={() => toggleCategory(cat)}
												>
													<div className="flex items-center justify-between">
														<div className="flex items-center gap-2">
															<CardTitle className="text-sm font-semibold">
																{CATEGORY_LABELS[cat]}
															</CardTitle>
															<Badge
																variant="secondary"
																className="text-[10px] px-1.5"
															>
																{activeInCat}/{features.length}
															</Badge>
														</div>
														<div className="flex items-center gap-2">
															<div className="flex gap-1">
																<Button
																	variant="ghost"
																	size="icon"
																	className="h-6 w-6"
																	onClick={(e) => {
																		e.stopPropagation();
																		enableAllInCategory(cat);
																	}}
																	title="Activar todos"
																>
																	<CheckCircle2 className="h-3.5 w-3.5 text-emerald-500" />
																</Button>
																<Button
																	variant="ghost"
																	size="icon"
																	className="h-6 w-6"
																	onClick={(e) => {
																		e.stopPropagation();
																		disableAllInCategory(cat);
																	}}
																	title="Desactivar todos"
																>
																	<XCircle className="h-3.5 w-3.5 text-muted-foreground" />
																</Button>
															</div>
															{isExpanded ? (
																<ChevronUp className="h-4 w-4 text-muted-foreground" />
															) : (
																<ChevronDown className="h-4 w-4 text-muted-foreground" />
															)}
														</div>
													</div>
												</CardHeader>
												{isExpanded && (
													<CardContent className="py-2 px-4">
														<div className="grid grid-cols-1 sm:grid-cols-2 gap-1">
															{features.map((feature: FeatureDef) => {
																const isActive =
																	formData.features[feature.key] ?? false;
																return (
																	<div
																		key={feature.key}
																		className="flex items-center justify-between py-1.5 px-2 rounded-md hover:bg-muted/30 transition-colors"
																	>
																		<div className="flex flex-col min-w-0">
																			<span className="text-sm font-medium truncate">
																				{feature.label}
																			</span>
																			<span className="text-[10px] text-muted-foreground truncate">
																				{feature.description}
																			</span>
																		</div>
																		<Switch
																			checked={isActive}
																			onCheckedChange={() =>
																				toggleFeature(feature.key)
																			}
																			className="ml-2 shrink-0"
																		/>
																	</div>
																);
															})}
														</div>
													</CardContent>
												)}
											</Card>
										);
									})}
								</div>
							</div>
						</div>
					</ScrollArea>

					<DialogFooter className="border-t pt-4 gap-2">
						<Button
							variant="outline"
							onClick={() => {
								setDialogOpen(false);
								resetForm();
							}}
						>
							<X className="h-4 w-4 mr-1" />
							Cancelar
						</Button>
						<Button
							onClick={handleSave}
							disabled={!formData.nombre || !formData.duracionDias}
						>
							<Save className="h-4 w-4 mr-1" />
							{editingPlan ? "Guardar Cambios" : "Crear Plan"}
						</Button>
					</DialogFooter>
				</DialogContent>
			</Dialog>
		</div>
	);
}
