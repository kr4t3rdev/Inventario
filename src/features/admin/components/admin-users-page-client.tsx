"use client";

import { useMemo, useState } from "react";
import type { LucideIcon } from "lucide-react";
import {
	AlertTriangle,
	Building2,
	Clock,
	Plus,
	RefreshCw,
	Shield,
	ShieldCheck,
	User,
} from "lucide-react";
import dynamic from "next/dynamic";
import { toast } from "sonner";

import { Usuario } from "@/app/models/model";
import { AdminUsersTable } from "@/features/admin/components/admin-users-table";
import { CreateUserDialog } from "@/features/admin/components/create-user-dialog";
import { EditUserDialog } from "@/features/admin/components/edit-user-dialog";
import { Button } from "@/components/ui/button";
import {
	Card,
	CardContent,
	CardDescription,
	CardHeader,
	CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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
	PageTransition,
	StaggerContainer,
	StaggerItem,
	AnimatedCard,
} from "@/components/ui/animations";
import { useAuth } from "@/contexts/auth-context";
import {
	addTenantMembershipAction,
	approveGlobalUserAction,
	getAdminPlanesAction,
	getAdminTenantsAction,
	getGlobalUsersAction,
} from "@/features/admin/actions";
import { LazyMotion, m as motion, type Variants } from "framer-motion";
import type { AdminUsersPageData } from "../server/data";
import { getTenantRoleLabel } from "@/lib/auth/roles";
import {
	SalesAgentPayoutDialog,
	type SalesAgentPayoutTarget,
} from "@/features/sales-agent/components/sales-agent-payout-dialog";

const UserAnalyticsPanel = dynamic(
	() =>
		import("@/features/admin/components/user-analytics-panel").then(
			(mod) => mod.UserAnalyticsPanel,
		),
	{ ssr: false },
);

const UserMonitoringPanel = dynamic(
	() =>
		import("@/features/admin/components/user-monitoring-panel").then(
			(mod) => mod.UserMonitoringPanel,
		),
	{ ssr: false },
);

interface AdminStatCard {
	title: string;
	value: number;
	description: string;
	icon: LucideIcon;
	valueClassName: string;
}

const headerIconVariants: Variants = {
	initial: { scale: 1, rotate: 0 },
	hover: {
		scale: 1.05,
		rotate: 5,
		transition: {
			type: "spring" as const,
			stiffness: 400,
			damping: 10,
		},
	},
};

const titleVariants: Variants = {
	hidden: { opacity: 0, y: -20 },
	visible: {
		opacity: 1,
		y: 0,
		transition: {
			type: "spring" as const,
			stiffness: 100,
			damping: 15,
		},
	},
};

/**
 * @description Client Component para la página de Admin Usuarios.
 * Recibe los datos iniciales del servidor y maneja toda la interactividad.
 */
