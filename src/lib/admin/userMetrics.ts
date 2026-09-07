import { Prisma, PrismaClient } from "@/generated/prisma";

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
	manager: number;
	economico: number;
	dependiente: number;
	regularUser: number;
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
			manager: number;
			economico: number;
			dependiente: number;
			regularUser: number;
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
 * @description IDs de tenant aceptados para interpolación SQL segura.
 * Los tenantId son cuid(): alfanuméricos con guiones; cualquier otro
 * formato se rechaza antes de tocar SQL (fail-closed anti-inyección).
 */
const SAFE_TENANT_ID = /^[A-Za-z0-9_-]{1,64}$/;

/**
 * @description Valida un tenantId opcional para uso en SQL interpolado.
 * @param {string} [tenantId] - Tenant a filtrar.
 * @throws {Error} Si el formato no es un ID de tenant válido.
 */
function assertSafeTenantId(tenantId?: string): void {
  if (tenantId !== undefined && !SAFE_TENANT_ID.test(tenantId)) {
    throw new Error('tenantId con formato inválido para métricas');
  }
}

/**
 * @description Formatea una fecha como string ISO para usarla en SQL.
 */
function fmt(d: Date): string {
  return d.toISOString().replace("T", " ").replace("Z", "");
}

/**
 * @description Obtiene metricas temporales de usuarios usando agregaciones SQL.
 *
 * NOTA: Usa $queryRawUnsafe porque Prisma.sql + Date objects + CTEs con
 * generate_series genera un error de sintaxis en la parametrización ($N).
 * Las fechas son generadas internamente y el tenantId se valida con
 * assertSafeTenantId (formato cuid) antes de interpolar: cualquier otro
 * formato falla cerrado sin ejecutar SQL.
 *
 * @param {PrismaClient} prismaClient - Cliente de Prisma.
 * @param {number} months - Cantidad de meses a incluir.
 * @param {string} [tenantId] - Opcional: filtrar por tenant.
 * @returns {Promise<UserMetricsResponse>} Serie temporal y resumen de metricas.
 */
