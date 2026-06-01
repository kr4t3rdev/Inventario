/**
 * @description Diálogo para cambiar rol de un usuario del tenant.
 * @module features/admin/components/tenant-user-role-dialog
 */
"use client";

import { useState } from "react";
import { Loader2 } from "lucide-react";

import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogFooter,
	DialogHeader,
	DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@/components/ui/select";
import { getTenantRoleLabel } from "@/lib/auth/roles";

interface TenantUser {
	userId: string;
	name: string;
	email: string;
	tenantRole: string | null;
	isActive: boolean;
	createdAt: string;
}

interface TenantUserRoleDialogProps {
	user: TenantUser | null;
	open: boolean;
	onClose: () => void;
	onConfirm: (userId: string, tenantRole: string) => Promise<void>;
}

/**
 * @description Diálogo para cambiar el rol de un usuario del tenant.
 * @param {TenantUserRoleDialogProps} props - Usuario, estado del diálogo, handlers
 * @returns {JSX.Element} Diálogo con selector de rol
 */
export function TenantUserRoleDialog({
	user,
	open,
	onClose,
	onConfirm,
}: TenantUserRoleDialogProps) {
	const [role, setRole] = useState(user?.tenantRole || "dependiente");
	const [isSubmitting, setIsSubmitting] = useState(false);

	const handleConfirm = async () => {
		if (!user) return;
		setIsSubmitting(true);
		try {
			await onConfirm(user.userId, role);
			onClose();
		} finally {
			setIsSubmitting(false);
		}
	};

	const handleOpenChange = (open: boolean) => {
		if (!open && !isSubmitting) {
			onClose();
		}
	};

	// Reset role when user changes
	if (user && role !== user.tenantRole && !isSubmitting) {
		setRole(user.tenantRole || "dependiente");
	}

	return (
		<Dialog open={open} onOpenChange={handleOpenChange}>
			<DialogContent>
				<DialogHeader>
					<DialogTitle>Cambiar Rol</DialogTitle>
					<DialogDescription>
						Estás por cambiar el rol de{" "}
						<span className="font-medium">{user?.name}</span> ({user?.email}).
					</DialogDescription>
				</DialogHeader>

				<div className="space-y-4 py-4">
					<div className="space-y-2">
						<Label htmlFor="role">Nuevo rol</Label>
						<Select value={role} onValueChange={setRole}>
							<SelectTrigger id="role">
								<SelectValue placeholder="Seleccionar rol" />
							</SelectTrigger>
							<SelectContent>
								<SelectItem value="dependiente">
									{getTenantRoleLabel("dependiente")}
								</SelectItem>
								<SelectItem value="economico">
									{getTenantRoleLabel("economico")}
								</SelectItem>
								<SelectItem value="manager">
									{getTenantRoleLabel("manager")}
								</SelectItem>
							</SelectContent>
						</Select>
					</div>
				</div>

				<DialogFooter>
					<Button variant="outline" onClick={onClose} disabled={isSubmitting}>
						Cancelar
					</Button>
					<Button onClick={handleConfirm} disabled={isSubmitting}>
						{isSubmitting ? (
							<>
								<Loader2 className="mr-2 h-4 w-4 animate-spin" />
								Guardando...
							</>
						) : (
							"Guardar Cambios"
						)}
					</Button>
				</DialogFooter>
			</DialogContent>
		</Dialog>
	);
}