export function AdminUsersPageClient({
	initialData,
}: {
	initialData: AdminUsersPageData | null;
}) {
	const { user } = useAuth();
	const [createDialogOpen, setCreateDialogOpen] = useState(false);
	const [editDialogOpen, setEditDialogOpen] = useState(false);
	const [approveDialogOpen, setApproveDialogOpen] = useState(false);
	const [selectedUser, setSelectedUser] = useState<Usuario | null>(null);
	const [approveUser, setSelectedApproveUser] = useState<Usuario | null>(null);
	const [selectedPlanId, setSelectedPlanId] = useState<string>("");
	const [tenantName, setTenantName] = useState<string>("");
	const [isApproving, setIsApproving] = useState(false);
	const [payoutTarget, setPayoutTarget] = useState<SalesAgentPayoutTarget | null>(null);

	// Multi-tenant: diálogo para añadir usuario a otra empresa
	const [addTenantDialogOpen, setAddTenantDialogOpen] = useState(false);
	const [addTenantUser, setAddTenantUser] = useState<Usuario | null>(null);
	const [addTenantId, setAddTenantId] = useState("");
	const [addTenantRole, setAddTenantRole] = useState("dependiente");
	const [addTenantSubmitting, setAddTenantSubmitting] = useState(false);
	const [tenantsList, setTenantsList] = useState<any[]>([]);

	// Estado de datos: arranca con initialData, se actualiza con refresh
	const [globalUsers, setGlobalUsers] = useState<any>(initialData);
	const [planesData, setPlanesData] = useState<any>(
		initialData?.planes ?? null,
	);

	const refresh = () => {
		getGlobalUsersAction({ limit: 100 })
			.then((r) => {
				if (r?.success) {
					setGlobalUsers(r.data);
				} else {
					toast.error(r?.error?.message ?? "Error al refrescar usuarios");
				}
			})
			.catch((err) => {
				console.error("Error al refrescar usuarios:", err);
				toast.error("Error de red al refrescar usuarios");
			});
		getAdminPlanesAction()
			.then((r) => {
				if (r?.success) {
					setPlanesData(r.data);
				} else {
					toast.error(r?.error?.message ?? "Error al refrescar planes");
				}
			})
			.catch((err) => {
				console.error("Error al refrescar planes:", err);
				toast.error("Error de red al refrescar planes");
			});
	};

	const [isRefreshing, setIsRefreshing] = useState(false);

	const safeUsers = globalUsers?.users ?? [];
	const total = globalUsers?.total ?? 0;
	const planes = planesData ?? [];

	// Stats calculadas en el cliente (pueden cambiar con refresh)
	const uniqueTenants = useMemo(
		() => new Set(safeUsers.map((u: any) => u.tenantId)).size,
		[safeUsers],
	);
	const activeUsers = safeUsers.filter(
		(candidate: any) => candidate.isActive,
	).length;
	const inactiveUsers = safeUsers.filter(
		(candidate: any) => !candidate.isActive,
	).length;
	const adminUsers = safeUsers.filter((candidate: any) => {
		const effectiveRole = candidate.tenantRole ?? candidate.role;
		return effectiveRole === "manager";
	}).length;
	const lockedUsers = safeUsers.filter((candidate: any) => {
		return Boolean(
			candidate.lockedUntil && new Date(candidate.lockedUntil) > new Date(),
		);
	}).length;
	const expiringSoon = safeUsers.filter((candidate: any) => {
		if (!candidate.expiresAt) return false;
		const daysUntilExpiry = Math.ceil(
			(new Date(candidate.expiresAt).getTime() - Date.now()) /
				(1000 * 60 * 60 * 24),
		);
		return daysUntilExpiry <= 7 && daysUntilExpiry > 0;
	}).length;

	const statCards = useMemo<AdminStatCard[]>(
		() => [
			{
				title: "Usuarios Activos",
				value: activeUsers,
				description: safeUsers.length
					? `${Math.round((activeUsers / safeUsers.length) * 100)}% del total`
					: "0%",
				icon: User,
				valueClassName: "text-emerald-600 dark:text-emerald-400",
			},
			{
				title: "Usuarios Inactivos",
				value: inactiveUsers,
				description: safeUsers.length
					? `${Math.round((inactiveUsers / safeUsers.length) * 100)}% del total`
					: "0%",
				icon: User,
				valueClassName: "text-rose-600 dark:text-rose-400",
			},
			{
				title: "Administradores",
				value: adminUsers,
				description: "Con permisos completos",
				icon: Shield,
				valueClassName: "text-sky-600 dark:text-sky-400",
			},
			{
				title: "Bloqueados",
				value: lockedUsers,
				description: "Por intentos fallidos",
				icon: AlertTriangle,
				valueClassName: "text-violet-600 dark:text-violet-400",
			},
			{
				title: "Expiran Pronto",
				value: expiringSoon,
				description: "En los próximos 7 días",
				icon: Clock,
				valueClassName: "text-amber-600 dark:text-amber-400",
			},
			{
				title: "Empresas",
				value: uniqueTenants,
				description: "Con usuarios registrados",
				icon: Building2,
				valueClassName: "text-teal-600 dark:text-teal-400",
			},
		],
		[
			activeUsers,
			adminUsers,
			expiringSoon,
			inactiveUsers,
			lockedUsers,
			safeUsers.length,
			uniqueTenants,
		],
	);

	const handleRefresh = async (): Promise<void> => {
		setIsRefreshing(true);
		try {
			await refresh();
		} catch (error) {
			console.error("Error al refrescar datos:", error);
		} finally {
			setIsRefreshing(false);
		}
	};

	const handleEditUser = (candidate: Usuario): void => {
		setSelectedUser(candidate);
		setEditDialogOpen(true);
	};

	const handleApproveUser = (candidate: Usuario): void => {
		setSelectedApproveUser(candidate);
		setSelectedPlanId("");
		setTenantName("");
		setApproveDialogOpen(true);
	};

	const handleConfirmApprove = async (): Promise<void> => {
		if (!approveUser) return;
		setIsApproving(true);
		try {
			const result = await approveGlobalUserAction({
				userId: approveUser.userId,
				planId:
					selectedPlanId && selectedPlanId !== "none"
						? selectedPlanId
						: undefined,
					tenantName: tenantName || undefined,
					licenseDurationDays: undefined,
			});

			if (!result.success) {
				throw new Error(result.error?.message || "Error aprobando usuario");
			}

			toast.success("Usuario aprobado correctamente");
			setApproveDialogOpen(false);
			setSelectedApproveUser(null);
			setSelectedPlanId("");
			setTenantName("");
			refresh();
		} catch (error) {
			toast.error(
				error instanceof Error ? error.message : "Error aprobando usuario",
			);
		}
		setIsApproving(false);
	};

	const handleDialogClose = (): void => {
		setCreateDialogOpen(false);
		setEditDialogOpen(false);
		setSelectedUser(null);
		refresh();
	};

	const handleOpenAddTenant = async (u: Usuario): Promise<void> => {
		setAddTenantUser(u);
		setAddTenantId("");
		setAddTenantRole("dependiente");
		setAddTenantDialogOpen(true);
		const r = await getAdminTenantsAction();
		if (r.success && r.data) setTenantsList(r.data);
	};

	const handleAddTenant = async (): Promise<void> => {
		if (!addTenantUser || !addTenantId) return;
		setAddTenantSubmitting(true);
		try {
			const r = await addTenantMembershipAction({
				userId: addTenantUser.userId,
				tenantId: addTenantId,
				tenantRole: addTenantRole as "dependiente" | "economico" | "manager" | "salesAgent",
			});
			if (!r.success) throw new Error(r.error?.message ?? "Error");
			toast.success(`${addTenantUser.name} añadido a la empresa`);
			setAddTenantDialogOpen(false);
			setAddTenantUser(null);
			refresh();
		} catch (error) {
			toast.error(
				error instanceof Error
					? error.message
					: "Error al añadir a la empresa",
			);
		} finally {
			setAddTenantSubmitting(false);
		}
	};

	return (
		<PageTransition className="relative min-h-screen w-full">
			<div className="fixed inset-0 pointer-events-none overflow-hidden -z-10">
				<motion.div
					className="absolute top-0 left-1/4 w-96 h-96 bg-violet-500/10 rounded-full blur-3xl dark:bg-violet-500/5"
					animate={{ scale: [1, 1.1, 1], x: [0, 20, 0], y: [0, -20, 0] }}
					transition={{ duration: 8, repeat: Infinity, ease: "easeInOut" }}
				/>
				<motion.div
					className="absolute top-0 right-1/4 w-96 h-96 bg-purple-500/10 rounded-full blur-3xl dark:bg-purple-500/5"
					animate={{ scale: [1, 1.15, 1], x: [0, -30, 0], y: [0, 30, 0] }}
					transition={{
						duration: 10,
						repeat: Infinity,
						ease: "easeInOut",
						delay: 1,
					}}
				/>
			</div>

			<StaggerContainer className="flex flex-1 flex-col">
				<StaggerItem className="flex flex-col gap-4 py-4 md:gap-6 md:py-6">
					{/* Header */}
					<motion.div
						className="flex items-center gap-3 px-4 lg:px-6"
						variants={titleVariants}
						initial="hidden"
						animate="visible"
					>
						<motion.div
							className="relative flex h-12 w-12 items-center justify-center rounded-xl bg-linear-to-br from-violet-600 to-purple-600 shadow-lg"
							variants={headerIconVariants}
							initial="initial"
							whileHover="hover"
						>
							<ShieldCheck className="h-6 w-6 text-white" />

							<motion.div
								className="absolute inset-0 rounded-xl bg-linear-to-tr from-transparent via-white/20 to-transparent"
								animate={{ rotate: [0, 360] }}
								transition={{ duration: 4, repeat: Infinity, ease: "linear" }}
								style={{ mixBlendMode: "overlay" }}
							/>
						</motion.div>
						<div>
							<motion.h1
								className="text-2xl font-bold bg-linear-to-r from-slate-900 to-slate-600 dark:from-white dark:to-slate-300 bg-clip-text text-transparent"
								initial={{ opacity: 0, x: -20 }}
								animate={{ opacity: 1, x: 0 }}
								transition={{ delay: 0.2, duration: 0.5 }}
							>
								Gestión de Usuarios
							</motion.h1>
							<motion.p
								className="text-muted-foreground text-sm"
								initial={{ opacity: 0, x: -20 }}
								animate={{ opacity: 1, x: 0 }}
								transition={{ delay: 0.3, duration: 0.5 }}
							>
								Administra usuarios, roles y permisos del sistema
							</motion.p>
						</div>

						<motion.div
							className="ml-auto flex flex-col gap-2 sm:flex-row"
							initial={{ opacity: 0, scale: 0.8 }}
							animate={{ opacity: 1, scale: 1 }}
							transition={{ delay: 0.4, type: "spring", stiffness: 200 }}
						>
							<Button
								onClick={handleRefresh}
								variant="outline"
								disabled={isRefreshing}
								className="border-slate-200/70 bg-white/70 backdrop-blur-sm transition-all duration-200 hover:shadow-sm dark:border-slate-700/60 dark:bg-slate-900/60"
							>
								<RefreshCw
									className={`mr-2 h-4 w-4 ${isRefreshing ? "animate-spin" : ""}`}
								/>
								{isRefreshing ? "Actualizando..." : "Actualizar"}
							</Button>
							<Button
								onClick={() => setCreateDialogOpen(true)}
								className="bg-linear-to-r from-violet-600 to-purple-600 text-white transition-all duration-200 hover:from-violet-600/90 hover:to-purple-600/90 hover:shadow-sm"
							>
								<Plus className="mr-2 h-4 w-4" />
								Crear Usuario
							</Button>
						</motion.div>
					</motion.div>

					{/* Stat Cards */}
					<motion.div
						className="grid grid-cols-1 gap-4 px-4 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 lg:px-6"
						initial={{ opacity: 0, y: 20 }}
						animate={{ opacity: 1, y: 0 }}
						transition={{ delay: 0.4, duration: 0.5 }}
					>
						{statCards.map((card) => {
							const Icon = card.icon;
							return (
								<AnimatedCard
									key={card.title}
									className="rounded-xl border bg-card shadow-sm"
								>
									<CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2 mt-4">
										<CardTitle className="text-sm font-medium">
											{card.title}
										</CardTitle>
										<div className="rounded-md bg-linear-to-br from-violet-600/15 to-purple-600/15 p-2">
											<Icon className="h-4 w-4 text-violet-600 dark:text-violet-400" />
										</div>
									</CardHeader>
									<CardContent className="mb-4">
										<div
											className={`text-2xl font-bold ${card.valueClassName}`}
										>
											{card.value}
										</div>
										<p className="text-xs text-muted-foreground">
											{card.description}
										</p>
									</CardContent>
								</AnimatedCard>
							);
						})}
					</motion.div>

					{/* Users Table */}
					<motion.div
						className="px-4 lg:px-6"
						initial={{ opacity: 0, y: 20 }}
						animate={{ opacity: 1, y: 0 }}
						transition={{ delay: 0.55, duration: 0.5 }}
					>
						<Card className="rounded-xl border border-slate-200 bg-card shadow-sm dark:border-slate-800">
							<CardHeader>
								<CardTitle>Lista de Usuarios</CardTitle>
								<CardDescription>
									Gestiona todos los usuarios del sistema.
								</CardDescription>
							</CardHeader>
							<CardContent>
								<AdminUsersTable
									users={safeUsers}
									total={total}
									isLoading={false}
									showTenantColumn={true}
									onEditUser={handleEditUser}
									onApproveUser={handleApproveUser}
									onAddTenantMembership={handleOpenAddTenant}
									onRefresh={refresh}
									onCreateUser={() => setCreateDialogOpen(true)}
									onConfirmSalesAgentPayout={(candidate) => setPayoutTarget({
										userId: candidate.userId,
										name: candidate.name,
										phone: (candidate as any).salesAgentProfile?.phone ?? null,
										availableUsd: Number((candidate as any).salesAgentBalance?.availableUsd ?? 0),
									})}
								/>
							</CardContent>
						</Card>
					</motion.div>

					{/* User Analytics */}
					<motion.div
						className="px-4 lg:px-6"
						initial={{ opacity: 0, y: 20 }}
						animate={{ opacity: 1, y: 0 }}
						transition={{ delay: 0.6, duration: 0.5 }}
					>
						<UserAnalyticsPanel />
					</motion.div>

					{/* User Monitoring Panel */}
					<motion.div
						className="px-4 lg:px-6"
						initial={{ opacity: 0, y: 20 }}
						animate={{ opacity: 1, y: 0 }}
						transition={{ delay: 0.7, duration: 0.5 }}
					>
						<UserMonitoringPanel />
					</motion.div>
				</StaggerItem>
			</StaggerContainer>

			<CreateUserDialog open={createDialogOpen} onClose={handleDialogClose} />
			<SalesAgentPayoutDialog
				open={Boolean(payoutTarget)}
				agent={payoutTarget}
				onOpenChange={(open) => { if (!open) setPayoutTarget(null); }}
				onConfirmed={refresh}
			/>
			{selectedUser && (
				<EditUserDialog
					open={editDialogOpen}
					onClose={handleDialogClose}
					user={selectedUser}
				/>
			)}

			<Dialog open={approveDialogOpen} onOpenChange={setApproveDialogOpen}>
				<DialogContent className="border-slate-200/70 bg-white/90 backdrop-blur-xl dark:border-slate-700/60 dark:bg-slate-900/90">
					<DialogHeader>
						<DialogTitle>Aprobar Usuario</DialogTitle>
						<DialogDescription>
							Estás por aprobar a{" "}
							<span className="font-medium">{approveUser?.name}</span> (
							{approveUser?.email}). Se creará su empresa y se le asignará una
							licencia.
						</DialogDescription>
					</DialogHeader>

					<div className="space-y-4 py-4">
						<div className="space-y-2">
							<Label htmlFor="tenantName">Nombre de la empresa</Label>
							<Input
								id="tenantName"
								value={tenantName}
								onChange={(e) => setTenantName(e.target.value)}
								placeholder="Ej: Mi Empresa SRL"
							/>
						</div>
						<div className="space-y-2">
							<span className="text-sm font-medium">
								Plan de licencia (opcional)
							</span>
							<Select value={selectedPlanId} onValueChange={setSelectedPlanId}>
								<SelectTrigger>
									<SelectValue placeholder="Seleccionar plan" />
								</SelectTrigger>
								<SelectContent>
									<SelectItem value="none">
										Sin plan (licencia básica)
									</SelectItem>
									{planes.map((plan: any) => (
										<SelectItem key={plan.planId} value={plan.planId}>
											{plan.nombre} - ${plan.precio}/{plan.billingCycle}
										</SelectItem>
									))}
								</SelectContent>
							</Select>
						</div>
					</div>

					<DialogFooter>
						<Button
							variant="outline"
							onClick={() => {
								setApproveDialogOpen(false);
								setSelectedApproveUser(null);
								setSelectedPlanId("");
							}}
							disabled={isApproving}
						>
							Cancelar
						</Button>
						<Button
							onClick={handleConfirmApprove}
							disabled={isApproving}
							className="bg-linear-to-r from-emerald-600 to-green-600 text-white hover:from-emerald-600/90 hover:to-green-600/90"
						>
							{isApproving ? "Aprobando..." : "Aprobar y Crear Empresa"}
						</Button>
					</DialogFooter>
				</DialogContent>
			</Dialog>

			{/* Diálogo: Añadir a empresa (multitenantmembership) */}
			<Dialog
				open={addTenantDialogOpen}
				onOpenChange={(open) => {
					if (!open) {
						setAddTenantDialogOpen(false);
						setAddTenantUser(null);
					}
				}}
			>
				<DialogContent className="sm:max-w-[480px]">
					<DialogHeader>
						<DialogTitle>Añadir a otra empresa</DialogTitle>
						<DialogDescription>
							{addTenantUser?.name} tendrá acceso a la empresa
							seleccionada con el rol que elijas.
						</DialogDescription>
					</DialogHeader>
					<div className="grid gap-4 py-4">
						<div className="grid gap-2">
							<Label htmlFor="addTenantId">Empresa</Label>
							<Select
								value={addTenantId}
								onValueChange={setAddTenantId}
							>
								<SelectTrigger id="addTenantId">
									<SelectValue placeholder="Seleccionar empresa" />
								</SelectTrigger>
								<SelectContent>
									{tenantsList.map((t: any) => (
										<SelectItem key={t.tenantId} value={t.tenantId}>
											{t.nombre ?? t.name ?? t.tenantId}
										</SelectItem>
									))}
								</SelectContent>
							</Select>
						</div>
						<div className="grid gap-2">
							<Label htmlFor="addTenantRole">Rol en la empresa</Label>
							<Select
								value={addTenantRole}
								onValueChange={setAddTenantRole}
							>
								<SelectTrigger id="addTenantRole">
									<SelectValue />
								</SelectTrigger>
								<SelectContent>
									<SelectItem value="manager">Manager</SelectItem>
									<SelectItem value="economico">Económico</SelectItem>
									<SelectItem value="dependiente">Dependiente</SelectItem>
									<SelectItem value="salesAgent">Gestor de Ventas</SelectItem>
								</SelectContent>
							</Select>
						</div>
					</div>
					<DialogFooter>
						<Button
							variant="outline"
							onClick={() => {
								setAddTenantDialogOpen(false);
								setAddTenantUser(null);
							}}
							disabled={addTenantSubmitting}
						>
							Cancelar
						</Button>
						<Button
							onClick={handleAddTenant}
							disabled={addTenantSubmitting || !addTenantId}
							className="bg-linear-to-r from-violet-600 to-purple-600 text-white hover:from-violet-600/90 hover:to-purple-600/90"
						>
							{addTenantSubmitting ? "Añadiendo..." : "Añadir"}
						</Button>
					</DialogFooter>
				</DialogContent>
			</Dialog>
		</PageTransition>
	);
}
