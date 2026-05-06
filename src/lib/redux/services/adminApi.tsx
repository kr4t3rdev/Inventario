import { apiSlice } from "./apiSlice";
import { Usuario, UserActivityLog, UserSession } from "../../../app/models/model";
import type { AppUserRole } from "@/lib/auth/roles";
import type {
  UsuarioWithTenant,
  GlobalUsersResponse,
  GlobalUsersQuery,
} from "@/lib/types/admin";

type MonthlyData = {
    year: number;
    month: string;
    yearMonth: string;
    usersCreated: number;
    activeUsersStart: number;
    activeUsersEnd: number;
    inactiveUsers: number;
    logins: number;
    logouts: number;
    blockedUsers: number;
    newUsersByRole: {
        admin: number;
        dependiente: number;
        legacyUser: number;
    };
};

type UserMetricsResponse = {
    monthlyData: MonthlyData[];
    summary: {
        totalUsers: number;
        usersCreatedInPeriod: number;
        totalLogins: number;
        totalLogouts: number;
        totalBlocks: number;
    };
};

type CreateUserPayload = {
    name: string;
    email: string;
    password: string;
    role: AppUserRole;
    tenantRole?: string;
    daysToExpire?: number;
};

type UpdateUserPayload = {
    userId: string;
    name?: string;
    email?: string;
    password?: string;
    role?: string;
    tenantRole?: string;
    isActive?: boolean;
    daysToExpire?: number;
};

export interface AdminTenant {
    tenantId: string;
    nombre: string;
    slug: string | null;
    createdAt: string;
    updatedAt: string;
    totalUsers: number;
    activeUsers: number;
    totalProductos: number;
    totalAlmacenes: number;
    totalVentas: number;
    plan: string;
    planId: string | null;
    licenseActive: boolean;
    licenseExpiresAt: string | null;
    consumption: {
        usuarios: number;
        almacenes: number;
        productos: number;
    };
}

export interface AdminFinance {
    tenantCount: number;
    revenue: {
        totalVentas: number;
        totalVentasMonto: number;
        totalVentasServicios: number;
        totalServiciosMonto: number;
        totalIngresos: number;
    };
    gastos: {
        totalGastos: number;
        totalMonto: number;
    };
    cuentasPorCobrar: {
        total: number;
        saldoPendiente: number;
    };
    cuentasPorPagar: {
        total: number;
        saldoPendiente: number;
    };
}

export interface AdminSystemHealth {
    users: {
        total: number;
        byRole: { role: string; count: number }[];
    };
    tenants: {
        total: number;
    };
    sessions: {
        active: number;
    };
    licenses: {
        total: number;
        active: number;
        expiringSoon: number;
    };
}

