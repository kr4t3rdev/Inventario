"use client";

import { useState, useEffect, useCallback } from "react";
import { Users, UserPlus } from "lucide-react";
import { toast } from "sonner";

import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useAuth } from "@/contexts/auth-context";
import { SettingsPageShell } from "@/features/configuracion/components/settings-page-shell";
import {
	approveMembershipAction,
	getGlobalUsersAction,
	getPendingMembershipsAction,
	rejectMembershipAction,
	updateTenantUserAction,
} from "@/features/admin/actions";
import { TenantUsersStats } from "./tenant-users-stats";
import { TenantUsersTable } from "./tenant-users-table";
import { PendingMembershipsTable } from "./pending-memberships-table";
import { MembershipActionDialog } from "./membership-action-dialog";
import { TenantUserRoleDialog } from "./tenant-user-role-dialog";
import { TenantUsersSkeleton } from "./tenant-users-skeleton";

interface PendingMembership {
	membershipId: string;
	tenantId: string;
	userId: string;
	tenantRole: string | null;
	isActive: boolean;
	createdAt: string;
	user: {
		userId: string;
		name: string;
		email: string;
		onboardingType: string | null;
		onboardingStatus: string | null;
		createdAt: string;
	};
}

/**
 * @description Página principal del panel de control de usuarios para manager del tenant.
 * Muestra tabs con usuarios activos y solicitudes pendientes.
 * @returns {JSX.Element} Panel completo de gestión de usuarios del tenant
 */
