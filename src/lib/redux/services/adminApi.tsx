import { apiSlice } from "./apiSlice";
import { Usuario, UserActivityLog, UserSession } from "../../../app/models/model";
import { getAuthToken } from "@/lib/token";

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
        regularUser: number;
    };
};

type CreateUserPayload = {
    name: string;
    email: string;
    password: string;
    role: 'admin' | 'dependiente' | 'regularUser';
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

export const adminApi = apiSlice.injectEndpoints({
    endpoints: (builder) => ({
        getUser: builder.query<Usuario[], void>({
            query: () =>({
                    url: '/admin/users',
                    headers: {
                        Authorization: getAuthToken(),
                    },
                }),
            providesTags: ['Admin']
        }),

        addUser: builder.mutation<Usuario, CreateUserPayload>({
            query:(user) => ({
                url:'/admin/users',
                method: 'POST',
                headers: {
                    Authorization: getAuthToken(),
                },
                body: user,
            }),

            invalidatesTags:['Admin']
        }),

        updateUser: builder.mutation<Usuario, UpdateUserPayload>({
            query: ({ userId, ...patch }) => ({
                url: `/admin/users/${userId}`,
                method: 'PUT',
                headers: {
                    Authorization: getAuthToken(),
                },
                body: patch,
            }),
            invalidatesTags: (result, error, { userId }) => [{ type: "Admin", userId }],
        }),

        deleteUser: builder.mutation<{ success: boolean; userId: string }, string>({
            query: (userId) => ({
                url: `/admin/users/${userId}`,
                method: 'DELETE',
                headers: {
                 Authorization: getAuthToken(),
                },
            }),
            invalidatesTags: ['Admin'],
        }),

        getActivityLogs: builder.query<UserActivityLog[], { userId?: string; limit?: number }>({
            query: ({ userId, limit }) => ({
                url: '/admin/activity-logs',
                headers: {
                    Authorization: getAuthToken(),
                },
                params: userId ? { userId, limit } : { limit },
            }),
            providesTags: ['ActivityLogs'],
        }),

        getSessions: builder.query<UserSession[], { userId?: string }>({
            query: ({ userId }) => ({
                url: '/admin/sessions',
                headers: {
                    Authorization: getAuthToken(),
                },
                params: userId ? { userId } : {},
            }),
            providesTags: ['Sessions'],
        }),

        deleteSession: builder.mutation<{ success: boolean }, string>({
            query: (sessionId) => ({
                url: `/admin/sessions?sessionId=${sessionId}`,
                method: 'DELETE',
                headers: {
                    Authorization: getAuthToken(),
                },
            }),
            invalidatesTags: ['Sessions'],
        }),

        unlockUser: builder.mutation<{ user: Usuario; message: string }, { userId: string }>({
            query: ({ userId }) => ({
                url: '/admin/users/unlock',
                method: 'POST',
                headers: {
                    Authorization: getAuthToken(),
                },
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
                headers: {
                    Authorization: getAuthToken(),
                },
            }),
            providesTags: ['LoginHistory'],
        }),

        lockUser: builder.mutation<{ user: Usuario; message: string }, { userId: string; reason?: string }>({
            query: ({ userId, reason }) => ({
                url: '/admin/users/lock',
                method: 'POST',
                headers: {
                    Authorization: getAuthToken(),
                },
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
                headers: {
                    Authorization: getAuthToken(),
                },
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
                headers: {
                    Authorization: getAuthToken(),
                },
                body: { days: days || 7 },
            }),
            invalidatesTags: ['Notificaciones', 'ExpiringUsers'],
        }),

        getUserMetrics: builder.query<{
            monthlyData: MonthlyData[];
            summary: {
                totalUsers: number;
                usersCreatedInPeriod: number;
                totalLogins: number;
                totalLogouts: number;
                totalBlocks: number;
            };
        }, { months: number }>({
            query: ({ months }) => ({
                url: `/admin/users/user-metrics?months=${months}`,
                headers: {
                    Authorization: getAuthToken(),
                },
            }),
            providesTags: ['UserMetrics'],
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
} = adminApi