export const adminApi = apiSlice.injectEndpoints({
    endpoints: (builder) => ({
        getUser: builder.query<Usuario[], void>({
            query: () => '/admin/users',
            providesTags: ['Admin']
        }),

        addUser: builder.mutation<Usuario, CreateUserPayload>({
            query:(user) => ({
                url:'/admin/users',
                method: 'POST',
                body: user,
            }),

            invalidatesTags:['Admin', 'GlobalUsers']
        }),

        updateUser: builder.mutation<Usuario, UpdateUserPayload>({
            query: ({ userId, ...patch }) => ({
                url: `/admin/users/${userId}`,
                method: 'PUT',
                body: patch,
            }),
            invalidatesTags: (result, error, { userId }) => [{ type: "Admin", userId }, 'GlobalUsers'],
        }),

        deleteUser: builder.mutation<{ success: boolean; userId: string }, string>({
            query: (userId) => ({
                url: `/admin/users/${userId}`,
                method: 'DELETE',
            }),
            invalidatesTags: ['Admin', 'GlobalUsers'],
        }),

        getActivityLogs: builder.query<UserActivityLog[], { userId?: string; limit?: number; tenantId?: string }>({
            query: ({ userId, limit, tenantId }) => ({
                url: '/admin/activity-logs',
                params: { ...(userId ? { userId } : {}), ...(limit ? { limit } : {}), ...(tenantId ? { tenantId } : {}) },
            }),
            providesTags: ['ActivityLogs'],
        }),

        getSessions: builder.query<UserSession[], { userId?: string; tenantId?: string }>({
            query: ({ userId, tenantId }) => ({
                url: '/admin/sessions',
                params: { ...(userId ? { userId } : {}), ...(tenantId ? { tenantId } : {}) },
            }),
            providesTags: ['Sessions'],
        }),

        deleteSession: builder.mutation<{ success: boolean }, string>({
            query: (sessionId) => ({
                url: `/admin/sessions?sessionId=${sessionId}`,
                method: 'DELETE',
            }),
            invalidatesTags: ['Sessions'],
        }),

        unlockUser: builder.mutation<{ user: Usuario; message: string }, { userId: string }>({
            query: ({ userId }) => ({
                url: '/admin/users/unlock',
                method: 'POST',
                body: { userId },
            }),
            invalidatesTags: ['Admin', 'ActivityLogs', 'GlobalUsers'],
        }),

        getUserLoginHistory: builder.query<{
            user: Usuario;
            logs: UserActivityLog[];
            failedAttempts: UserActivityLog[];
            totalFailedAttempts: number;
        }, { userId: string }>({
            query: ({ userId }) => ({
                url: `/admin/users/${userId}/login-history`,
            }),
            providesTags: ['LoginHistory'],
        }),

        lockUser: builder.mutation<{ user: Usuario; message: string }, { userId: string; reason?: string }>({
            query: ({ userId, reason }) => ({
                url: '/admin/users/lock',
                method: 'POST',
                body: { userId, reason },
            }),
            invalidatesTags: ['Admin', 'ActivityLogs', 'LoginHistory', 'GlobalUsers'],
        }),

        getExpiringSoon: builder.query<{
            users: Array<Usuario & { daysUntilExpiry: number }>;
            total: number;
        }, { days?: number }>({
            query: ({ days }) => ({
                url: `/admin/users/expiring-soon${days ? `?days=${days}` : ''}`,
            }),
            providesTags: ['ExpiringUsers'],
        }),

        sendExpiryNotifications: builder.mutation<{
            message: string;
            usersExpiringSoon: number;
            notificationsCreated: number;
            users: Array<{
                userId: string;
                name: string;
                email: string;
                expiresAt: string;
                daysUntilExpiry: number;
            }>;
        }, { days?: number }>({
            query: ({ days }) => ({
                url: '/admin/users/expiring-soon',
                method: 'POST',
                body: { days: days || 7 },
            }),
            invalidatesTags: ['Notificaciones', 'ExpiringUsers'],
        }),

        getTenantLicense: builder.query<{
            license: {
                tenantLicenseId: string;
                activa: boolean;
                inicio: string;
                expiracion: string;
                plan: { planId: string; nombre: string } | null;
            } | null;
            limits: {
                maxUsuarios: number;
                maxAlmacenes: number;
                maxProductos: number;
            };
            consumption: {
                usuarios: number;
                almacenes: number;
                productos: number;
            };
            tenantId: string;
            tenantRole: string;
        }, void>({
            query: () => '/admin/tenant/license',
            providesTags: ['TenantLicense']
        }),

        getUserMetrics: builder.query<UserMetricsResponse, { months: number }>({
            query: ({ months }) => ({
                url: `/admin/users/user-metrics?months=${months}`,
            }),
            providesTags: ['UserMetrics'],
        }),

        // ── Global Admin Endpoints ──
        getAdminTenants: builder.query<AdminTenant[], void>({
            query: () => '/admin/tenants',
            providesTags: ['AdminTenants'],
        }),

        getAdminFinance: builder.query<AdminFinance, void>({
            query: () => '/admin/finance',
            providesTags: ['AdminFinance'],
        }),

        getAdminSystem: builder.query<AdminSystemHealth, void>({
            query: () => '/admin/system',
            providesTags: ['AdminSystem'],
        }),

        // ── Global Admin User Endpoints ──
        getGlobalUsers: builder.query<GlobalUsersResponse, GlobalUsersQuery>({
            query: (params) => ({
                url: '/admin/global/users',
                params,
            }),
            providesTags: ['GlobalUsers'],
        }),

        getGlobalUserMetrics: builder.query<UserMetricsResponse, { months?: number; tenantId?: string }>({
            query: ({ months, tenantId }) => ({
                url: '/admin/global/users/metrics',
                params: { ...(months ? { months } : {}), ...(tenantId ? { tenantId } : {}) },
            }),
            providesTags: ['GlobalUserMetrics'],
        }),

        approveGlobalUser: builder.mutation<any, { userId: string; body?: { tenantName?: string; planId?: string; licenseDurationDays?: number } }>({
            query: ({ userId, body }) => ({
                url: `/admin/global/users/${userId}/approve`,
                method: 'POST',
                body,
            }),
            invalidatesTags: ['GlobalUsers', 'GlobalUserMetrics', 'AdminLicencias'],
        }),

        // ── Licenses ──
        getAdminLicencias: builder.query<any, { page?: number; limit?: number; planId?: string; activa?: string; search?: string }>({
            query: (params) => ({
                url: '/admin/licencias',
                params,
            }),
            providesTags: ['AdminLicencias'],
        }),

        createAdminLicencia: builder.mutation<any, any>({
            query: (body) => ({
                url: '/admin/licencias',
                method: 'POST',
                body,
            }),
            invalidatesTags: ['AdminLicencias'],
        }),

        updateAdminLicencia: builder.mutation<any, { id: string; body: any }>({
            query: ({ id, body }) => ({
                url: `/admin/licencias/${id}`,
                method: 'PUT',
                body,
            }),
            invalidatesTags: ['AdminLicencias'],
        }),

        deleteAdminLicencia: builder.mutation<void, string>({
            query: (id) => ({
                url: `/admin/licencias/${id}`,
                method: 'DELETE',
            }),
            invalidatesTags: ['AdminLicencias'],
        }),

        generateAdminLicencias: builder.mutation<any, any>({
            query: (body) => ({
                url: '/admin/licencias/generar',
                method: 'POST',
                body,
            }),
            invalidatesTags: ['AdminLicencias'],
        }),

        getAdminLicenciaAudits: builder.query<any, { licenciaId?: string; page?: number; limit?: number }>({
            query: (params) => ({
                url: '/admin/licencias/auditoria',
                params,
            }),
            providesTags: ['AdminLicenciaAudits'],
        }),

        // ── Plans ──
        getAdminPlanes: builder.query<any, { page?: number; limit?: number; search?: string }>({
            query: (params) => ({
                url: '/admin/planes',
                params,
            }),
            providesTags: ['AdminPlanes'],
        }),

        createAdminPlan: builder.mutation<any, any>({
            query: (body) => ({
                url: '/admin/planes',
                method: 'POST',
                body,
            }),
            invalidatesTags: ['AdminPlanes'],
        }),

        updateAdminPlan: builder.mutation<any, { id: string; body: any }>({
            query: ({ id, body }) => ({
                url: `/admin/planes/${id}`,
                method: 'PUT',
                body,
            }),
            invalidatesTags: ['AdminPlanes'],
        }),

        deleteAdminPlan: builder.mutation<void, string>({
            query: (id) => ({
                url: `/admin/planes/${id}`,
                method: 'DELETE',
            }),
            invalidatesTags: ['AdminPlanes'],
        }),
    })
})

export const {
    useGetUserQuery,
    useUpdateUserMutation,
    useDeleteUserMutation,
    useAddUserMutation,
    useGetActivityLogsQuery,
    useGetSessionsQuery,
    useDeleteSessionMutation,
    useUnlockUserMutation,
    useGetUserLoginHistoryQuery,
    useLockUserMutation,
    useGetExpiringSoonQuery,
    useSendExpiryNotificationsMutation,
    useGetUserMetricsQuery,
    useGetTenantLicenseQuery,
    useGetAdminTenantsQuery,
    useGetAdminFinanceQuery,
    useGetAdminSystemQuery,
    useGetGlobalUsersQuery,
    useGetGlobalUserMetricsQuery,
    useApproveGlobalUserMutation,
    useGetAdminLicenciasQuery,
    useCreateAdminLicenciaMutation,
    useUpdateAdminLicenciaMutation,
    useDeleteAdminLicenciaMutation,
    useGenerateAdminLicenciasMutation,
    useGetAdminLicenciaAuditsQuery,
    useGetAdminPlanesQuery,
    useCreateAdminPlanMutation,
    useUpdateAdminPlanMutation,
    useDeleteAdminPlanMutation,
} = adminApi