export async function getUserMetrics(
	prismaClient: PrismaClient,
	months: number,
	tenantId?: string,
): Promise<UserMetricsResponse> {
	assertSafeTenantId(tenantId);
	const now = new Date();
	const startDate = new Date(now);
	startDate.setMonth(startDate.getMonth() - months + 1);
	startDate.setDate(1);
	startDate.setHours(0, 0, 0, 0);

	const endDate = new Date(now.getFullYear(), now.getMonth(), 1);

	const tenantFilter = tenantId
		? `AND EXISTS (
        SELECT 1 FROM tenant_memberships tm
        WHERE tm."userId" = u."userId"
          AND tm."tenantId" = '${tenantId}'
          AND tm."isActive" = true
      )`
		: "";

	const activityTenantFilter = tenantId
		? `AND EXISTS (
        SELECT 1 FROM tenant_memberships tm
        WHERE tm."userId" = ual."userId"
          AND tm."tenantId" = '${tenantId}'
          AND tm."isActive" = true
      )`
		: "";

	const mainSql = `
    WITH months AS (
      SELECT date_trunc('month', gs)::date AS "monthStart"
      FROM generate_series('${fmt(startDate)}'::timestamp, '${fmt(endDate)}'::timestamp, interval '1 month') AS gs
    ),
    user_creations AS (
      SELECT
        date_trunc('month', "createdAt")::date AS month_start,
        COUNT(*)::int AS users_created,
        COUNT(*) FILTER (WHERE role = 'admin')::int AS admin,
        COUNT(*) FILTER (WHERE role = 'manager')::int AS manager,
        COUNT(*) FILTER (WHERE role = 'economico')::int AS economico,
        COUNT(*) FILTER (WHERE role = 'dependiente')::int AS dependiente,
        COUNT(*) FILTER (WHERE role = 'regularUser')::int AS "regularUser"
      FROM "User" u
      WHERE "createdAt" >= '${fmt(startDate)}'::timestamp
        AND "createdAt" < ('${fmt(endDate)}'::timestamp + interval '1 month')
        ${tenantFilter}
      GROUP BY 1
    ),
    activity AS (
      SELECT
        date_trunc('month', "createdAt")::date AS month_start,
        COUNT(*) FILTER (WHERE action = 'login')::int AS logins,
        COUNT(*) FILTER (WHERE action = 'logout')::int AS logouts,
        COUNT(*) FILTER (WHERE action = 'manual_lock')::int AS "blockedUsers"
      FROM "UserActivityLog" ual
      WHERE "createdAt" >= '${fmt(startDate)}'::timestamp
        AND "createdAt" < ('${fmt(endDate)}'::timestamp + interval '1 month')
        ${activityTenantFilter}
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
       ${tenantFilter.replace(/u\."userId"/g, 'u."userId"')}
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
       ${tenantFilter.replace(/u\."userId"/g, 'u."userId"')}
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
      COALESCE(uc.manager, 0)::int AS manager,
      COALESCE(uc.economico, 0)::int AS economico,
      COALESCE(uc.dependiente, 0)::int AS dependiente,
      COALESCE(uc."regularUser", 0)::int AS "regularUser"
    FROM months m
    LEFT JOIN user_creations uc ON uc.month_start = m."monthStart"
    LEFT JOIN activity a ON a.month_start = m."monthStart"
    LEFT JOIN active_start s ON s."monthStart" = m."monthStart"
    LEFT JOIN active_end e ON e."monthStart" = m."monthStart"
    ORDER BY m."monthStart" ASC;
  `;

	const monthlyRows =
		await prismaClient.$queryRawUnsafe<UserMetricsRow[]>(mainSql);

	const tenantTotalFilter = tenantId
		? `WHERE EXISTS (
        SELECT 1 FROM tenant_memberships tm
        WHERE tm."userId" = u."userId"
          AND tm."tenantId" = '${tenantId}'
          AND tm."isActive" = true
      )`
		: "";

	const [totalUsers, summaryActivity] = await Promise.all([
		prismaClient.$queryRawUnsafe<Array<{ totalUsers: bigint }>>(
			`SELECT COUNT(*)::bigint AS "totalUsers" FROM "User" u ${tenantTotalFilter}`,
		),
		tenantId
			? prismaClient.$queryRawUnsafe<Array<{ action: string; count: bigint }>>(
					`SELECT action, COUNT(*)::bigint AS count
           FROM "UserActivityLog" ual
           WHERE ual."createdAt" >= '${fmt(startDate)}'::timestamp
             AND ual."createdAt" < ('${fmt(endDate)}'::timestamp + interval '1 month')
             AND ual.action IN ('login', 'logout', 'manual_lock')
             AND EXISTS (
               SELECT 1 FROM tenant_memberships tm
               WHERE tm."userId" = ual."userId"
                 AND tm."tenantId" = '${tenantId}'
                 AND tm."isActive" = true
             )
           GROUP BY action`,
				)
			: prismaClient.$queryRawUnsafe<Array<{ action: string; count: bigint }>>(
					`SELECT action, COUNT(*)::bigint AS count
           FROM "UserActivityLog" ual
           WHERE ual."createdAt" >= '${fmt(startDate)}'::timestamp
             AND ual."createdAt" < ('${fmt(endDate)}'::timestamp + interval '1 month')
             AND ual.action IN ('login', 'logout', 'manual_lock')
           GROUP BY action`,
				),
	]);

	const summaryMap = summaryActivity.reduce<Record<string, number>>(
		(acc, current) => {
			acc[current.action] = Number(current.count);
			return acc;
		},
		{},
	);

	const monthlyData = monthlyRows.map((row) => {
		const monthDate = new Date(row.monthStart);
		return {
			year: monthDate.getFullYear(),
			month: monthDate.toLocaleDateString("es-ES", {
				month: "long",
				year: "numeric",
			}),
			yearMonth: `${monthDate.getFullYear()}-${String(monthDate.getMonth() + 1).padStart(2, "0")}`,
			usersCreated: row.usersCreated,
			activeUsersStart: row.activeUsersStart,
			activeUsersEnd: row.activeUsersEnd,
			inactiveUsers: row.inactiveUsers,
			logins: row.logins,
			logouts: row.logouts,
			blockedUsers: row.blockedUsers,
			newUsersByRole: {
				admin: row.admin,
				manager: row.manager,
				economico: row.economico,
				dependiente: row.dependiente,
				regularUser: row.regularUser,
			},
		};
	});

	return {
		monthlyData,
		summary: {
			totalUsers: Number(totalUsers[0]?.totalUsers ?? 0),
			usersCreatedInPeriod: monthlyData.reduce(
				(sum, row) => sum + row.usersCreated,
				0,
			),
			totalLogins: summaryMap.login ?? 0,
			totalLogouts: summaryMap.logout ?? 0,
			totalBlocks: summaryMap.manual_lock ?? 0,
		},
	};
}
