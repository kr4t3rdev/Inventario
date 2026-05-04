import { apiSlice } from "./apiSlice";
import { Usuario, UserActivityLog, UserSession } from "../../../app/models/model";
import type { AppUserRole } from "@/lib/auth/roles";

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
    daysToExpire?: number;
};

type UpdateUserPayload = {
    userId: string;
    name?: string;
    email?: string;
    password?: string;
    role?: string;
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

            invalidatesTags:['Admin']
        }),

        updateUser: builder.mutation<Usuario, UpdateUserPayload>({
            query: ({ userId, ...patch }) => ({
                url: `/admin/users/${userId}`,
                method: 'PUT',
                body: patch,
            }),
            invalidatesTags: (result, error, { userId }) => [{ type: "Admin", userId }],
        }),

        deleteUser: builder.mutation<{ success: boolean; userId: string }, string>({
            query: (userId) => ({
                url: `/admin/users/${userId}`,
                method: 'DELETE',
            }),
            invalidatesTags: ['Admin'],
        }),

        getActivityLogs: builder.query<UserActivityLog[], { userId?: string; limit?: number }>({
            query: ({ userId, limit }) => ({
                url: '/admin/activity-logs',
                params: userId ? { userId, limit } : { limit },
            }),
            providesTags: ['ActivityLogs'],
        }),

        getSessions: builder.query<UserSession[], { userId?: string }>({
            query: ({ userId }) => ({
                url: '/admin/sessions',
                params: userId ? { userId } : {},
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
            invalidatesTags: ['Admin', 'ActivityLogs'],
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
            invalidatesTags: ['Admin', 'ActivityLogs', 'LoginHistory'],
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
} = adminApi
