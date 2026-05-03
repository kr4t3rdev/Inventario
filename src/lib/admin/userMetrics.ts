import { Prisma, PrismaClient } from '@/generated/prisma';

interface UserMetricsRow {
  monthStart: Date;
  usersCreated: number;
  activeUsersStart: number;
  activeUsersEnd: number;
  inactiveUsers: number;
  logins: number;
  logouts: number;
  blockedUsers: number;
  admin: number;
  dependiente: number;
  legacyUser: number;
}

interface UserMetricsResponse {
  monthlyData: Array<{
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
  }>;
  summary: {
    totalUsers: number;
    usersCreatedInPeriod: number;
    totalLogins: number;
    totalLogouts: number;
    totalBlocks: number;
  };
}

/**
 * @description Obtiene metricas temporales de usuarios usando agregaciones SQL.
 * @param {PrismaClient} prismaClient - Cliente de Prisma.
 * @param {number} months - Cantidad de meses a incluir.
 * @returns {Promise<UserMetricsResponse>} Serie temporal y resumen de metricas.
 */
export async function getUserMetrics(
  prismaClient: PrismaClient,
  months: number,
  tenantId?: string,
): Promise<UserMetricsResponse> {
  const now = new Date();
  const startDate = new Date(now);
  startDate.setMonth(startDate.getMonth() - months + 1);
  startDate.setDate(1);
  startDate.setHours(0, 0, 0, 0);

  const endDate = new Date(now.getFullYear(), now.getMonth(), 1);

  const userMembershipFilter = tenantId
    ? Prisma.sql` AND EXISTS (
        SELECT 1
        FROM tenant_memberships tm
        WHERE tm."userId" = u."userId"
          AND tm."tenantId" = ${tenantId}
          AND tm."isActive" = true
      )`
    : Prisma.sql``;

  const activityMembershipFilter = tenantId
    ? Prisma.sql` AND EXISTS (
        SELECT 1
        FROM tenant_memberships tm
        WHERE tm."userId" = ual."userId"
          AND tm."tenantId" = ${tenantId}
          AND tm."isActive" = true
      )`
    : Prisma.sql``;

  const monthlyRows = await prismaClient.$queryRaw<UserMetricsRow[]>`
    WITH months AS (
      SELECT date_trunc('month', gs)::date AS "monthStart"
      FROM generate_series(${startDate}::timestamp, ${endDate}::timestamp, interval '1 month') AS gs
    ),
    user_creations AS (
      SELECT
        date_trunc('month', "createdAt")::date AS month_start,
        COUNT(*)::int AS users_created,
        COUNT(*) FILTER (WHERE role = 'admin')::int AS admin,
        COUNT(*) FILTER (WHERE role = 'dependiente')::int AS dependiente,
        COUNT(*) FILTER (WHERE role = 'regularUser')::int AS "legacyUser"
      FROM "User"
      WHERE "createdAt" >= ${startDate}
        AND "createdAt" < (${endDate}::timestamp + interval '1 month')
        ${userMembershipFilter}
      GROUP BY 1
    ),
    activity AS (
      SELECT
        date_trunc('month', "createdAt")::date AS month_start,
        COUNT(*) FILTER (WHERE action = 'login')::int AS logins,
        COUNT(*) FILTER (WHERE action = 'logout')::int AS logouts,
        COUNT(*) FILTER (WHERE action = 'manual_lock')::int AS "blockedUsers"
      FROM "UserActivityLog"
      WHERE "createdAt" >= ${startDate}
        AND "createdAt" < (${endDate}::timestamp + interval '1 month')
        ${activityMembershipFilter}
      GROUP BY 1
    ),
    active_start AS (
      SELECT
        m."monthStart",
        COUNT(u."userId")::int AS "activeUsersStart"
      FROM months m
      LEFT JOIN "User" u
        ON u."createdAt" < m."monthStart"
       AND u."isActive" = true
       AND (u."expiresAt" IS NULL OR u."expiresAt" >= m."monthStart")
       ${userMembershipFilter}
      GROUP BY m."monthStart"
    ),
    active_end AS (
      SELECT
        m."monthStart",
        COUNT(u."userId")::int AS "activeUsersEnd"
      FROM months m
      LEFT JOIN "User" u
        ON u."createdAt" < (m."monthStart" + interval '1 month')
       AND u."isActive" = true
       AND (u."expiresAt" IS NULL OR u."expiresAt" >= (m."monthStart" + interval '1 month'))
       ${userMembershipFilter}
      GROUP BY m."monthStart"
    )
    SELECT
      m."monthStart",
      COALESCE(uc.users_created, 0)::int AS "usersCreated",
      COALESCE(s."activeUsersStart", 0)::int AS "activeUsersStart",
      COALESCE(e."activeUsersEnd", 0)::int AS "activeUsersEnd",
      GREATEST(COALESCE(s."activeUsersStart", 0) - COALESCE(e."activeUsersEnd", 0), 0)::int AS "inactiveUsers",
      COALESCE(a.logins, 0)::int AS logins,
      COALESCE(a.logouts, 0)::int AS logouts,
      COALESCE(a."blockedUsers", 0)::int AS "blockedUsers",
      COALESCE(uc.admin, 0)::int AS admin,
      COALESCE(uc.dependiente, 0)::int AS dependiente,
      COALESCE(uc."legacyUser", 0)::int AS "legacyUser"
    FROM months m
    LEFT JOIN user_creations uc ON uc.month_start = m."monthStart"
    LEFT JOIN activity a ON a.month_start = m."monthStart"
    LEFT JOIN active_start s ON s."monthStart" = m."monthStart"
    LEFT JOIN active_end e ON e."monthStart" = m."monthStart"
    ORDER BY m."monthStart" ASC;
  `;

  const [totalUsers, summaryActivity] = await Promise.all([
    tenantId
      ? prismaClient.$queryRaw<Array<{ totalUsers: bigint }>>(Prisma.sql`
          SELECT COUNT(*)::bigint AS "totalUsers"
          FROM "User" u
          WHERE EXISTS (
            SELECT 1
            FROM tenant_memberships tm
            WHERE tm."userId" = u."userId"
              AND tm."tenantId" = ${tenantId}
              AND tm."isActive" = true
          )
        `)
      : prismaClient.$queryRaw<Array<{ totalUsers: bigint }>>(Prisma.sql`
          SELECT COUNT(*)::bigint AS "totalUsers"
          FROM "User"
        `),
    prismaClient.$queryRaw<Array<{ action: string; count: bigint }>>(Prisma.sql`
      SELECT action, COUNT(*)::bigint AS count
      FROM "UserActivityLog" ual
      WHERE ual."createdAt" >= ${startDate}
        AND ual."createdAt" < (${endDate}::timestamp + interval '1 month')
        AND ual.action IN ('login', 'logout', 'manual_lock')
        ${tenantId
          ? Prisma.sql`AND EXISTS (
              SELECT 1
              FROM tenant_memberships tm
              WHERE tm."userId" = ual."userId"
                AND tm."tenantId" = ${tenantId}
                AND tm."isActive" = true
            )`
          : Prisma.sql``}
      GROUP BY action
    `),
  ]);

  const summaryMap = summaryActivity.reduce<Record<string, number>>((acc, current) => {
    acc[current.action] = Number(current.count);
    return acc;
  }, {});

  const monthlyData = monthlyRows.map((row) => {
    const monthDate = new Date(row.monthStart);

    return {
      year: monthDate.getFullYear(),
      month: monthDate.toLocaleDateString('es-ES', {
        month: 'long',
        year: 'numeric',
      }),
      yearMonth: `${monthDate.getFullYear()}-${String(monthDate.getMonth() + 1).padStart(2, '0')}`,
      usersCreated: row.usersCreated,
      activeUsersStart: row.activeUsersStart,
      activeUsersEnd: row.activeUsersEnd,
      inactiveUsers: row.inactiveUsers,
      logins: row.logins,
      logouts: row.logouts,
      blockedUsers: row.blockedUsers,
      newUsersByRole: {
        admin: row.admin,
        dependiente: row.dependiente,
        legacyUser: row.legacyUser,
      },
    };
  });

  return {
    monthlyData,
    summary: {
      totalUsers: Number(totalUsers[0]?.totalUsers ?? 0),
      usersCreatedInPeriod: monthlyData.reduce((sum, row) => sum + row.usersCreated, 0),
      totalLogins: summaryMap.login ?? 0,
      totalLogouts: summaryMap.logout ?? 0,
      totalBlocks: summaryMap.manual_lock ?? 0,
    },
  };
}
