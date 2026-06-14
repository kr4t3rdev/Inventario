'use client';

import { useState, useEffect, useCallback } from 'react';
import { Building2, Check, ChevronRight, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { useAuth } from '@/contexts/auth-context';
import { fetchClientAuthJson } from '@/lib/client-auth-fetch';

interface TenantEntry {
	tenantId: string;
	nombre: string;
	slug: string;
	tenantRole: string;
	isCurrent: boolean;
}

/**
 * @description Dropdown para cambiar de tenant activo cuando el usuario
 * pertenece a múltiples empresas.
 * Consume el payload estable `{ items: TenantEntry[] }` de `/api/auth/tenants`
 * y sólo limpia estado local cuando la respuesta indica auth stale/invalid.
 * @returns {JSX.Element | null} Selector de tenant o null si ≤1 tenant
 */
export function TenantSwitcher(): JSX.Element | null {
	const { user } = useAuth();
	const [tenants, setTenants] = useState<TenantEntry[]>([]);
	const [loading, setLoading] = useState(false);
	const [switching, setSwitching] = useState(false);

	const fetchTenants = useCallback(async () => {
		setLoading(true);
		const result = await fetchClientAuthJson<{ items?: TenantEntry[] }>('/api/auth/tenants', {
			method: 'GET',
			clearState: () => setTenants([]),
			defaultErrorMessage: 'Error al cargar empresas',
		});

		if (result.success) {
			setTenants((result.data.items ?? []) as TenantEntry[]);
		}

		setLoading(false);
	}, []);

	useEffect(() => {
		if (user) fetchTenants();
	}, [user, fetchTenants]);

	const handleSwitch = async (tenantId: string) => {
		setSwitching(true);
		const result = await fetchClientAuthJson<{ tenantId: string; tenantRole: string }>('/api/auth/tenants', {
			method: 'POST',
			headers: {
				'content-type': 'application/json',
			},
			body: JSON.stringify({ tenantId }),
			defaultErrorMessage: 'Error al cambiar de empresa',
		});

		if (result.success) {
			window.location.reload();
		} else {
			toast.error(result.error.message);
		}

		setSwitching(false);
	};

	// Si no hay usuario, o hay solo 1 tenant, no mostrar
	if (!user || tenants.length <= 1) return null;

	const currentTenant = tenants.find((t) => t.isCurrent);

	const roleLabel: Record<string, string> = {
		manager: 'Manager',
		economico: 'Económico',
		dependiente: 'Dependiente',
		admin: 'Admin',
	};

	if (loading) {
		return (
			<div className="flex items-center gap-2 px-2 py-1.5">
				<Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
				<span className="text-xs text-muted-foreground">Cargando empresas...</span>
			</div>
		);
	}

	return (
		<div className="flex flex-col gap-1 px-1">
			<div className="flex items-center gap-2 rounded-md px-2 py-1.5">
				<Building2 className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
				<span className="text-xs font-medium truncate">
					{currentTenant?.nombre ?? 'Sin empresa'}
				</span>
				{currentTenant?.tenantRole && (
					<span className="text-[10px] text-muted-foreground ml-auto">
						{roleLabel[currentTenant.tenantRole] ?? currentTenant.tenantRole}
					</span>
				)}
			</div>
			{tenants
				.filter((t) => !t.isCurrent)
				.map((t) => (
					<button
						key={t.tenantId}
						disabled={switching}
						onClick={() => handleSwitch(t.tenantId)}
						className="flex items-center gap-2 rounded-md px-2 py-1.5 text-xs text-left hover:bg-accent hover:text-accent-foreground transition-colors disabled:opacity-50"
					>
						<ChevronRight className="h-3 w-3 text-muted-foreground shrink-0" />
						<span className="truncate">{t.nombre}</span>
						<span className="text-[10px] text-muted-foreground ml-auto shrink-0">
							{roleLabel[t.tenantRole] ?? t.tenantRole}
						</span>
					</button>
				))}
		</div>
	);
}