export function TenantUsersPage() {
	const { user } = useAuth();
	const [activeTab, setActiveTab] = useState("usuarios");
	const [selectedMembership, setSelectedMembership] =
		useState<PendingMembership | null>(null);
	const [dialogOpen, setDialogOpen] = useState(false);

	const [roleDialogUser, setRoleDialogUser] = useState<any | null>(null);
	const [roleDialogOpen, setRoleDialogOpen] = useState(false);

	const [usersData, setUsersData] = useState<any | undefined>(undefined);
	const [usersLoading, setUsersLoading] = useState(true);
	const [pendingMemberships, setPendingMemberships] = useState<
		PendingMembership[]
	>([]);
	const [pendingLoading, setPendingLoading] = useState(true);

	const fetchUsers = useCallback(async () => {
		setUsersLoading(true);
		try {
			const result = await getGlobalUsersAction({
				tenantId: (user as any)?.tenantId ?? undefined,
				limit: 100,
			});
			setUsersData(result?.success ? result.data : undefined);
		} catch {
			setUsersData(undefined);
		} finally {
			setUsersLoading(false);
		}
	}, [user]);

	const fetchPending = useCallback(async () => {
		setPendingLoading(true);
		try {
			const data = await getPendingMembershipsAction();
			setPendingMemberships((data?.success ? (data.data as any) : []) ?? []);
		} catch {
			setPendingMemberships([]);
		} finally {
			setPendingLoading(false);
		}
	}, []);

	useEffect(() => {
		fetchUsers();
		fetchPending();
	}, [fetchUsers, fetchPending]);

	const safeUsers = usersData?.users ?? [];
	// @ts-expect-error El tipo de la API global no expone isActive en el shape filtrado
	const activeUsers = safeUsers.filter((u) => u.isActive).length;
	// @ts-expect-error El tipo de la API global no expone tenantRole en el shape filtrado
	const adminUsers = safeUsers.filter((u) => {
		const role = u.tenantRole ?? u.role;
		return role === "manager";
	}).length;
	const pendingCount = pendingMemberships.length;

	const handleRefresh = useCallback(() => {
		fetchUsers();
		fetchPending();
	}, [fetchUsers, fetchPending]);

	const handleApproveClick = useCallback((membership: PendingMembership) => {
		setSelectedMembership(membership);
		setDialogOpen(true);
	}, []);

	const handleReject = useCallback(
		async (membership: PendingMembership) => {
			try {
				await rejectMembershipAction({ membershipId: membership.membershipId });
				toast.success(`Solicitud de ${membership.user.name} rechazada.`);
				fetchPending();
				fetchUsers();
			} catch (error) {
				console.error("Error rechazando membresía:", error);
				toast.error("Error al rechazar la solicitud.");
			}
		},
		[fetchPending, fetchUsers],
	);

	const handleConfirmApprove = useCallback(
		async (membershipId: string, tenantRole: string) => {
			try {
				const result = await approveMembershipAction({
					membershipId,
					tenantRole,
				});
				if (!result.success) {
					throw new Error(
						result.error?.message || "Error aprobando acceso",
					);
				}
				toast.success("Acceso aprobado correctamente.");
				fetchPending();
				fetchUsers();
			} catch (error) {
				console.error("Error aprobando membresía:", error);
				toast.error("Error al aprobar el acceso.");
			}
		},
		[fetchPending, fetchUsers],
	);

	const handleRoleChange = useCallback((u: any) => {
		setRoleDialogUser(u);
		setRoleDialogOpen(true);
	}, []);

	const handleRoleConfirm = useCallback(
		async (userId: string, tenantRole: string) => {
			try {
				const result = await updateTenantUserAction({
					userId,
					tenantRole,
				});
				if (!result.success) {
					throw new Error(
						result.error?.message || "Error al cambiar rol",
					);
				}
				toast.success("Rol actualizado correctamente.");
				fetchUsers();
			} catch (error) {
				console.error("Error cambiando rol:", error);
				toast.error("Error al cambiar el rol.");
			}
		},
		[fetchUsers],
	);

	const handleToggleActive = useCallback(
		async (u: any) => {
			try {
				const newState = !u.isActive;
				const result = await updateTenantUserAction({
					userId: u.userId,
					isActive: newState,
				});
				if (!result.success) {
					throw new Error(
						result.error?.message || "Error al cambiar estado",
					);
				}
				toast.success(
					newState
						? `Usuario ${u.name} activado correctamente.`
						: `Usuario ${u.name} desactivado correctamente.`,
				);
				fetchUsers();
			} catch (error) {
				console.error("Error cambiando estado:", error);
				toast.error("Error al cambiar el estado del usuario.");
			}
		},
		[fetchUsers],
	);

	const pendingBadge = pendingCount > 0 ? pendingCount.toString() : undefined;

	// Mostrar skeleton mientras se carga la data inicial (sin cache)
	const isLoading = usersLoading && !usersData;

	if (isLoading) {
		return (
			<SettingsPageShell
				icon={Users}
				title="Usuarios"
				description="Gestiona las cuentas y solicitudes de acceso de tu empresa."
			>
				<TenantUsersSkeleton />
			</SettingsPageShell>
		);
	}

	return (
		<SettingsPageShell
			icon={Users}
			title="Usuarios"
			description="Gestiona las cuentas y solicitudes de acceso de tu empresa."
		>
			<TenantUsersStats
				total={safeUsers.length}
				active={activeUsers}
				admins={adminUsers}
				pending={pendingCount}
			/>

			<Tabs value={activeTab} onValueChange={setActiveTab}>
				<TabsList className="w-full justify-start sm:w-fit">
					<TabsTrigger value="usuarios" className="flex items-center gap-2">
						<Users className="h-4 w-4" />
						Usuarios activos
					</TabsTrigger>
					<TabsTrigger
						value="solicitudes"
						className="relative flex items-center gap-2"
					>
						<UserPlus className="h-4 w-4" />
						Solicitudes pendientes
						{pendingBadge && (
							<span className="absolute -right-1 -top-1.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-destructive px-1 text-[10px] font-bold text-destructive-foreground">
								{pendingBadge}
							</span>
						)}
					</TabsTrigger>
				</TabsList>

				<TabsContent value="usuarios" className="mt-4">
					<TenantUsersTable
						users={safeUsers.map((u: any) => ({
							userId: u.userId,
							name: u.name,
							email: u.email,
							tenantRole: u.tenantRole,
							isActive: u.isActive,
							createdAt: u.createdAt,
						}))}
						isLoading={usersLoading}
						onRefresh={handleRefresh}
						currentUserId={user?.userId}
						onRoleChange={handleRoleChange}
						onToggleActive={handleToggleActive}
					/>
				</TabsContent>

				<TabsContent value="solicitudes" className="mt-4">
					<PendingMembershipsTable
						memberships={pendingMemberships}
						isLoading={pendingLoading}
						onRefresh={handleRefresh}
						onApprove={handleApproveClick}
						onReject={handleReject}
					/>
				</TabsContent>
			</Tabs>

			<MembershipActionDialog
				membership={selectedMembership}
				open={dialogOpen}
				onClose={() => {
					setDialogOpen(false);
					setSelectedMembership(null);
				}}
				onConfirm={handleConfirmApprove}
			/>

			<TenantUserRoleDialog
				user={roleDialogUser}
				open={roleDialogOpen}
				onClose={() => {
					setRoleDialogOpen(false);
					setRoleDialogUser(null);
				}}
				onConfirm={handleRoleConfirm}
			/>
		</SettingsPageShell>
	);
}
